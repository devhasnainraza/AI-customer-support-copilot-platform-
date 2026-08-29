"""Admin API Routes - Agent Management, WhatsApp, System Config"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging

from src.services.admin_service import admin_service
from src.services.notification_service import notification_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/admin", tags=["admin"])

class AgentCreate(BaseModel):
    email: str
    name: str
    role: str = "agent"

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class WhatsAppConfig(BaseModel):
    phone_number: str
    business_name: str
    webhook_url: str = ""
    access_token: str = ""
    phone_number_id: str = ""
    business_account_id: str = ""
    verify_token: str = ""

class SystemConfigUpdate(BaseModel):
    ai_model: Optional[str] = None
    escalation_threshold: Optional[float] = None
    auto_response_enabled: Optional[bool] = None
    business_hours_start: Optional[str] = None
    business_hours_end: Optional[str] = None
    timezone: Optional[str] = None
    max_concurrent_chats: Optional[int] = None
    enable_sentiment_analysis: Optional[bool] = None

class NotificationRuleCreate(BaseModel):
    name: str
    trigger: str
    channels: List[str]
    recipients: str
    priority: str = "medium"

# Agent Management
@router.get("/agents")
async def list_agents(role: Optional[str] = None):
    agents = await admin_service.list_agents(role=role)
    return {"agents": agents, "total": len(agents)}

@router.post("/agents")
async def create_agent(payload: AgentCreate):
    agent = await admin_service.create_agent(email=payload.email, name=payload.name, role=payload.role)
    return agent.to_dict()

@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = await admin_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.put("/agents/{agent_id}")
async def update_agent(agent_id: str, payload: AgentUpdate):
    updates = payload.model_dump(exclude_none=True)
    agent = await admin_service.update_agent(agent_id, **updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("/agents/{agent_id}/deactivate")
async def deactivate_agent(agent_id: str):
    success = await admin_service.deactivate_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "deactivated"}

@router.post("/agents/{agent_id}/suspend")
async def suspend_agent(agent_id: str):
    success = await admin_service.suspend_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "suspended"}

# WhatsApp Integration
@router.get("/whatsapp")
async def get_whatsapp_status():
    return await admin_service.get_whatsapp_status()

@router.post("/whatsapp/configure")
async def configure_whatsapp(payload: WhatsAppConfig):
    return await admin_service.configure_whatsapp(payload.model_dump())

@router.post("/whatsapp/disconnect")
async def disconnect_whatsapp():
    success = await admin_service.disconnect_whatsapp()
    return {"status": "disconnected" if success else "error"}

# System Config
@router.get("/settings")
async def get_system_config():
    return await admin_service.get_system_config()

@router.put("/settings")
async def update_system_config(payload: SystemConfigUpdate):
    updates = payload.model_dump(exclude_none=True)
    return await admin_service.update_system_config(updates)

# Admin Stats
@router.get("/stats")
async def get_admin_stats():
    stats = await admin_service.get_admin_stats()
    try:
        from src.services.handoff_service import handoff_manager
        hs = handoff_manager.get_stats()
    except Exception:
        hs = {"waiting": 0, "assigned": 0, "total_today": 0, "avg_wait_seconds": 0}
    return {**stats, **hs}

# Notification Rules
@router.get("/notification-rules")
async def list_notification_rules():
    return {"rules": await notification_service.get_rules()}

@router.post("/notification-rules")
async def create_notification_rule(payload: NotificationRuleCreate):
    rule = await notification_service.create_rule(
        name=payload.name, trigger=payload.trigger,
        channels=payload.channels, recipients=payload.recipients,
        priority=payload.priority,
    )
    return rule.to_dict()

@router.delete("/notification-rules/{rule_id}")
async def delete_notification_rule(rule_id: str):
    success = await notification_service.delete_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted"}
