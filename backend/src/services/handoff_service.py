"""
Handoff Service — Agent Presence, Conversation Handoff & Queue Management
Advanced Talk-to-Human feature: real-time agent status, context transfer, queue priority.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent Presence
# ---------------------------------------------------------------------------

class AgentPresence:
    """In-memory agent presence tracker."""

    def __init__(self):
        self._agents: Dict[str, dict] = {}  # agent_id -> presence info
        self._lock = asyncio.Lock()

    async def set_online(self, agent_id: str, agent_name: str, role: str = "agent"):
        async with self._lock:
            self._agents[agent_id] = {
                "agent_id": agent_id,
                "agent_name": agent_name,
                "role": role,
                "status": "online",          # online | busy | away
                "current_conversation": None,
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            }
        logger.info(f"Agent {agent_name} ({agent_id}) set online")

    async def set_busy(self, agent_id: str, conversation_id: str):
        async with self._lock:
            if agent_id in self._agents:
                self._agents[agent_id]["status"] = "busy"
                self._agents[agent_id]["current_conversation"] = conversation_id

    async def set_online_from_busy(self, agent_id: str):
        async with self._lock:
            if agent_id in self._agents:
                self._agents[agent_id]["status"] = "online"
                self._agents[agent_id]["current_conversation"] = None

    async def set_away(self, agent_id: str):
        async with self._lock:
            if agent_id in self._agents:
                self._agents[agent_id]["status"] = "away"

    async def disconnect(self, agent_id: str):
        async with self._lock:
            self._agents.pop(agent_id, None)
        logger.info(f"Agent {agent_id} disconnected")

    async def heartbeat(self, agent_id: str):
        async with self._lock:
            if agent_id in self._agents:
                self._agents[agent_id]["last_heartbeat"] = datetime.now(timezone.utc).isoformat()

    def get_available_agents(self) -> List[dict]:
        """Return agents who are online (not busy/away)."""
        return [a for a in self._agents.values() if a["status"] == "online"]

    def get_all_agents(self) -> List[dict]:
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> Optional[dict]:
        return self._agents.get(agent_id)

    def get_online_count(self) -> int:
        return len([a for a in self._agents.values() if a["status"] != "away"])


# ---------------------------------------------------------------------------
# Conversation Handoff
# ---------------------------------------------------------------------------

class HandoffRequest:
    """Represents a single handoff request from AI to human."""

    def __init__(
        self,
        conversation_id: str,
        customer_id: str,
        tenant_id: str,
        reason: str,
        priority: str = "medium",
        context: Optional[dict] = None,
    ):
        self.id = str(uuid4())
        self.conversation_id = conversation_id
        self.customer_id = customer_id
        self.tenant_id = tenant_id
        self.reason = reason
        self.priority = priority  # low | medium | high | critical
        self.status = "waiting"  # waiting | assigned | in_progress | resolved | cancelled
        self.context = context or {}
        self.assigned_agent_id: Optional[str] = None
        self.assigned_agent_name: Optional[str] = None
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.assigned_at: Optional[str] = None
        self.resolved_at: Optional[str] = None
        self.wait_time_seconds: Optional[float] = None
        self.internal_notes: List[dict] = []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "customer_id": self.customer_id,
            "tenant_id": self.tenant_id,
            "reason": self.reason,
            "priority": self.priority,
            "status": self.status,
            "context": self.context,
            "assigned_agent_id": self.assigned_agent_id,
            "assigned_agent": self.assigned_agent_name or self.assigned_agent_id,
            "assigned_agent_name": self.assigned_agent_name or self.assigned_agent_id,
            "created_at": self.created_at,
            "assigned_at": self.assigned_at,
            "resolved_at": self.resolved_at,
            "wait_time_seconds": self.wait_time_seconds,
            "internal_notes": self.internal_notes,
        }


class HandoffManager:
    """Manages the handoff lifecycle: queue, assignment, context transfer."""

    # Priority weights for sorting
    PRIORITY_WEIGHT = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    def __init__(self):
        self._queue: Dict[str, HandoffRequest] = {}
        self._history: Dict[str, HandoffRequest] = {}  # resolved handoffs
        self._lock = asyncio.Lock()

    async def request_handoff(
        self,
        conversation_id: str,
        customer_id: str,
        tenant_id: str,
        reason: str,
        priority: str = "medium",
        context: Optional[dict] = None,
    ) -> HandoffRequest:
        """Create a new handoff request and add to queue."""
        async with self._lock:
            # Check if already in queue
            if conversation_id in self._queue:
                existing = self._queue[conversation_id]
                if existing.status in ("waiting", "assigned"):
                    logger.info(f"Handoff already exists for conversation {conversation_id}")
                    return existing

            request = HandoffRequest(
                conversation_id=conversation_id,
                customer_id=customer_id,
                tenant_id=tenant_id,
                reason=reason,
                priority=priority,
                context=context,
            )
            self._queue[conversation_id] = request
            logger.info(
                f"Handoff requested: conversation={conversation_id}, "
                f"reason={reason}, priority={priority}"
            )
            return request

    async def assign_agent(self, conversation_id: str, agent_id: str, agent_name: Optional[str] = None) -> bool:
        """Assign an agent to a handoff request (allows re-assigning active chats)."""
        async with self._lock:
            request = self._queue.get(conversation_id)
            if not request or request.status not in ("waiting", "assigned", "in_progress"):
                return False

            now = datetime.now(timezone.utc)
            request.status = "assigned"
            request.assigned_agent_id = agent_id
            request.assigned_agent_name = agent_name or agent_id
            request.assigned_at = now.isoformat()

            # Calculate wait time
            created = datetime.fromisoformat(request.created_at)
            request.wait_time_seconds = (now - created).total_seconds()

            logger.info(
                f"Agent {agent_name or agent_id} ({agent_id}) assigned to conversation {conversation_id} "
                f"(waited {request.wait_time_seconds:.0f}s)"
            )
            return True

    async def start_chat(self, conversation_id: str) -> bool:
        """Agent starts actively chatting."""
        async with self._lock:
            request = self._queue.get(conversation_id)
            if not request or request.status != "assigned":
                return False
            request.status = "in_progress"
            return True

    async def resolve_handoff(self, conversation_id: str) -> bool:
        """Mark a handoff as resolved."""
        async with self._lock:
            request = self._queue.get(conversation_id)
            if not request:
                return False
            request.status = "resolved"
            request.resolved_at = datetime.now(timezone.utc).isoformat()
            # Move to history
            self._history[conversation_id] = request
            del self._queue[conversation_id]
            logger.info(f"Handoff resolved: conversation={conversation_id}")
            return True

    async def cancel_handoff(self, conversation_id: str) -> bool:
        """Cancel a handoff request."""
        async with self._lock:
            request = self._queue.get(conversation_id)
            if not request:
                return False
            request.status = "cancelled"
            self._history[conversation_id] = request
            del self._queue[conversation_id]
            return True

    async def add_internal_note(self, conversation_id: str, agent_id: str, note: str, agent_name: str = "") -> bool:
        """Add an internal note to a handoff request."""
        async with self._lock:
            request = self._queue.get(conversation_id) or self._history.get(conversation_id)
            if not request:
                return False
            request.internal_notes.append({
                "id": str(uuid4()),
                "agent_id": agent_id,
                "agent_name": agent_name,
                "content": note,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return True

    def get_queue(self, status: Optional[str] = None) -> List[dict]:
        """Get the handoff queue, optionally filtered by status."""
        items = list(self._queue.values())
        if status:
            items = [r for r in items if r.status == status]
        # Sort by priority (highest first), then by creation time (oldest first)
        items.sort(
            key=lambda r: (
                -self.PRIORITY_WEIGHT.get(r.priority, 0),
                r.created_at,
            )
        )
        return [r.to_dict() for r in items]

    def get_request(self, conversation_id: str) -> Optional[dict]:
        request = self._queue.get(conversation_id) or self._history.get(conversation_id)
        if request:
            return request.to_dict()

        # Database fallback: Check if a ticket exists for this conversation in active handoff
        try:
            from src.config.supabase import get_service_client
            supabase = get_service_client()
            res = (
                supabase.table("tickets")
                .select("id, ticket_number, conversation_id, status, priority, category, ai_summary, created_at, assigned_agent_id")
                .eq("conversation_id", str(conversation_id))
                .limit(1)
                .execute()
            )
            if res.data:
                t = res.data[0]
                t_status = t.get("status")
                if t_status in ("open", "escalated", "in_progress", "pending"):
                    agent_name = None
                    if t.get("assigned_agent_id"):
                        try:
                            a_res = supabase.table("customers").select("email, name").eq("id", str(t["assigned_agent_id"])).limit(1).execute()
                            if a_res.data:
                                agent_name = a_res.data[0].get("name") or a_res.data[0].get("email")
                        except Exception:
                            pass

                    status_val = "in_progress" if (t_status == "in_progress" or t.get("assigned_agent_id")) else "waiting"
                    req = HandoffRequest(
                        conversation_id=str(conversation_id),
                        customer_id="",
                        tenant_id="",
                        reason=t.get("ai_summary") or f"Ticket #{t.get('ticket_number')}",
                        priority=(t.get("priority") or "medium").lower(),
                    )
                    req.status = status_val
                    req.assigned_agent_id = str(t.get("assigned_agent_id")) if t.get("assigned_agent_id") else None
                    req.assigned_agent_name = agent_name or req.assigned_agent_id
                    self._queue[str(conversation_id)] = req
                    return req.to_dict()
        except Exception as e:
            logger.warning(f"Failed to lookup handoff ticket from DB: {e}")

        return None

    def get_stats(self) -> dict:
        waiting = len([r for r in self._queue.values() if r.status == "waiting"])
        assigned = len([r for r in self._queue.values() if r.status in ("assigned", "in_progress")])
        total_today = len(self._history) + len(self._queue)
        avg_wait = 0.0
        resolved_with_wait = [
            r for r in self._history.values()
            if r.wait_time_seconds is not None
        ]
        if resolved_with_wait:
            avg_wait = sum(r.wait_time_seconds for r in resolved_with_wait) / len(resolved_with_wait)
        return {
            "waiting": waiting,
            "assigned": assigned,
            "total_today": total_today,
            "avg_wait_seconds": round(avg_wait, 1),
        }


# ---------------------------------------------------------------------------
# Global singletons
# ---------------------------------------------------------------------------
agent_presence = AgentPresence()
handoff_manager = HandoffManager()
