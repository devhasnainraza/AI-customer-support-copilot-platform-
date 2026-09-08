"""
Chat API Endpoints
T049-T052: REST API for conversations and messages
T054: WebSocket endpoint for real-time chat
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from typing import List, Optional
from uuid import UUID, uuid4
import logging
import json

from pydantic import BaseModel

from src.api.middleware.auth import get_current_user, security
from src.models.conversation import (
    Conversation,
    ConversationCreate,
    ConversationPublic
)
from src.models.message import Message, MessagePublic, MessageCreate, SenderType
from src.services.chat_service import ChatService
from src.services.language_detection_service import LanguageDetectionService
from src.services.kafka_producer import send_kafka_event
from src.api.websockets.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class ConversationCreateRequest(BaseModel):
    """Request body for creating a conversation"""
    initial_message: Optional[str] = None
    language: Optional[str] = None


@router.post("/conversations", response_model=ConversationPublic, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    req: ConversationCreateRequest = ConversationCreateRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    T049: Create a new conversation

    Args:
        req: Optional initial_message (for language detection) and explicit language
        current_user: Authenticated user

    Returns:
        Created conversation
    """
    initial_message = req.initial_message
    language = req.language

    try:
        # Detect language from initial message if not provided
        if not language and initial_message:
            detected_lang, confidence = LanguageDetectionService.detect_language(
                initial_message
            )
            language = detected_lang
            logger.info(f"Language detected: {language} (confidence: {confidence:.2f})")
        elif not language:
            language = current_user.get("language_preference", "en")

        # Validate language
        if not LanguageDetectionService.is_language_supported(language):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Language '{language}' not supported"
            )

        # Resolve effective customer_id
        cust_id_raw = current_user.get("customer_id") or current_user.get("user_id")
        tenant_id_raw = current_user.get("tenant_id") or "00000000-0000-0000-0000-000000000000"

        # Create conversation
        conversation = await ChatService.create_conversation(
            customer_id=UUID(str(cust_id_raw)),
            tenant_id=UUID(str(tenant_id_raw)),
            language=language
        )

        return ConversationPublic(
            id=conversation.id,
            status=conversation.status,
            language=conversation.language,
            started_at=conversation.started_at,
            ended_at=conversation.ended_at,
            ai_resolution=conversation.ai_resolution
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )


@router.get("/conversations", response_model=List[ConversationPublic])
async def get_conversations(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    T050: Get all conversations for current user
    """
    try:
        cid = UUID(str(current_user["customer_id"])) if "customer_id" in current_user else UUID(str(current_user["user_id"]))
        alt_id = UUID(str(current_user["user_id"])) if "customer_id" in current_user else None

        conversations = await ChatService.get_customer_conversations(
            customer_id=cid,
            alternate_customer_id=alt_id,
            limit=limit
        )

        return [
            ConversationPublic(
                id=conv.id,
                status=conv.status,
                language=conv.language,
                started_at=conv.started_at,
                ended_at=conv.ended_at,
                ai_resolution=conv.ai_resolution
            )
            for conv in conversations
        ]

    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversations"
        )


@router.get("/conversations/{conversation_id}", response_model=ConversationPublic)
async def get_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    T051: Get a specific conversation
    """
    try:
        conversation = await ChatService.get_conversation(conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        # Verify access: allow if user owns the conversation or has staff role
        is_staff = current_user.get("role") in ("admin", "manager", "agent", "support_agent")
        user_ids = {str(current_user.get("user_id")), str(current_user.get("customer_id"))} - {None, ""}
        if not is_staff and str(conversation.customer_id) not in user_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        return ConversationPublic(
            id=conversation.id,
            status=conversation.status,
            language=conversation.language,
            started_at=conversation.started_at,
            ended_at=conversation.ended_at,
            ai_resolution=conversation.ai_resolution
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation"
        )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessagePublic])
async def get_conversation_messages(
    conversation_id: UUID,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    T052: Get all messages for a conversation

    Args:
        conversation_id: Conversation UUID
        limit: Maximum number of messages
        current_user: Authenticated user

    Returns:
        List of messages
    """
    try:
        # Verify conversation access
        conversation = await ChatService.get_conversation(conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        # Verify access: allow if user owns the conversation or has staff role
        is_staff = current_user.get("role") in ("admin", "manager", "agent", "support_agent")
        user_ids = {str(current_user.get("user_id")), str(current_user.get("customer_id"))} - {None, ""}
        if not is_staff and str(conversation.customer_id) not in user_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Get messages
        messages = await ChatService.get_conversation_messages(
            conversation_id,
            limit=limit
        )

        result_messages = []
        for msg in messages:
            msg_metadata = msg.metadata if isinstance(msg.metadata, dict) else {}
            agent_name = msg_metadata.get("agent_name")
            if not agent_name and msg.sender_type == SenderType.HUMAN_AGENT:
                agent_name = "Support Specialist"

            result_messages.append(
                MessagePublic(
                    id=msg.id,
                    conversation_id=msg.conversation_id,
                    sender_type=msg.sender_type,
                    content=msg.content,
                    timestamp=msg.timestamp,
                    confidence_score=msg.confidence_score,
                    agent_name=agent_name,
                    metadata=msg_metadata,
                )
            )

        return result_messages

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get messages for conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve messages"
        )


class MessagePostRequest(BaseModel):
    content: str


@router.post("/conversations/{conversation_id}/messages", response_model=MessagePublic, status_code=status.HTTP_201_CREATED)
async def post_conversation_message(
    conversation_id: UUID,
    req: MessagePostRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Post a message to a conversation via REST (agent or customer).
    Broadcasts in real-time to active WebSocket clients.
    """
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    user_id = current_user["user_id"]
    role = current_user.get("role", "customer")

    # Check conversation ownership to ensure human agent is never misidentified as customer
    is_conv_customer = False
    try:
        conv = await ChatService.get_conversation(conversation_id)
        if conv:
            cust_ids = {str(conv.customer_id)}
            user_ids = {str(user_id), str(current_user.get("customer_id"))} - {None, ""}
            if bool(cust_ids & user_ids):
                is_conv_customer = True
    except Exception:
        pass

    if role in ("agent", "admin", "manager") or not is_conv_customer:
        sender_type = SenderType.HUMAN_AGENT
        sender_name = current_user.get("email", "Support Specialist")
    else:
        sender_type = SenderType.CUSTOMER
        sender_name = current_user.get("email", "Customer")

    msg = await ChatService.create_message(
        MessageCreate(
            conversation_id=conversation_id,
            tenant_id=UUID(current_user.get("tenant_id") or "00000000-0000-0000-0000-000000000000"),
            sender_id=UUID(user_id),
            sender_type=sender_type,
            content=content,
        )
    )

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    msg_payload = {
        "type": "message",
        "sender": "human_agent" if sender_type == SenderType.HUMAN_AGENT else "customer",
        "sender_type": "human_agent" if sender_type == SenderType.HUMAN_AGENT else "customer",
        "content": content,
        "agent_name": sender_name if sender_type == SenderType.HUMAN_AGENT else None,
        "message_id": str(msg.id),
        "id": str(msg.id),
        "conversation_id": str(conversation_id),
        "timestamp": now_iso,
    }
    await manager.send_to_conversation(msg_payload, str(conversation_id))
    await manager.broadcast_to_agents(msg_payload)

    return MessagePublic(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_type=msg.sender_type,
        content=msg.content,
        timestamp=msg.timestamp,
        confidence_score=msg.confidence_score,
    )
