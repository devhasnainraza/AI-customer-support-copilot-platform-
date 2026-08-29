"""
Notification Worker - Kafka Consumer for Ticket Notifications
T112-T114: Consumes ticket events and sends email/Slack notifications
"""
import asyncio
import json
import logging
import smtplib
from email.mime.text import MIMEText
from typing import Optional
from uuid import UUID

import httpx
from kafka import KafkaConsumer
from kafka.errors import KafkaError

from src.config.settings import settings
from src.config.supabase import get_service_client
from src.services.chat_service import ChatService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def send_email_notification(to_email: str, ticket_number: str, priority: str, summary: str):
    """
    T113: Send email notification to customer
    """
    if not settings.smtp_host or not settings.smtp_username:
        logger.info(f"[Email Mock] SMTP not configured. Would send to {to_email} regarding ticket {ticket_number}")
        return

    subject = f"Support Ticket Created: {ticket_number}"
    body = f"""Hello,

Your support ticket has been created successfully.

Ticket Details:
- Ticket Number: {ticket_number}
- Priority: {priority.upper()}

Issue Summary:
{summary}

A support agent will review your request and get in touch with you shortly.

Best regards,
AI Customer Support Team"""

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to_email

    try:
        # Wrap SMTP execution in an executor since smtplib is synchronous and blocking
        loop = asyncio.get_running_loop()
        def _send():
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_password:
                    server.starttls()
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
                
        await loop.run_in_executor(None, _send)
        logger.info(f"Notification email sent to {to_email} for ticket {ticket_number}")
    except Exception as e:
        logger.error(f"Failed to send email notification to {to_email}: {e}")


async def send_slack_notification(ticket_number: str, priority: str, summary: str):
    """
    T114: Send Slack webhook alert for support team
    """
    webhook_url = settings.slack_webhook_url or settings.slack_bot_token
    if not webhook_url:
        logger.info(f"[Slack Mock] Slack not configured. Would alert for ticket {ticket_number} with priority {priority}")
        return

    payload = {
        "text": f"🚨 *New Support Ticket Created: {ticket_number}*\n"
                f"*Priority*: `{priority.upper()}`\n"
                f"*Summary*:\n> {summary}\n"
                f"Please review and assign to an agent."
    }

    try:
        async with httpx.AsyncClient() as client:
            # If webhook, send json directly
            if webhook_url.startswith("http"):
                response = await client.post(webhook_url, json=payload, timeout=5.0)
                if response.status_code != 200:
                    logger.error(f"Slack webhook returned code {response.status_code}: {response.text}")
            else:
                # Assume bot token and format Web API POST to chat.postMessage
                headers = {"Authorization": f"Bearer {webhook_url}"}
                payload["channel"] = "#support-tickets"
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers=headers,
                    json=payload,
                    timeout=5.0
                )
                res_data = response.json()
                if not res_data.get("ok"):
                    logger.error(f"Slack Web API error: {res_data.get('error')}")
                    
        logger.info(f"Slack notification sent for ticket {ticket_number}")
    except Exception as e:
        logger.error(f"Failed to send Slack notification for ticket {ticket_number}: {e}")


class NotificationWorker:
    """
    Worker that consumes ticket-events and sends notifications
    """

    def __init__(self):
        self.consumer = None
        self.running = False

    def create_consumer(self):
        """Create Kafka consumer"""
        try:
            self.consumer = KafkaConsumer(
                'ticket-events',
                bootstrap_servers=settings.kafka_bootstrap_servers.split(','),
                group_id=f"{settings.kafka_consumer_group_id}-notification",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                max_poll_records=settings.notification_worker_concurrency
            )
            logger.info(f"Kafka Notification Consumer connected to {settings.kafka_bootstrap_servers}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to create Kafka consumer: {e}")
            return False

    async def process_ticket_event(self, event: dict):
        """
        Process ticket event
        """
        event_type = event.get('event_type')
        payload = event.get('payload', {})
        ticket_number = payload.get('ticket_number')
        conversation_id = payload.get('conversation_id')
        priority = payload.get('priority', 'medium')
        summary = payload.get('ai_summary', 'No summary provided.')

        if event_type == 'ticket.created':
            logger.info(f"Processing notification for ticket created: {ticket_number}")
            
            # Fetch customer email
            if not conversation_id:
                logger.error(f"Missing conversation_id for ticket {ticket_number}")
                return
                
            try:
                conversation = await ChatService.get_conversation(UUID(conversation_id))
                if not conversation:
                    logger.error(f"Conversation {conversation_id} not found for notification lookup")
                    return
                    
                supabase = get_service_client()
                cust_res = supabase.table("customers").select("email").eq("id", str(conversation.customer_id)).execute()
                if not cust_res.data:
                    logger.error(f"Customer {conversation.customer_id} not found for notification lookup")
                    return
                    
                customer_email = cust_res.data[0]["email"]
                
                # Send email and Slack notifications in parallel
                await asyncio.gather(
                    send_email_notification(customer_email, ticket_number, priority, summary),
                    send_slack_notification(ticket_number, priority, summary),
                    return_exceptions=True
                )
                
            except Exception as e:
                logger.error(f"Failed to process notifications for ticket {ticket_number}: {e}")

    async def run(self):
        """Main worker loop"""
        logger.info("Notification Worker starting...")

        if not self.create_consumer():
            logger.error("Failed to initialize consumer, exiting")
            return

        self.running = True
        logger.info(
            f"Notification Worker ready - consuming from 'ticket-events' topic "
            f"(concurrency: {settings.notification_worker_concurrency})"
        )

        try:
            while self.running:
                # Poll for messages off the event loop (consumer.poll blocks)
                messages = await asyncio.to_thread(self.consumer.poll, timeout_ms=1000)

                if not messages:
                    continue

                tasks = []
                for topic_partition, records in messages.items():
                    for record in records:
                        event = record.value
                        task = asyncio.create_task(
                            self.process_ticket_event(event)
                        )
                        tasks.append(task)

                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
        finally:
            self.stop()

    def stop(self):
        """Stop the worker"""
        self.running = False
        if self.consumer:
            self.consumer.close()
            logger.info("Notification Worker stopped")


async def main():
    """Entry point"""
    worker = NotificationWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
