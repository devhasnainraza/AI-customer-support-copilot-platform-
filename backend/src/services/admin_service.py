"""
Admin Service  Agent Management, WhatsApp Integration, System Config
Provides admin-level operations for the role-based architecture.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class AdminAgent:
    def __init__(self, agent_id: str, email: str, name: str, role: str = "agent"):
        self.id = agent_id
        self.email = email
        self.name = name
        self.role = role  # agent, manager
        self.status = "inactive"  # active, inactive, suspended
        self.permissions: List[str] = []
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.last_active: Optional[str] = None
        self.conversations_handled = 0
        self.avg_response_time = 0.0
        self.satisfaction_score = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "status": self.status,
            "permissions": self.permissions,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_active": self.last_active,
            "conversations_handled": self.conversations_handled,
            "avg_response_time": self.avg_response_time,
            "satisfaction_score": self.satisfaction_score,
        }


class WhatsAppConfig:
    def __init__(self):
        self.connected = False
        self.phone_number = ""
        self.business_name = ""
        self.webhook_url = ""
        self.access_token = ""
        self.phone_number_id = ""
        self.business_account_id = ""
        self.verify_token = ""
        self.created_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "connected": self.connected,
            "phone_number": self.phone_number,
            "business_name": self.business_name,
            "webhook_url": self.webhook_url,
            "phone_number_id": self.phone_number_id,
            "business_account_id": self.business_account_id,
            "created_at": self.created_at,
        }


class SystemConfig:
    def __init__(self):
        self.ai_model = "llama-3.3-70b-versatile"
        self.escalation_threshold = 0.8
        self.auto_response_enabled = True
        self.business_hours_start = "09:00"
        self.business_hours_end = "18:00"
        self.timezone = "UTC"
        self.max_concurrent_chats = 10
        self.enable_sentiment_analysis = True
        self.enable_auto_ticket_creation = True

    def to_dict(self) -> dict:
        return {
            "ai_model": self.ai_model,
            "escalation_threshold": self.escalation_threshold,
            "auto_response_enabled": self.auto_response_enabled,
            "business_hours_start": self.business_hours_start,
            "business_hours_end": self.business_hours_end,
            "timezone": self.timezone,
            "max_concurrent_chats": self.max_concurrent_chats,
            "enable_sentiment_analysis": self.enable_sentiment_analysis,
            "enable_auto_ticket_creation": self.enable_auto_ticket_creation,
        }


class AdminService:
    def __init__(self):
        self._agents: Dict[str, AdminAgent] = {}
        self._whatsapp = WhatsAppConfig()
        self._system_config = SystemConfig()
        self._lock = asyncio.Lock()

    # --- Agent Management ---
    async def create_agent(self, email: str, name: str, role: str = "agent") -> AdminAgent:
        async with self._lock:
            agent = AdminAgent(
                agent_id=str(uuid4()),
                email=email,
                name=name,
                role=role,
                status="active",
            )
            self._agents[agent.id] = agent
            logger.info(f"Agent created: {name} ({email}) as {role}")
            return agent

    async def get_agent(self, agent_id: str) -> Optional[dict]:
        agent = self._agents.get(agent_id)
        return agent.to_dict() if agent else None

    async def list_agents(self, role: Optional[str] = None) -> List[dict]:
        agents = list(self._agents.values())
        if role:
            agents = [a for a in agents if a.role == role]
        return [a.to_dict() for a in agents]

    async def update_agent(self, agent_id: str, **kwargs) -> Optional[dict]:
        async with self._lock:
            agent = self._agents.get(agent_id)
            if not agent:
                return None
            for key, value in kwargs.items():
                if hasattr(agent, key):
                    setattr(agent, key, value)
            agent.updated_at = datetime.now(timezone.utc).isoformat()
            return agent.to_dict()

    async def deactivate_agent(self, agent_id: str) -> bool:
        async with self._lock:
            agent = self._agents.get(agent_id)
            if not agent:
                return False
            agent.status = "inactive"
            agent.updated_at = datetime.now(timezone.utc).isoformat()
            return True

    async def suspend_agent(self, agent_id: str) -> bool:
        async with self._lock:
            agent = self._agents.get(agent_id)
            if not agent:
                return False
            agent.status = "suspended"
            agent.updated_at = datetime.now(timezone.utc).isoformat()
            return True

    # --- WhatsApp Integration ---
    async def configure_whatsapp(self, config: dict) -> dict:
        async with self._lock:
            self._whatsapp.phone_number = config.get("phone_number", "")
            self._whatsapp.business_name = config.get("business_name", "")
            self._whatsapp.webhook_url = config.get("webhook_url", "")
            self._whatsapp.access_token = config.get("access_token", "")
            self._whatsapp.phone_number_id = config.get("phone_number_id", "")
            self._whatsapp.business_account_id = config.get("business_account_id", "")
            self._whatsapp.verify_token = config.get("verify_token", "")
            self._whatsapp.connected = True
            self._whatsapp.created_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"WhatsApp configured: {self._whatsapp.business_name}")
            return self._whatsapp.to_dict()

    async def get_whatsapp_status(self) -> dict:
        return self._whatsapp.to_dict()

    async def disconnect_whatsapp(self) -> bool:
        async with self._lock:
            self._whatsapp.connected = False
            return True

    # --- System Config ---
    async def get_system_config(self) -> dict:
        return self._system_config.to_dict()

    async def update_system_config(self, config: dict) -> dict:
        async with self._lock:
            for key, value in config.items():
                if hasattr(self._system_config, key):
                    setattr(self._system_config, key, value)
            return self._system_config.to_dict()

    # --- Stats ---
    async def get_admin_stats(self) -> dict:
        total_agents = len(self._agents)
        active_agents = len([a for a in self._agents.values() if a.status == "active"])
        managers = len([a for a in self._agents.values() if a.role == "manager"])
        return {
            "total_agents": total_agents,
            "active_agents": active_agents,
            "managers": managers,
            "whatsapp_connected": self._whatsapp.connected,
        }


# Global singleton
admin_service = AdminService()
