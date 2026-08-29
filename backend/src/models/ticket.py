"""
Ticket Pydantic Model
T099: Ticket data models for tracking support requests
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum


class TicketPriority(str, Enum):
    """Ticket urgency priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, Enum):
    """Support ticket workflow states"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_CUSTOMER = "waiting_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


class CreationSource(str, Enum):
    """Origin of support ticket"""
    AI_AUTO = "ai_auto"
    HUMAN_MANUAL = "human_manual"


class TicketBase(BaseModel):
    """Base support ticket fields"""
    priority: TicketPriority = TicketPriority.MEDIUM
    category: Optional[str] = None
    assigned_team: Optional[str] = None


class TicketCreate(TicketBase):
    """Ticket creation model"""
    tenant_id: UUID
    conversation_id: UUID
    created_by: CreationSource = CreationSource.AI_AUTO
    ai_summary: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class TicketUpdate(BaseModel):
    """Ticket update model"""
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_agent_id: Optional[UUID] = None
    assigned_team: Optional[str] = None
    category: Optional[str] = None
    ai_summary: Optional[str] = None
    resolved_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class Ticket(TicketBase):
    """Ticket database schema representation"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    conversation_id: UUID
    ticket_number: str
    status: TicketStatus
    assigned_agent_id: Optional[UUID] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    created_by: CreationSource
    ai_summary: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class TicketPublic(TicketBase):
    """Public ticket schema (for API responses)"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    conversation_id: UUID
    status: TicketStatus
    assigned_agent_id: Optional[UUID] = None
    assigned_agent_name: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    created_by: CreationSource
    ai_summary: Optional[str] = None


class TicketTimelineItem(BaseModel):
    """Timeline entry tracking ticket state transitions"""
    timestamp: datetime
    event: str
    from_value: Optional[str] = None
    to_value: str
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None


class TicketDetail(TicketPublic):
    """Complete ticket details including customer info and timeline history"""
    tenant_id: UUID
    customer: dict = Field(..., description="Customer id, name, and email")
    conversation_preview: dict = Field(..., description="Message count and preview info")
    timeline: List[TicketTimelineItem] = Field(default_factory=list)
    notes: List[dict] = Field(default_factory=list)
