"""
Tickets API Endpoints
T105-T110: REST API for support tickets management
"""
import logging
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from src.api.middleware.auth import get_current_user, require_role
from src.models.ticket import (
    TicketPublic,
    TicketDetail,
    TicketCreate,
    TicketUpdate,
    TicketPriority,
    TicketStatus,
    CreationSource,
    Ticket
)
from src.services.ticket_service import TicketService
from src.services.chat_service import ChatService
from src.config.supabase import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/tickets", tags=["tickets"])


class TicketCreateManualRequest(BaseModel):
    """Schema for manual ticket creation request"""
    conversation_id: UUID
    priority: TicketPriority = TicketPriority.MEDIUM
    category: Optional[str] = None
    assigned_team: Optional[str] = None


class TicketUpdateRequest(BaseModel):
    """Schema for updating ticket properties"""
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_agent_id: Optional[UUID] = None
    assigned_team: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class SearchRequest(BaseModel):
    """Schema for ticket search request"""
    query: str = Field(..., min_length=1, max_length=200)


class PaginationInfo(BaseModel):
    """Pagination metadata"""
    total: int
    limit: int
    offset: int
    has_more: bool


class TicketListResponse(BaseModel):
    """Paginated list response of tickets"""
    data: List[TicketPublic]
    pagination: PaginationInfo


class ConversationMessagesResponse(BaseModel):
    """Conversation linked to ticket with history"""
    conversation: dict
    messages: List[dict]


@router.post("", response_model=TicketPublic, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    req: TicketCreateManualRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    T105: Create ticket manually
    """
    tenant_id = UUID(current_user["tenant_id"])
    
    # Verify conversation access
    conversation = await ChatService.get_conversation(req.conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
        
    # Check authorization: user must own conversation, or be support/admin
    if current_user["role"] == "customer" and str(conversation.customer_id) != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Check if conversation already has a ticket
    supabase = get_service_client()
    existing = supabase.table("tickets").select("id").eq("conversation_id", str(req.conversation_id)).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A support ticket already exists for this conversation"
        )

    # Generate initial summary from last message if available
    messages = await ChatService.get_conversation_messages(req.conversation_id, limit=5)
    ai_summary = "Manual ticket creation."
    if messages:
        ai_summary = f"Customer reported: '{messages[-1].content[:200]}'"

    ticket = await TicketService.create_ticket(
        TicketCreate(
            tenant_id=tenant_id,
            conversation_id=req.conversation_id,
            priority=req.priority,
            category=req.category,
            assigned_team=req.assigned_team,
            # A POST is always a human action, regardless of who made it.
            # AI_AUTO is reserved for the summarization/worker path.
            created_by=CreationSource.HUMAN_MANUAL,
            ai_summary=ai_summary
        )
    )
    
    # Resolve agent name for return model
    return TicketPublic(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        conversation_id=ticket.conversation_id,
        priority=ticket.priority,
        status=ticket.status,
        category=ticket.category,
        assigned_team=ticket.assigned_team,
        assigned_agent_id=ticket.assigned_agent_id,
        created_at=ticket.created_at,
        resolved_at=ticket.resolved_at,
        created_by=ticket.created_by,
        ai_summary=ticket.ai_summary
    )


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    conversation_id: Optional[UUID] = Query(None),
    assigned_to_me: Optional[bool] = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    T106: List tickets with filtering and pagination
    """
    tenant_id = UUID(current_user["tenant_id"])
    role = current_user["role"]

    supabase = get_service_client()
    query = supabase.table("tickets").select("*", count="exact").eq("tenant_id", str(tenant_id))

    # Apply filters based on role and parameters
    if role == "customer":
        # Fetch customer's conversations first
        customer_id = UUID(current_user["user_id"])
        convs = await ChatService.get_customer_conversations(customer_id, limit=100)
        conv_ids = [str(c.id) for c in convs]
        if not conv_ids:
            return TicketListResponse(
                data=[],
                pagination=PaginationInfo(total=0, limit=limit, offset=offset, has_more=False)
            )
        # Narrow to the requested conversation, but only if the customer owns it
        if conversation_id:
            if str(conversation_id) not in conv_ids:
                return TicketListResponse(
                    data=[],
                    pagination=PaginationInfo(total=0, limit=limit, offset=offset, has_more=False)
                )
            query = query.eq("conversation_id", str(conversation_id))
        else:
            query = query.in_("conversation_id", conv_ids)
    else:
        # Staff role filters (tenant scoping already applied above)
        if assigned_to_me:
            query = query.eq("assigned_agent_id", current_user["user_id"])
        if conversation_id:
            query = query.eq("conversation_id", str(conversation_id))

    if status:
        query = query.eq("status", status.value)
    if priority:
        query = query.eq("priority", priority.value)

    result = (
        query.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Resolve all agent names in one query instead of one per row (N+1)
    agent_ids = {row["assigned_agent_id"] for row in result.data if row.get("assigned_agent_id")}
    agent_names = {}
    if agent_ids:
        agent_res = supabase.table("customers").select("id, name").in_("id", list(agent_ids)).execute()
        agent_names = {
            str(a["id"]): (a.get("name") or "Agent") for a in (agent_res.data or [])
        }

    tickets = []
    for row in result.data:
        agent_name = None
        if row.get("assigned_agent_id"):
            agent_name = agent_names.get(str(row["assigned_agent_id"]))

        tickets.append(
            TicketPublic(
                id=row["id"],
                ticket_number=row["ticket_number"],
                conversation_id=row["conversation_id"],
                priority=TicketPriority(row["priority"]),
                status=TicketStatus(row["status"]),
                category=row.get("category"),
                assigned_team=row.get("assigned_team"),
                assigned_agent_id=row.get("assigned_agent_id"),
                assigned_agent_name=agent_name,
                created_at=row["created_at"],
                resolved_at=row.get("resolved_at"),
                created_by=CreationSource(row["created_by"]),
                ai_summary=row.get("ai_summary")
            )
        )

    total_count = result.count or len(tickets)
    has_more = (offset + limit) < total_count

    return TicketListResponse(
        data=tickets,
        pagination=PaginationInfo(
            total=total_count,
            limit=limit,
            offset=offset,
            has_more=has_more
        )
    )


@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(
    ticket_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    T107: Get ticket details by ID
    """
    ticket_detail = await TicketService.get_ticket_detail(ticket_id)
    if not ticket_detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Tenant isolation applies to every role, staff included
    if str(ticket_detail.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Permission check: customer must own the ticket
    if current_user["role"] == "customer":
        conversation = await ChatService.get_conversation(ticket_detail.conversation_id)
        if not conversation or str(conversation.customer_id) != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    return ticket_detail


@router.patch("/{ticket_id}", response_model=TicketPublic)
async def update_ticket(
    ticket_id: UUID,
    req: TicketUpdateRequest,
    current_user: dict = Depends(require_role(["support_agent", "admin", "manager"]))
):
    """
    T108: Update ticket properties (Staff only)
    """
    # Verify ticket belongs to tenant
    ticket = await TicketService.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
        
    if str(ticket.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Compile updates
    update_data = TicketUpdate(
        status=req.status,
        priority=req.priority,
        assigned_agent_id=req.assigned_agent_id,
        assigned_team=req.assigned_team,
        category=req.category
    )

    if req.notes:
        metadata = ticket.metadata or {}
        notes_list = metadata.get("notes") or []
        notes_list.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent_id": current_user["user_id"],
            "agent_name": current_user.get("name") or "Agent",
            "content": req.notes
        })
        metadata["notes"] = notes_list
        update_data.metadata = metadata

    actor_id = UUID(current_user["user_id"])
    actor_name = current_user.get("name") or "Agent"

    updated = await TicketService.update_ticket(
        ticket_id=ticket_id,
        update=update_data,
        actor_id=actor_id,
        actor_name=actor_name
    )

    return TicketPublic(
        id=updated.id,
        ticket_number=updated.ticket_number,
        conversation_id=updated.conversation_id,
        priority=updated.priority,
        status=updated.status,
        category=updated.category,
        assigned_team=updated.assigned_team,
        assigned_agent_id=updated.assigned_agent_id,
        created_at=updated.created_at,
        resolved_at=updated.resolved_at,
        created_by=updated.created_by,
        ai_summary=updated.ai_summary
    )


@router.get("/{ticket_id}/conversation", response_model=ConversationMessagesResponse)
async def get_ticket_conversation(
    ticket_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    T109: Get conversation and message transcript linked to ticket
    """
    ticket = await TicketService.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Tenant isolation applies to every role, staff included
    if str(ticket.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Permission check: customer must own the ticket
    conversation = await ChatService.get_conversation(ticket.conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked conversation not found"
        )
        
    if current_user["role"] == "customer" and str(conversation.customer_id) != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    messages = await ChatService.get_conversation_messages(ticket.conversation_id)

    return ConversationMessagesResponse(
        conversation={
            "id": str(conversation.id),
            "customer_id": str(conversation.customer_id),
            "status": conversation.status.value,
            "language": conversation.language,
            "started_at": conversation.started_at.isoformat() if conversation.started_at else None,
            "ended_at": conversation.ended_at.isoformat() if conversation.ended_at else None
        },
        messages=[
            {
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "sender_type": msg.sender_type.value,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "confidence_score": msg.confidence_score
            }
            for msg in messages
        ]
    )


@router.post("/search")
async def search_tickets(
    req: SearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    T110: Search tickets by number, category, or summary text
    """
    tenant_id = UUID(current_user["tenant_id"])
    role = current_user["role"]

    tickets = await TicketService.search_tickets(tenant_id, req.query)
    
    # Filter search results if role is customer
    if role == "customer":
        customer_id = UUID(current_user["user_id"])
        convs = await ChatService.get_customer_conversations(customer_id, limit=100)
        conv_ids = {str(c.id) for c in convs}
        tickets = [t for t in tickets if str(t.conversation_id) in conv_ids]

    results = []
    supabase = get_service_client()
    for row in tickets:
        agent_name = None
        if row.assigned_agent_id:
            agent_res = supabase.table("customers").select("name").eq("id", str(row.assigned_agent_id)).execute()
            if agent_res.data:
                agent_name = agent_res.data[0].get("name") or "Agent"
                
        results.append(
            TicketPublic(
                id=row.id,
                ticket_number=row.ticket_number,
                conversation_id=row.conversation_id,
                priority=row.priority,
                status=row.status,
                category=row.category,
                assigned_team=row.assigned_team,
                assigned_agent_id=row.assigned_agent_id,
                assigned_agent_name=agent_name,
                created_at=row.created_at,
                resolved_at=row.resolved_at,
                created_by=row.created_by,
                ai_summary=row.ai_summary
            )
        )

    return {"results": results}
