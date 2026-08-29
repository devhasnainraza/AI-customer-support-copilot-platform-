"""
WebSocket Delivery via Redis Pub/Sub
T059-T060: Deliver AI responses to WebSocket connections
"""
import asyncio
import json
import logging
from redis.asyncio import Redis

from src.config.redis import get_redis_client
from src.api.websockets.connection_manager import manager
from src.services.kafka_producer import KafkaProducerService
from kafka import KafkaConsumer
from src.config.settings import settings
# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class WebSocketDeliveryService:
    """
    Service that consumes chat-responses from Kafka and delivers to WebSocket clients
    """

    def __init__(self):
        self.consumer = None
        self.redis: Redis = None
        self.running = False

    async def initialize(self):
        """Initialize Redis and Kafka consumer"""
        try:
            # Get Redis client
            self.redis = await get_redis_client()
            await self.redis.ping()
            logger.info("Redis connection established")

            # Create Kafka consumer
            self.consumer = KafkaConsumer(
                'chat-responses',
                bootstrap_servers=settings.kafka_bootstrap_servers.split(','),
                group_id=f"{settings.kafka_consumer_group_id}-delivery",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True
            )
            logger.info("Kafka consumer for chat-responses created")

            return True

        except Exception as e:
            logger.error(f"Failed to initialize delivery service: {e}")
            return False

    async def deliver_to_websocket(self, conversation_id: str, message_data: dict):
        """
        Deliver message to WebSocket connections for a conversation

        Args:
            conversation_id: Conversation UUID
            message_data: Message payload to send
        """
        try:
            # Check if there are active WebSocket connections for this conversation
            connection_count = manager.get_conversation_connections_count(conversation_id)

            if connection_count == 0:
                logger.debug(f"No active WebSocket connections for conversation {conversation_id}")
                return

            # Send to all connections in the conversation
            await manager.send_to_conversation(message_data, conversation_id)

            logger.info(
                f"Message delivered to {connection_count} WebSocket connection(s) "
                f"for conversation {conversation_id}"
            )

        except Exception as e:
            logger.error(f"Failed to deliver message to WebSocket: {e}")

    async def process_response_event(self, event: dict):
        """
        Process AI response event and deliver to WebSocket

        Args:
            event: Kafka event from chat-responses topic
        """
        try:
            event_type = event.get('event_type')
            payload = event.get('payload', {})

            if event_type == 'message.ai_response_ready':
                conversation_id = payload.get('conversation_id')
                message_id = payload.get('message_id')
                content = payload.get('content')
                confidence_score = payload.get('confidence_score', 0.0)
                should_escalate = payload.get('should_escalate', False)
                sources = payload.get('sources', [])

                # Build WebSocket message
                ws_message = {
                    'type': 'message',
                    'message_id': message_id,
                    'sender': 'ai',
                    'content': content,
                    'confidence': confidence_score,
                    'timestamp': event.get('timestamp'),
                    'sources': sources
                }

                # Deliver to WebSocket
                await self.deliver_to_websocket(conversation_id, ws_message)

                # Stop typing indicator
                await self.deliver_to_websocket(
                    conversation_id,
                    {'type': 'typing', 'is_typing': False}
                )

                # If escalation needed, notify client
                if should_escalate:
                    await self.deliver_to_websocket(
                        conversation_id,
                        {
                            'type': 'escalation',
                            'message': 'This conversation requires human assistance',
                            'reason': payload.get('escalation_reason')
                        }
                    )

        except Exception as e:
            logger.error(f"Failed to process response event: {e}", exc_info=True)

    async def run(self):
        """Main delivery loop"""
        logger.info("WebSocket Delivery Service starting...")

        if not await self.initialize():
            logger.error("Failed to initialize, exiting")
            return

        self.running = True
        logger.info("WebSocket Delivery Service ready - consuming from 'chat-responses' topic")

        try:
            while self.running:
                # Poll for messages in a worker thread; consumer.poll blocks and
                # would otherwise stall the API process event loop.
                messages = await asyncio.to_thread(
                    self.consumer.poll, timeout_ms=500
                )

                if not messages:
                    await asyncio.sleep(0.1)
                    continue

                # Process messages
                for topic_partition, records in messages.items():
                    for record in records:
                        event = record.value
                        await self.process_response_event(event)

        except asyncio.CancelledError:
            logger.info("Delivery service cancelled")
            raise
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        except Exception as e:
            logger.error(f"Delivery service error: {e}", exc_info=True)
        finally:
            self.stop()

    def stop(self):
        """Stop the delivery service"""
        self.running = False
        if self.consumer:
            try:
                self.consumer.close()
            except Exception as e:
                logger.warning(f"Error closing Kafka consumer: {e}")
            self.consumer = None
        logger.info("WebSocket Delivery Service stopped")


# Singleton used by the API process background task
_delivery_service: "WebSocketDeliveryService | None" = None
_delivery_task: "asyncio.Task | None" = None


async def start_delivery_task() -> None:
    """
    Start the chat-responses consumer as a background task inside the API
    process. The ConnectionManager holding live WebSockets is in-process, so
    the consumer must run here for AI responses to reach browsers.
    """
    global _delivery_service, _delivery_task

    if _delivery_task and not _delivery_task.done():
        logger.warning("Delivery task already running")
        return

    _delivery_service = WebSocketDeliveryService()
    _delivery_task = asyncio.create_task(
        _delivery_service.run(), name="ws-delivery-consumer"
    )
    logger.info("WebSocket delivery background task started")


async def stop_delivery_task() -> None:
    """Cancel the background delivery task and close the Kafka consumer."""
    global _delivery_service, _delivery_task

    if _delivery_service:
        _delivery_service.running = False

    if _delivery_task and not _delivery_task.done():
        _delivery_task.cancel()
        try:
            await _delivery_task
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"Delivery task ended with error: {e}")

    _delivery_task = None
    _delivery_service = None
    logger.info("WebSocket delivery background task stopped")


async def main():
    """Entry point"""
    service = WebSocketDeliveryService()
    await service.run()


if __name__ == "__main__":
    asyncio.run(main())
