"""
Message Pydantic Model
T038: Message data model
"""
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum


class SenderType(str, Enum):
    """Message sender type enum"""
    CUSTOMER = "customer"
    AI = "ai"
    HUMAN_AGENT = "human_agent"


class MessageBase(BaseModel):
    """Base message fields"""
    content: str = Field(..., min_length=1, max_length=10000)
    sender_type: SenderType


class MessageCreate(MessageBase):
    """Message creation model"""
    conversation_id: UUID
    tenant_id: UUID
    sender_id: UUID
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    retrieved_chunks: Optional[List[str]] = None  # List of chunk IDs
    metadata: dict = Field(default_factory=dict)

    @field_validator('confidence_score')
    @classmethod
    def validate_confidence_for_ai(cls, v, info):
        """Confidence score required for AI messages"""
        if info.data.get('sender_type') == SenderType.AI and v is None:
            raise ValueError('confidence_score required for AI messages')
        return v

    @field_validator('retrieved_chunks')
    @classmethod
    def validate_chunks_for_ai_rag(cls, v, info):
        """Retrieved chunks should be present for AI messages with RAG"""
        if info.data.get('sender_type') == SenderType.AI and info.data.get('confidence_score', 0) > 0:
            if not v:
                # Allow empty list but log warning
                pass
        return v


class Message(MessageBase):
    """Message database model"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    tenant_id: UUID
    sender_id: UUID
    timestamp: datetime
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    retrieved_chunks: Optional[List[str]] = None
    metadata: dict = Field(default_factory=dict)


class MessagePublic(BaseModel):
    """Public message information"""
    id: UUID
    conversation_id: UUID
    sender_type: SenderType
    content: str
    timestamp: datetime
    confidence_score: Optional[float] = None
    sources: Optional[List[dict]] = None  # Transformed from retrieved_chunks


class MessageWithSources(MessagePublic):
    """Message with populated source information"""
    sources: List[dict] = Field(default_factory=list)
