"""
Handoff API Routes — Talk-to-Human feature endpoints
Agent presence, handoff queue, internal notes, agent chat.
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from typing import Optional
from uuid import UUID, uuid4
import logging
import json

from pydantic import BaseModel

from src.api.middleware.auth import get_current_user, security
from src.services.handoff_service import agent_presence, handoff_manager
from src.services.chat_service import ChatService
from src.api.websockets.connection_manager import manager
from src.models.message import MessageCreate, SenderType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/handoff", tags=["handoff"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class HandoffRequestModel(BaseModel):
    conversation_id: str
    reason: str
    priority: str = "medium"
    context: dict = {}


class AssignAgentModel(BaseModel):
    agent_id: str


class InternalNoteModel(BaseModel):
    content: str


class AgentStatusModel(BaseModel):
    status: str  # online | away


# ---------------------------------------------------------------------------
# Agent Presence
# ---------------------------------------------------------------------------

@router.post("/agent/online")
async def agent_online(
    body: dict = {},
    current_user: dict = Depends(get_current_user),
):
    """Register agent as online."""
    agent_id = current_user["user_id"]
    agent_name = current_user.get("email", agent_id)
    role = current_user.get("role", "agent")
    await agent_presence.set_online(agent_id, agent_name, role)
    return {"status": "online", "agent_id": agent_id}


@router.post("/agent/status")
async def set_agent_status(
    body: AgentStatusModel,
    current_user: dict = Depends(get_current_user),
):
    """Set agent status (online | away)."""
    agent_id = current_user["user_id"]
    if body.status == "away":
        await agent_presence.set_away(agent_id)
    else:
        await agent_presence.set_online(agent_id, current_user.get("email", agent_id), current_user.get("role", "agent"))
    return {"status": body.status, "agent_id": agent_id}


@router.post("/agent/disconnect")
async def agent_disconnect(
    current_user: dict = Depends(get_current_user),
):
    """Disconnect agent."""
    agent_id = current_user["user_id"]
    await agent_presence.disconnect(agent_id)
    return {"status": "disconnected"}


@router.get("/agents")
async def list_agents(current_user: dict = Depends(get_current_user)):
    """List all registered agents and their status."""
    return {"agents": agent_presence.get_all_agents(), "count": agent_presence.get_online_count()}


# ---------------------------------------------------------------------------
# Handoff Queue
# ---------------------------------------------------------------------------

@router.post("/request")
async def request_handoff(
    body: HandoffRequestModel,
    current_user: dict = Depends(get_current_user),
):
    """Customer requests human agent handoff."""
    conversation_id = body.conversation_id
    customer_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]

    # Fetch conversation to get sentiment context
    from uuid import UUID as _UUID
    try:
        conv = await ChatService.get_conversation(_UUID(conversation_id))
        context = body.context.copy()
        if conv:
            context["language"] = getattr(conv, "language", "en")
    except Exception:
        context = body.context

    # Determine priority from reason
    priority = body.priority
    if "angry" in body.reason.lower() or "frustrated" in body.reason.lower():
        priority = "high"
    if "urgent" in body.reason.lower() or "critical" in body.reason.lower():
        priority = "critical"

    request = await handoff_manager.request_handoff(
        conversation_id=conversation_id,
        customer_id=customer_id,
        tenant_id=tenant_id,
        reason=body.reason,
        priority=priority,
        context=context,
    )

    # Notify all agents about new handoff
    try:
        await manager.send_personal_message(
            {
                "type": "handoff_notification",
                "handoff": request.to_dict(),
            },
            "__agent_broadcast__",
        )
    except Exception:
        pass

    return request.to_dict()


@router.get("/queue")
async def get_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
):
    """Get the handoff queue (agents only)."""
    return {"queue": handoff_manager.get_queue(status_filter)}


@router.get("/queue/stats")
async def get_queue_stats(current_user: dict = Depends(get_current_user)):
    """Get handoff queue statistics."""
    return handoff_manager.get_stats()


@router.get("/request/{conversation_id}")
async def get_handoff_request(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get handoff request details for a conversation."""
    request = handoff_manager.get_request(conversation_id)
    if not request:
        raise HTTPException(status_code=404, detail="No handoff request found")
    return request


@router.post("/request/{conversation_id}/assign")
async def assign_agent_to_handoff(
    conversation_id: str,
    body: AssignAgentModel,
    current_user: dict = Depends(get_current_user),
):
    """Agent claims a handoff from the queue."""
    success = await handoff_manager.assign_agent(conversation_id, body.agent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot assign — request not found or already assigned")
    # Mark agent as busy
    await agent_presence.set_busy(body.agent_id, conversation_id)
    request = handoff_manager.get_request(conversation_id)
    return request


@router.post("/request/{conversation_id}/start")
async def start_handoff_chat(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Agent starts actively chatting."""
    await handoff_manager.start_chat(conversation_id)
    return {"status": "in_progress"}


@router.post("/request/{conversation_id}/resolve")
async def resolve_handoff(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark handoff as resolved."""
    await handoff_manager.resolve_handoff(conversation_id)
    # Free the agent
    agent_id = current_user["user_id"]
    await agent_presence.set_online_from_busy(agent_id)
    return {"status": "resolved"}


@router.post("/request/{conversation_id}/cancel")
async def cancel_handoff(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a handoff request."""
    await handoff_manager.cancel_handoff(conversation_id)
    return {"status": "cancelled"}


# ---------------------------------------------------------------------------
# Internal Notes
# ---------------------------------------------------------------------------

@router.post("/request/{conversation_id}/notes")
async def add_internal_note(
    conversation_id: str,
    body: InternalNoteModel,
    current_user: dict = Depends(get_current_user),
):
    """Add an internal note to a handoff (visible to agents only)."""
    agent_id = current_user["user_id"]
    agent_name = current_user.get("email", agent_id)
    success = await handoff_manager.add_internal_note(conversation_id, agent_id, body.content, agent_name)
    if not success:
        raise HTTPException(status_code=404, detail="Handoff request not found")
    request = handoff_manager.get_request(conversation_id)
    return {"notes": request.get("internal_notes", []) if request else []}


# ---------------------------------------------------------------------------
# Agent WebSocket — real-time chat with customers during handoff
# ---------------------------------------------------------------------------

@router.websocket("/ws/agent")
async def agent_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    Agent-side WebSocket for real-time handoff chat.

    Protocol:
        Agent -> Server: { "type": "message", "conversation_id": "...", "content": "..." }
        Agent -> Server: { "type": "typing", "conversation_id": "...", "is_typing": true }
        Server -> Agent: { "type": "message", "conversation_id": "...", "sender": "customer"|"ai", "content": "..." }
        Server -> Agent: { "type": "handoff_notification", "handoff": {...} }
        Server -> Agent: { "type": "agent_typing", "conversation_id": "...", "is_typing": true }
    """
    connection_id = str(uuid4())

    try:
        from src.api.middleware.auth import verify_token
        from fastapi.security import HTTPAuthorizationCredentials

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await verify_token(credentials)
        agent_id = user["user_id"]
        agent_name = user.get("email", agent_id)

        # Register agent presence
        await agent_presence.set_online(agent_id, agent_name, user.get("role", "agent"))

        # Connect with agent flag
        await manager.connect(
            websocket=websocket,
            connection_id=connection_id,
            user_id=agent_id,
            conversation_id=None,
        )

        # Store agent connection for broadcast
        manager.connection_metadata[connection_id]["is_agent"] = True
        manager.connection_metadata[connection_id]["agent_id"] = agent_id

        # Send welcome + queue state
        await manager.send_personal_message(
            {
                "type": "agent_connected",
                "agent_id": agent_id,
                "queue": handoff_manager.get_queue("waiting"),
                "agents": agent_presence.get_all_agents(),
            },
            connection_id,
        )

        # Listen for agent messages
        while True:
            data = await websocket.receive_text()

            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                if msg_type == "message":
                    content = msg.get("content", "").strip()
                    conv_id = msg.get("conversation_id")
                    if not content or not conv_id:
                        continue

                    # Save agent message
                    await ChatService.create_message(
                        MessageCreate(
                            conversation_id=UUID(conv_id),
                            tenant_id=UUID(user["tenant_id"]),
                            sender_id=UUID(agent_id),
                            sender_type=SenderType.HUMAN_AGENT,
                            content=content,
                        )
                    )

                    # Broadcast to customer
                    await manager.send_to_conversation(
                        {
                            "type": "message",
                            "sender": "human_agent",
                            "sender_type": "human_agent",
                            "content": content,
                            "agent_name": agent_name,
                            "timestamp": msg.get("timestamp", ""),
                        },
                        conv_id,
                    )

                elif msg_type == "typing":
                    conv_id = msg.get("conversation_id")
                    if conv_id:
                        await manager.send_to_conversation(
                            {
                                "type": "agent_typing",
                                "is_typing": msg.get("is_typing", True),
                                "agent_name": agent_name,
                            },
                            conv_id,
                        )

                elif msg_type == "claim":
                    conv_id = msg.get("conversation_id")
                    if conv_id:
                        success = await handoff_manager.assign_agent(conv_id, agent_id)
                        if success:
                            await agent_presence.set_busy(agent_id, conv_id)
                            await manager.send_personal_message(
                                {"type": "claim_success", "conversation_id": conv_id},
                                connection_id,
                            )

                elif msg_type == "resolve":
                    conv_id = msg.get("conversation_id")
                    if conv_id:
                        await handoff_manager.resolve_handoff(conv_id)
                        await agent_presence.set_online_from_busy(agent_id)

                elif msg_type == "heartbeat":
                    await agent_presence.heartbeat(agent_id)

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        await agent_presence.disconnect(agent_id)
        manager.disconnect(connection_id)

    except Exception as e:
        logger.error(f"Agent WebSocket error: {e}")
        await agent_presence.disconnect(agent_id)
        manager.disconnect(connection_id)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
