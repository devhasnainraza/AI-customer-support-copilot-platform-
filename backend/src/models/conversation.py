"""
Conversation Pydantic Model
T037: Conversation data model
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum


class ConversationStatus(str, Enum):
    """Conversation status enum"""
    ACTIVE = "active"
    CLOSED = "closed"
    ESCALATED = "escalated"
    ABANDONED = "abandoned"


class ConversationBase(BaseModel):
    """Base conversation fields"""
    language: str = Field(..., pattern="^[a-z]{2}$")  # ISO 639-1
    status: ConversationStatus = ConversationStatus.ACTIVE


class ConversationCreate(ConversationBase):
    """Conversation creation model"""
    customer_id: UUID
    tenant_id: UUID


class ConversationUpdate(BaseModel):
    """Conversation update model"""
    status: Optional[ConversationStatus] = None
    assigned_agent_id: Optional[UUID] = None
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5)
    ai_resolution: Optional[bool] = None
    ended_at: Optional[datetime] = None


class Conversation(ConversationBase):
    """Conversation database model"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    tenant_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    escalated_at: Optional[datetime] = None
    assigned_agent_id: Optional[UUID] = None
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5)
    ai_resolution: bool = False
    metadata: dict = Field(default_factory=dict)


class ConversationPublic(BaseModel):
    """Public conversation information"""
    id: UUID
    status: ConversationStatus
    language: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    ai_resolution: bool
