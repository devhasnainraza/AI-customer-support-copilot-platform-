"""
AI Inference Worker - Kafka Consumer for Chat Events
T056-T058: Processes messages through LangGraph workflow and emits responses
"""
import asyncio
from kafka import KafkaConsumer
from kafka.errors import KafkaError
import json
import logging
from uuid import UUID

from src.config.settings import settings
from src.agents.graph import run_agent_workflow, AgentState, set_step_callback, clear_step_callback
from src.models.message import MessageCreate, SenderType
from src.services.chat_service import ChatService
from src.services.kafka_producer import send_kafka_event

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class AIInferenceWorker:
    """
    Worker that consumes chat-events and runs AI inference via LangGraph
    """

    def __init__(self):
        self.consumer = None
        self.running = False

    def create_consumer(self):
        """Create Kafka consumer"""
        try:
            self.consumer = KafkaConsumer(
                'chat-events',
                bootstrap_servers=settings.kafka_bootstrap_servers.split(','),
                group_id=settings.kafka_consumer_group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                max_poll_records=settings.ai_inference_worker_concurrency
            )
            logger.info(f"Kafka consumer connected to {settings.kafka_bootstrap_servers}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to create Kafka consumer: {e}")
            return False

    async def process_message_event(self, event: dict):
        """
        Process a single message.created event through LangGraph workflow

        Args:
            event: Kafka event data
        """
        try:
            payload = event.get('payload', {})
            message_id = payload.get('message_id')
            conversation_id = payload.get('conversation_id')
            content = payload.get('content')
            language = payload.get('language', 'en')
            tenant_id = payload.get('tenant_id') or event.get('tenant_id')
            customer_id = payload.get('customer_id')

            logger.info(
                f"Processing message: conversation={conversation_id}, "
                f"message={message_id}"
            )

            # Load recent history so the bot has memory of the conversation.
            # The newest message is the one being answered, so it is dropped.
            history = []
            try:
                recent = await ChatService.get_conversation_messages(
                    UUID(conversation_id), limit=10
                )
                for msg in recent:
                    if message_id and str(msg.id) == str(message_id):
                        continue
                    sender = msg.sender_type.value if hasattr(msg.sender_type, "value") else str(msg.sender_type)
                    history.append({"role": sender, "content": msg.content})
            except Exception as hist_err:
                logger.warning(f"Failed to load conversation history: {hist_err}")

            # Prepare initial state for LangGraph
            initial_state: AgentState = {
                'conversation_id': UUID(conversation_id),
                'customer_id': UUID(customer_id),
                'tenant_id': UUID(tenant_id),
                'language': language,
                'user_message': content,
                'messages': history,
                'intent': None,
                'requires_retrieval': True,
                'retrieved_chunks': [],
                'retrieval_successful': False,
                'ai_response': None,
                'confidence_score': 0.0,
                'should_escalate': False,
                'escalation_reason': None,
                # Sentiment analysis
                'sentiment': None,
                'sentiment_urgency': None,
                'emotional_cues': [],
                # Tool-use
                'tool_calls': [],
                'tool_results': [],
                'tools_used': [],
                # Reflection
                'reflection_passed': True,
                'reflection_issues': [],
                'reflection_action': None,
                'original_response': None,
                # Follow-up suggestions
                'suggested_followups': [],
                # Handoff priority
                'handoff_priority': None,
                # Metadata
                'error': None,
                'step_count': 0
            }

            # Set up step callback to emit agent status via WebSocket
            from src.api.websockets.connection_manager import manager as ws_manager

            async def emit_agent_status(display_name):
                try:
                    await ws_manager.send_to_conversation(
                        {"type": "typing", "is_typing": True, "agent": display_name},
                        conversation_id
                    )
                except Exception:
                    pass

            set_step_callback(emit_agent_status)

            # Run LangGraph workflow (T057) with timeout
            final_state = {}
            try:
                final_state = await asyncio.wait_for(run_agent_workflow(initial_state), timeout=15.0)
            except asyncio.TimeoutError:
                logger.error(f"LangGraph workflow timed out for conversation {conversation_id}")
                user_text = (content or "").lower()
                is_esc = any(kw in user_text for kw in ["human", "agent", "person", "specialist", "representative"])
                if is_esc:
                    final_state = {
                        'intent': 'escalation_request',
                        'should_escalate': True,
                        'ai_response': "I am transferring your request to our live human support team right away. A support specialist has been notified and will assist you shortly.",
                        'confidence_score': 1.0,
                    }
                else:
                    final_state = {
                        'intent': 'question',
                        'should_escalate': False,
                        'ai_response': "I apologize for the delay. I am ready to help—please let me know what questions or issues you are experiencing.",
                        'confidence_score': 0.8,
                    }
            except Exception as graph_err:
                logger.error(f"LangGraph execution error: {graph_err}", exc_info=True)
                final_state = {
                    'intent': 'other',
                    'should_escalate': False,
                    'ai_response': "I apologize, but I encountered a temporary error. Please let me know how I can help or click 'Talk to Human' to reach a specialist.",
                    'confidence_score': 0.5,
                }
            finally:
                clear_step_callback()
                try:
                    # Explicitly turn off typing indicator
                    await ws_manager.send_to_conversation(
                        {"type": "typing", "is_typing": False},
                        conversation_id
                    )
                except Exception:
                    pass

            # Extract results
            ai_response = final_state.get('ai_response')
            confidence_score = final_state.get('confidence_score', 0.0)
            should_escalate = final_state.get('should_escalate', False)
            retrieved_chunks = final_state.get('retrieved_chunks', [])

            if not ai_response:
                logger.error(f"No AI response generated for message {message_id}")
                ai_response = "I apologize, but I'm having trouble processing your request."
                confidence_score = 0.0

            # Save AI response message
            chunk_ids = [chunk['id'] for chunk in retrieved_chunks] if retrieved_chunks else None

            ai_message = await ChatService.create_message(
                MessageCreate(
                    conversation_id=UUID(conversation_id),
                    tenant_id=UUID(tenant_id),
                    sender_id=UUID(customer_id),  # System user ID in production
                    sender_type=SenderType.AI,
                    content=ai_response,
                    confidence_score=confidence_score,
                    retrieved_chunks=chunk_ids,
                    metadata={
                        'intent': final_state.get('intent'),
                        'step_count': final_state.get('step_count'),
                        'error': final_state.get('error')
                    }
                )
            )

            logger.info(
                f"AI response generated: message={ai_message.id}, "
                f"confidence={confidence_score:.2f}, "
                f"should_escalate={should_escalate}"
            )

            # Direct WebSocket broadcast for in-process delivery
            from datetime import datetime, timezone
            manager = ws_manager

            sources_list = [
                {
                    'chunk_id': chunk['id'],
                    'similarity': chunk['similarity'],
                    'content': chunk['content'][:200]
                }
                for chunk in retrieved_chunks[:3]
            ] if retrieved_chunks else []

            # Extract follow-up suggestions and sentiment from final state
            followups = final_state.get('suggested_followups', [])
            sentiment = final_state.get('sentiment', None)
            sentiment_urgency = final_state.get('sentiment_urgency', None)
            tools_used = final_state.get('tools_used', [])

            # Include handoff info if active
            handoff_info = None
            try:
                from src.services.handoff_service import handoff_manager as hm
                h_req = hm.get_request(conversation_id)
                if h_req and h_req.get('status') in ('waiting', 'assigned', 'in_progress'):
                    handoff_info = {
                        'status': h_req['status'],
                        'assigned_agent': h_req.get('assigned_agent_id'),
                        'reason': h_req.get('reason'),
                        'priority': h_req.get('priority'),
                    }
            except Exception:
                pass

            try:
                await manager.send_to_conversation(
                    {
                        "type": "message",
                        "sender": "ai",
                        "sender_type": "ai",
                        "message_id": str(ai_message.id),
                        "id": str(ai_message.id),
                        "conversation_id": conversation_id,
                        "content": ai_response,
                        "confidence": confidence_score,
                        "confidence_score": confidence_score,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "sources": sources_list,
                        "suggested_followups": followups,
                        "sentiment": sentiment,
                        "sentiment_urgency": sentiment_urgency,
                        "tools_used": tools_used,
                        "handoff": handoff_info,
                    },
                    conversation_id
                )
            except Exception as ws_err:
                logger.warning(f"Failed direct WebSocket broadcast: {ws_err}")

            # Emit response event to chat-responses topic (T058)
            try:
                send_kafka_event(
                    topic='chat-responses',
                    event_type='message.ai_response_ready',
                    payload={
                        'message_id': str(ai_message.id),
                        'conversation_id': conversation_id,
                        'content': ai_response,
                        'confidence_score': confidence_score,
                        'should_escalate': should_escalate,
                        'escalation_reason': final_state.get('escalation_reason'),
                        'sources': sources_list
                    },
                    tenant_id=tenant_id,
                    correlation_id=event.get('correlation_id')
                )
            except Exception as k_err:
                logger.debug(f"Kafka unavailable for event emission: {k_err}")

            # If escalation needed, emit escalation event
            if should_escalate:
                try:
                    send_kafka_event(
                        topic='ticket-events',
                        event_type='escalation.triggered',
                        payload={
                            'conversation_id': conversation_id,
                            'reason': final_state.get('escalation_reason'),
                            'confidence_score': confidence_score
                        },
                        tenant_id=tenant_id
                    )
                except Exception as k_err:
                    logger.debug(f"Kafka unavailable for escalation emission: {k_err}")

        except Exception as e:
            logger.error(f"Failed to process message event: {e}", exc_info=True)

    async def run(self):
        """Main worker loop"""
        logger.info("AI Inference Worker starting...")

        if not self.create_consumer():
            logger.error("Failed to initialize consumer, exiting")
            return

        self.running = True
        logger.info(
            f"AI Inference Worker ready - consuming from 'chat-events' topic "
            f"(concurrency: {settings.ai_inference_worker_concurrency})"
        )

        try:
            while self.running:
                # Poll for messages off the event loop (consumer.poll blocks)
                messages = await asyncio.to_thread(self.consumer.poll, timeout_ms=1000)

                if not messages:
                    continue

                # Process messages
                tasks = []
                for topic_partition, records in messages.items():
                    for record in records:
                        event = record.value

                        # Check event type
                        if event.get('event_type') == 'message.created':
                            task = asyncio.create_task(
                                self.process_message_event(event)
                            )
                            tasks.append(task)

                # Wait for all tasks to complete
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
            logger.info("AI Inference Worker stopped")


async def main():
    """Entry point"""
    worker = AIInferenceWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
