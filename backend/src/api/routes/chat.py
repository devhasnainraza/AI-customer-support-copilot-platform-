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

        # Create conversation
        conversation = await ChatService.create_conversation(
            customer_id=UUID(current_user["user_id"]),
            tenant_id=UUID(current_user["tenant_id"]),
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

    Args:
        limit: Maximum number of conversations to return
        current_user: Authenticated user

    Returns:
        List of conversations
    """
    try:
        conversations = await ChatService.get_customer_conversations(
            customer_id=UUID(current_user["user_id"]),
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

    Args:
        conversation_id: Conversation UUID
        current_user: Authenticated user

    Returns:
        Conversation details
    """
    try:
        conversation = await ChatService.get_conversation(conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        # Verify access (user owns the conversation)
        if str(conversation.customer_id) != current_user["user_id"]:
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

        if str(conversation.customer_id) != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Get messages
        messages = await ChatService.get_conversation_messages(
            conversation_id,
            limit=limit
        )

        return [
            MessagePublic(
                id=msg.id,
                conversation_id=msg.conversation_id,
                sender_type=msg.sender_type,
                content=msg.content,
                timestamp=msg.timestamp,
                confidence_score=msg.confidence_score
            )
            for msg in messages
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get messages for conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve messages"
        )
