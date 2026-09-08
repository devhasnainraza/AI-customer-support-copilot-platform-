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


class SendMessageModel(BaseModel):
    content: str


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
    """List all registered agents and their status, merged with staff profiles."""
    from src.config.supabase import get_service_client
    live_agents = {a["agent_id"]: a for a in agent_presence.get_all_agents()}
    staff_list = []

    try:
        supabase = get_service_client()
        res = supabase.table("customers").select("id, email, role, name").in_("role", ["agent", "manager", "admin", "support_agent"]).execute()
        for row in (res.data or []):
            aid = str(row["id"])
            live = live_agents.get(aid)
            staff_list.append({
                "agent_id": aid,
                "agent_name": row.get("name") or row.get("email") or "Agent",
                "role": row.get("role", "agent"),
                "status": live["status"] if live else "offline",
                "current_conversation": live.get("current_conversation") if live else None,
            })
    except Exception as e:
        logger.warning(f"Failed to query staff profiles: {e}")

    # If database query returned nothing, fall back to in-memory presence
    if not staff_list:
        staff_list = agent_presence.get_all_agents()

    online_count = len([a for a in staff_list if a["status"] in ("online", "busy")])
    return {"agents": staff_list, "count": online_count}


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

    # Ensure ticket exists in database for this handoff
    try:
        from src.config.supabase import get_service_client
        supabase = get_service_client()
        existing_t = supabase.table("tickets").select("id, ticket_number").eq("conversation_id", conversation_id).limit(1).execute()
        if existing_t.data:
            supabase.table("tickets").update({
                "status": "escalated",
                "priority": priority,
                "ai_summary": body.reason,
            }).eq("id", existing_t.data[0]["id"]).execute()
        else:
            from datetime import datetime, timezone
            t_num = f"TICK-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{conversation_id[:4].upper()}"
            supabase.table("tickets").insert({
                "ticket_number": t_num,
                "conversation_id": conversation_id,
                "customer_id": str(current_user.get("customer_id") or customer_id),
                "tenant_id": str(tenant_id or "00000000-0000-0000-0000-000000000000"),
                "status": "escalated",
                "priority": priority,
                "category": "Live Escalation",
                "ai_summary": body.reason,
            }).execute()
    except Exception as t_err:
        logger.warning(f"Failed to record handoff ticket in database: {t_err}")

    # Notify all agents & staff about new handoff via WebSocket & In-App Notification
    try:
        await manager.broadcast_to_agents(
            {
                "type": "handoff_notification",
                "handoff": request.to_dict(),
            }
        )
    except Exception:
        pass

    try:
        from src.services.notification_service import notification_service
        await notification_service.broadcast_to_roles(
            roles=["agent", "admin", "manager"],
            notification_type="handoff",
            title="🚨 Human Agent Requested",
            message=f"Customer requested human assistance for Chat #{conversation_id[:8]} ({body.reason})",
            priority=priority,
            data={"conversation_id": conversation_id, "priority": priority, "reason": body.reason},
        )
    except Exception as e:
        logger.warning(f"Failed to record staff broadcast notification: {e}")

    return request.to_dict()


@router.get("/queue")
async def get_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
):
    """Get the handoff queue (agents only), merged with open database tickets."""
    mem_queue = handoff_manager.get_queue(status_filter)
    existing_conv_ids = {item["conversation_id"] for item in mem_queue}

    # Also fetch open/escalated tickets from database
    try:
        from src.config.supabase import get_service_client
        supabase = get_service_client()
        tickets_res = (
            supabase.table("tickets")
            .select("id, ticket_number, conversation_id, status, priority, category, ai_summary, created_at, assigned_agent_id")
            .in_("status", ["open", "escalated", "in_progress", "pending"])
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        for t in (tickets_res.data or []):
            conv_id = str(t.get("conversation_id")) if t.get("conversation_id") else None
            if conv_id and conv_id not in existing_conv_ids:
                existing_conv_ids.add(conv_id)
                t_status = "waiting" if t.get("status") in ("open", "escalated") else "in_progress"
                if not status_filter or status_filter == t_status:
                    mem_queue.append({
                        "id": t["id"],
                        "conversation_id": conv_id,
                        "customer_id": "",
                        "tenant_id": str(current_user.get("tenant_id") or ""),
                        "reason": t.get("ai_summary") or f"Ticket #{t.get('ticket_number')} ({t.get('category', 'Support')})",
                        "priority": (t.get("priority") or "medium").lower(),
                        "status": t_status,
                        "context": {"ticket_number": t.get("ticket_number"), "ai_summary": t.get("ai_summary")},
                        "assigned_agent_id": t.get("assigned_agent_id"),
                        "created_at": t.get("created_at"),
                        "wait_time_seconds": None,
                        "internal_notes": [],
                    })
    except Exception as e:
        logger.warning(f"Failed to query database tickets for queue: {e}")

    return {"queue": mem_queue}


@router.get("/queue/stats")
async def get_queue_stats(current_user: dict = Depends(get_current_user)):
    """Get handoff queue statistics."""
    stats = handoff_manager.get_stats()
    try:
        from src.config.supabase import get_service_client
        supabase = get_service_client()
        res = (
            supabase.table("tickets")
            .select("status", count="exact")
            .in_("status", ["open", "escalated"])
            .execute()
        )
        db_waiting = res.count or 0
        if db_waiting > stats["waiting"]:
            stats["waiting"] = db_waiting
    except Exception:
        pass
    return stats


@router.get("/request/{conversation_id}")
async def get_handoff_request(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get handoff request details for a conversation."""
    request = handoff_manager.get_request(conversation_id)
    if not request:
        return {
            "active": False,
            "status": None,
            "reason": None,
            "priority": None,
            "assigned_agent": None,
            "assigned_agent_id": None,
            "id": None,
        }
    return request


@router.post("/request/{conversation_id}/assign")
async def assign_agent_to_handoff(
    conversation_id: str,
    body: AssignAgentModel,
    current_user: dict = Depends(get_current_user),
):
    """Agent claims a handoff from the queue."""
    agent_id = body.agent_id or current_user["user_id"]
    agent_name = current_user.get("email", "Support Specialist")

    success = await handoff_manager.assign_agent(conversation_id, agent_id, agent_name)
    if not success:
        # Check if already assigned to this agent
        req = handoff_manager.get_request(conversation_id)
        if not req or req.get("status") not in ("assigned", "in_progress"):
            raise HTTPException(status_code=400, detail="Cannot assign — request not found")

    # Mark agent as busy and start chat
    await agent_presence.set_busy(agent_id, conversation_id)
    await handoff_manager.start_chat(conversation_id)
    request = handoff_manager.get_request(conversation_id)

    # Broadcast handoff status update to the conversation
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    await manager.send_to_conversation(
        {
            "type": "handoff_notification",
            "handoff": {
                "active": True,
                "status": "in_progress",
                "assigned_agent": agent_name,
                "assigned_agent_id": agent_id,
                "reason": request.get("reason", "Human Specialist Handoff") if request else "Human Specialist Handoff",
                "request_id": request.get("id") if request else conversation_id,
            },
        },
        conversation_id,
    )

    # Send introductory message to the conversation
    intro_content = f"Hello! Support Specialist {agent_name} has joined the chat session. How can I help you today?"
    try:
        agent_msg = await ChatService.create_message(
            MessageCreate(
                conversation_id=UUID(conversation_id),
                tenant_id=UUID(current_user.get("tenant_id") or "00000000-0000-0000-0000-000000000000"),
                sender_id=UUID(agent_id),
                sender_type=SenderType.HUMAN_AGENT,
                content=intro_content,
            )
        )
        msg_payload = {
            "type": "message",
            "sender": "human_agent",
            "sender_type": "human_agent",
            "content": intro_content,
            "agent_name": agent_name,
            "message_id": str(agent_msg.id),
            "id": str(agent_msg.id),
            "conversation_id": conversation_id,
            "timestamp": now_iso,
        }
        await manager.send_to_conversation(msg_payload, conversation_id)
        await manager.broadcast_to_agents(msg_payload)
    except Exception as e:
        logger.warning(f"Failed to record intro message: {e}")

    # Broadcast updated queue state to all staff
    try:
        await manager.broadcast_to_agents(
            {
                "type": "queue_updated",
                "queue": handoff_manager.get_queue(),
                "assigned_conversation_id": conversation_id,
            }
        )
    except Exception:
        pass

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
    """Mark handoff as resolved and resume normal AI state."""
    await handoff_manager.resolve_handoff(conversation_id)
    # Free the agent
    agent_id = current_user["user_id"]
    await agent_presence.set_online_from_busy(agent_id)

    # Notify customer conversation
    await manager.send_to_conversation(
        {
            "type": "handoff_notification",
            "handoff": {
                "active": False,
                "status": "resolved",
            },
        },
        conversation_id,
    )

    # Broadcast queue update to agents
    try:
        await manager.broadcast_to_agents(
            {
                "type": "queue_updated",
                "queue": handoff_manager.get_queue(),
            }
        )
    except Exception:
        pass

    return {"status": "resolved"}


@router.post("/request/{conversation_id}/cancel")
async def cancel_handoff(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a handoff request and resume AI Copilot chat."""
    await handoff_manager.cancel_handoff(conversation_id)

    # Notify customer conversation
    await manager.send_to_conversation(
        {
            "type": "handoff_notification",
            "handoff": {
                "active": False,
                "status": "cancelled",
            },
        },
        conversation_id,
    )

    # Broadcast queue update to agents
    try:
        await manager.broadcast_to_agents(
            {
                "type": "queue_updated",
                "queue": handoff_manager.get_queue(),
            }
        )
    except Exception:
        pass

    return {"status": "cancelled"}


@router.post("/request/{conversation_id}/message")
async def send_handoff_message(
    conversation_id: str,
    body: SendMessageModel,
    current_user: dict = Depends(get_current_user),
):
    """Send a real-time message during handoff (works for both Agent and Customer)."""
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    user_id = current_user["user_id"]
    role = current_user.get("role", "customer")
    sender_type = SenderType.HUMAN_AGENT if role in ("agent", "admin", "manager") else SenderType.CUSTOMER
    sender_name = current_user.get("email", "Support Specialist" if sender_type == SenderType.HUMAN_AGENT else "Customer")

    # Save to DB
    msg = await ChatService.create_message(
        MessageCreate(
            conversation_id=UUID(conversation_id),
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
        "conversation_id": conversation_id,
        "timestamp": now_iso,
    }

    # Broadcast to both customer socket and agent roster
    await manager.send_to_conversation(msg_payload, conversation_id)
    await manager.broadcast_to_agents(msg_payload)

    return {
        "id": str(msg.id),
        "conversation_id": conversation_id,
        "sender_type": str(sender_type.value),
        "content": content,
        "timestamp": now_iso,
        "agent_name": sender_name,
    }


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
