"""
Manager Service  Team Oversight, Performance Metrics, Reports
Provides manager-level operations for the role-based architecture.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class TeamMetrics:
    def __init__(self):
        self.total_conversations = 0
        self.resolved_conversations = 0
        self.escalated_conversations = 0
        self.avg_response_time = 0.0
        self.avg_resolution_time = 0.0
        self.customer_satisfaction = 0.0
        self.ai_resolution_rate = 0.0
        self.uptime_hours = 0.0

    def to_dict(self) -> dict:
        return {
            "total_conversations": self.total_conversations,
            "resolved_conversations": self.resolved_conversations,
            "escalated_conversations": self.escalated_conversations,
            "avg_response_time": self.avg_response_time,
            "avg_resolution_time": self.avg_resolution_time,
            "customer_satisfaction": self.customer_satisfaction,
            "ai_resolution_rate": self.ai_resolution_rate,
            "uptime_hours": self.uptime_hours,
        }


class EscalationReview:
    def __init__(self, escalation_id: str, ticket_id: str, agent_id: str, reason: str, priority: str):
        self.id = escalation_id
        self.ticket_id = ticket_id
        self.agent_id = agent_id
        self.reason = reason
        self.priority = priority
        self.status = "pending"  # pending, approved, rejected, reassigned
        self.reviewed_by: Optional[str] = None
        self.reviewed_at: Optional[str] = None
        self.notes: List[dict] = []
        self.created_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "agent_id": self.agent_id,
            "reason": self.reason,
            "priority": self.priority,
            "status": self.status,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at,
            "notes": self.notes,
            "created_at": self.created_at,
        }


class ManagerService:
    def __init__(self):
        self._metrics = TeamMetrics()
        self._escalation_reviews: Dict[str, EscalationReview] = {}
        self._reports: Dict[str, dict] = {}
        self._lock = asyncio.Lock()

    # --- Team Metrics ---
    async def get_team_metrics(self) -> dict:
        return self._metrics.to_dict()

    async def update_team_metrics(self, **kwargs) -> dict:
        async with self._lock:
            for key, value in kwargs.items():
                if hasattr(self._metrics, key):
                    setattr(self._metrics, key, value)
            return self._metrics.to_dict()

    async def get_agent_performance(self, agent_id: str) -> dict:
        # In production, this would query the database
        return {
            "agent_id": agent_id,
            "conversations_handled": 42,
            "avg_response_time": 1.5,
            "avg_resolution_time": 8.2,
            "satisfaction_score": 4.6,
            "escalation_rate": 0.12,
            "active_hours": 6.5,
        }

    async def get_team_leaderboard(self) -> List[dict]:
        # In production, this would query the database
        return [
            {"rank": 1, "agent_id": "a1", "name": "Agent A", "score": 95.2, "conversations": 120},
            {"rank": 2, "agent_id": "a2", "name": "Agent B", "score": 91.8, "conversations": 98},
            {"rank": 3, "agent_id": "a3", "name": "Agent C", "score": 88.5, "conversations": 87},
        ]

    # --- Escalation Review ---
    async def create_escalation_review(self, ticket_id: str, agent_id: str, reason: str, priority: str = "medium") -> EscalationReview:
        async with self._lock:
            review = EscalationReview(
                escalation_id=str(uuid4()),
                ticket_id=ticket_id,
                agent_id=agent_id,
                reason=reason,
                priority=priority,
            )
            self._escalation_reviews[review.id] = review
            logger.info(f"Escalation review created: {review.id}")
            return review

    async def get_escalation_reviews(self, status: Optional[str] = None) -> List[dict]:
        reviews = list(self._escalation_reviews.values())
        if status:
            reviews = [r for r in reviews if r.status == status]
        return [r.to_dict() for r in reviews]

    async def approve_escalation(self, escalation_id: str, reviewer_id: str, notes: str = "") -> Optional[dict]:
        async with self._lock:
            review = self._escalation_reviews.get(escalation_id)
            if not review:
                return None
            review.status = "approved"
            review.reviewed_by = reviewer_id
            review.reviewed_at = datetime.now(timezone.utc).isoformat()
            if notes:
                review.notes.append({
                    "author": reviewer_id,
                    "content": notes,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            return review.to_dict()

    async def reject_escalation(self, escalation_id: str, reviewer_id: str, notes: str = "") -> Optional[dict]:
        async with self._lock:
            review = self._escalation_reviews.get(escalation_id)
            if not review:
                return None
            review.status = "rejected"
            review.reviewed_by = reviewer_id
            review.reviewed_at = datetime.now(timezone.utc).isoformat()
            if notes:
                review.notes.append({
                    "author": reviewer_id,
                    "content": notes,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            return review.to_dict()

    async def reassign_escalation(self, escalation_id: str, new_agent_id: str, reviewer_id: str) -> Optional[dict]:
        async with self._lock:
            review = self._escalation_reviews.get(escalation_id)
            if not review:
                return None
            review.status = "reassigned"
            review.reviewed_by = reviewer_id
            review.reviewed_at = datetime.now(timezone.utc).isoformat()
            review.notes.append({
                "author": reviewer_id,
                "content": f"Reassigned to agent {new_agent_id}",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return review.to_dict()

    # --- Reports ---
    async def generate_report(self, report_type: str, date_from: str, date_to: str) -> dict:
        report_id = str(uuid4())
        report = {
            "id": report_id,
            "type": report_type,
            "date_from": date_from,
            "date_to": date_to,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "total_conversations": 245,
                "resolved": 210,
                "escalated": 35,
                "avg_response_time": 1.8,
                "avg_resolution_time": 12.5,
                "satisfaction_score": 4.5,
            },
        }
        self._reports[report_id] = report
        return report

    async def get_reports(self) -> List[dict]:
        return list(self._reports.values())


# Global singleton
manager_service = ManagerService()
