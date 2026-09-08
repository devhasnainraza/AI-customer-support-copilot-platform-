import json
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from src.api.websockets.connection_manager import manager
from src.models.message import MessageCreate, SenderType
from src.services.chat_service import ChatService
from src.services.kafka_producer import send_kafka_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/chat", tags=["websocket"])

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str = Query(...),
    token: str = Query(...)
):
    """
    T054: WebSocket endpoint for real-time chat

    Args:
        websocket: WebSocket connection
        conversation_id: Conversation UUID
        token: JWT authentication token

    Protocol:
        Client -> Server: { "type": "message", "content": "..." }
        Server -> Client: { "type": "message", "sender": "ai", "content": "...", "confidence": 0.95 }
        Server -> Client: { "type": "typing", "is_typing": true }
        Server -> Client: { "type": "error", "message": "..." }
    """
    connection_id = str(uuid4())

    try:
        # Authenticate user from token
        from src.api.middleware.auth import verify_token
        from fastapi.security import HTTPAuthorizationCredentials

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await verify_token(credentials)

        user_id = user["user_id"]
        tenant_id = user["tenant_id"]

        # Verify conversation access
        conversation = await ChatService.get_conversation(UUID(conversation_id))

        if not conversation:
            await websocket.close(code=1008, reason="Conversation not found")
            return

        # Verify conversation access: allow if user owns the conversation or has staff role
        is_staff = user.get("role") in ("admin", "manager", "agent")
        user_ids = {str(user.get("user_id")), str(user.get("customer_id"))} - {None, ""}
        allowed = is_staff or str(conversation.customer_id) in user_ids

        if not allowed:
            # Fallback: check if conversation customer matches authenticated user's email
            try:
                from src.config.supabase import get_service_client
                supabase = get_service_client()
                cust_res = supabase.table("customers").select("email, auth_id").eq("id", str(conversation.customer_id)).limit(1).execute()
                if cust_res.data:
                    cust_row = cust_res.data[0]
                    if cust_row.get("email") == user.get("email") or str(cust_row.get("auth_id")) == str(user.get("user_id")):
                        allowed = True
            except Exception:
                pass

        if not allowed:
            logger.warning(f"WebSocket access denied for conv {conversation_id}: conv.customer_id={conversation.customer_id}, allowed_ids={user_ids}")
            await websocket.close(code=1008, reason="Access denied")
            return

        # Accept connection
        await manager.connect(
            websocket=websocket,
            connection_id=connection_id,
            user_id=user_id,
            conversation_id=conversation_id
        )

        # Send welcome message
        await manager.send_personal_message(
            {
                "type": "connected",
                "conversation_id": conversation_id,
                "message": "Connected to chat"
            },
            connection_id
        )

        # Send current handoff state if conversation is in handoff
        from src.services.handoff_service import handoff_manager
        current_handoff = handoff_manager.get_request(conversation_id)
        if current_handoff and current_handoff.get("status") in ("waiting", "assigned", "in_progress"):
            await manager.send_personal_message(
                {
                    "type": "handoff_notification",
                    "handoff": current_handoff,
                },
                connection_id
            )

        # Listen for messages
        while True:
            # Receive message from client
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)

                if message_data.get("type") == "message":
                    content = message_data.get("content", "").strip()

                    if not content:
                        continue

                    # Save customer message
                    customer_message = await ChatService.create_message(
                        MessageCreate(
                            conversation_id=UUID(conversation_id),
                            tenant_id=UUID(tenant_id),
                            sender_id=UUID(user_id),
                            sender_type=SenderType.CUSTOMER,
                            content=content
                        )
                    )

                    # Emit to Kafka for AI processing if Kafka is running
                    try:
                        send_kafka_event(
                            topic="chat-events",
                            event_type="message.created",
                            payload={
                                "message_id": str(customer_message.id),
                                "conversation_id": conversation_id,
                                "customer_id": user_id,
                                "content": content,
                                "language": conversation.language
                            },
                            tenant_id=tenant_id,
                            correlation_id=str(customer_message.id)
                        )
                    except Exception as kafka_err:
                        logger.warning(f"Kafka unavailable ({kafka_err}), proceeding with in-process AI execution")

                    logger.info(
                        f"Message received: conversation={conversation_id}, message={customer_message.id}"
                    )

                    # Check if conversation is in human-handoff — skip AI
                    from src.services.handoff_service import handoff_manager
                    handoff = handoff_manager.get_request(conversation_id)
                    is_human_chat = handoff and handoff.get("status") in ("waiting", "assigned", "in_progress")

                    if is_human_chat:
                        # Broadcast customer message to all connected agents
                        from datetime import datetime, timezone
                        msg_payload = {
                            "type": "message",
                            "conversation_id": conversation_id,
                            "sender": "customer",
                            "sender_type": "customer",
                            "content": content,
                            "message_id": str(customer_message.id),
                            "id": str(customer_message.id),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        await manager.broadcast_to_agents(msg_payload)

                        # If in waiting queue, acknowledge waiting status
                        if handoff.get("status") == "waiting":
                            await manager.send_to_conversation(
                                {
                                    "type": "handoff_notification",
                                    "handoff": handoff,
                                },
                                conversation_id,
                            )
                        continue  # Don't trigger AI in human handoff mode

                    # Send typing indicator
                    await manager.send_to_conversation(
                        {"type": "typing", "is_typing": True},
                        conversation_id
                    )

                    # Trigger in-process AI execution as background task
                    import asyncio
                    async def _trigger_in_process_ai(p: dict):
                        try:
                            from src.workers.ai_inference_worker import AIInferenceWorker
                            worker = AIInferenceWorker()
                            await worker.process_message_event({"payload": p})
                        except Exception as e:
                            logger.error(f"In-process AI execution error: {e}", exc_info=True)

                    payload = {
                        "message_id": str(customer_message.id),
                        "conversation_id": conversation_id,
                        "customer_id": user_id,
                        "content": content,
                        "language": conversation.language,
                        "tenant_id": tenant_id
                    }
                    asyncio.create_task(_trigger_in_process_ai(payload))

            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {data}")
                await manager.send_personal_message(
                    {"type": "error", "message": "Invalid message format"},
                    connection_id
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
        manager.disconnect(connection_id)

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(connection_id)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass
