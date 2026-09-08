"""Admin API Routes - Agent Management, WhatsApp, System Config"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import logging

from src.api.middleware.auth import require_role
from src.services.admin_service import admin_service
from src.services.notification_service import notification_service

from src.config.supabase import get_service_client
import secrets
import string

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/v1/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(["admin", "manager"]))]
)

class AgentCreate(BaseModel):
    email: str
    name: str
    role: str = "agent"
    password: Optional[str] = None

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

from src.api.middleware.auth import clear_auth_cache_for_user
import time

_STAFF_ROSTER_CACHE: Optional[tuple[float, list]] = None

def invalidate_roster_cache():
    global _STAFF_ROSTER_CACHE
    _STAFF_ROSTER_CACHE = None

# Agent Management
@router.get("/agents")
async def list_agents(role: Optional[str] = None):
    """
    List all staff members (agents, managers, admins) across Supabase Auth, DB, and admin service.
    Fast memory cached (15s).
    """
    global _STAFF_ROSTER_CACHE
    now = time.time()
    if _STAFF_ROSTER_CACHE and not role:
        cache_time, cached_list = _STAFF_ROSTER_CACHE
        if now - cache_time < 15:
            return {"agents": cached_list, "total": len(cached_list)}

    staff_agents = []
    seen_emails = set()

    try:
        supabase = get_service_client()
        # 1. Fetch staff from Supabase Auth Admin API (Source of Truth)
        auth_users = supabase.auth.admin.list_users()
        for u in auth_users:
            u_email = (getattr(u, "email", None) or "").lower().strip()
            if not u_email:
                continue

            app_meta = getattr(u, "app_metadata", {}) or {}
            user_meta = getattr(u, "user_metadata", {}) or {}
            u_role = app_meta.get("role") or user_meta.get("role")

            # Infer role if not explicitly tagged
            if not u_role or u_role == "customer":
                if u_email.startswith("agent") or "agent" in u_email or u_email == "chat.hasnain@gmail.com":
                    u_role = "agent"
                elif u_email.startswith("manager") or "manager" in u_email or u_email in ("info.mhr@gmail.com", "info.mhraza@gmail.com"):
                    u_role = "manager"
                elif u_email.startswith("admin") or "admin" in u_email or u_email == "mhattari1112@gmail.com":
                    u_role = "admin"

            # Only include staff roles (agent, manager, admin)
            if u_role in ("agent", "manager", "admin"):
                if role and u_role != role:
                    continue
                if u_email not in seen_emails:
                    seen_emails.add(u_email)
                    full_name = user_meta.get("full_name") or u_email.split("@")[0].replace(".", " ").title()
                    created_at = getattr(u, "created_at", None) or getattr(u, "confirmed_at", None)
                    
                    # Read real status
                    u_status = user_meta.get("status") or (app_meta or {}).get("status")
                    if getattr(u, "banned_until", None) is not None:
                        u_status = "suspended"
                    if not u_status:
                        u_status = "active"

                    staff_agents.append({
                        "id": str(getattr(u, "id", "")),
                        "email": u_email,
                        "name": full_name,
                        "role": u_role,
                        "status": u_status,
                        "permissions": ["chat", "tickets", "handoff"] if u_role == "agent" else ["all"],
                        "created_at": created_at,
                        "updated_at": getattr(u, "updated_at", None),
                        "last_active": getattr(u, "last_sign_in_at", None) or created_at,
                        "conversations_handled": 0,
                        "avg_response_time": 1.2,
                        "satisfaction_score": 4.9,
                    })
    except Exception as e:
        logger.warning(f"Could not load staff from Supabase Auth: {e}")

    # 2. Merge with Supabase DB agents table if available
    try:
        supabase = get_service_client()
        query = supabase.table("agents").select("*")
        if role:
            query = query.eq("role", role)
        res = query.execute()
        if res.data:
            for row in res.data:
                e_val = (row.get("email") or "").lower().strip()
                if e_val and e_val not in seen_emails:
                    seen_emails.add(e_val)
                    staff_agents.append({
                        "id": str(row.get("id") or row.get("auth_id")),
                        "email": e_val,
                        "name": row.get("name") or e_val.split("@")[0],
                        "role": row.get("role", "agent"),
                        "status": row.get("status", "active"),
                        "permissions": row.get("permissions", []),
                        "created_at": row.get("created_at"),
                        "updated_at": row.get("updated_at"),
                        "last_active": row.get("last_active"),
                        "conversations_handled": row.get("conversations_handled", 0),
                        "avg_response_time": row.get("avg_response_time", 0.0),
                        "satisfaction_score": row.get("satisfaction_score", 0.0),
                    })
    except Exception:
        pass

    # 3. Merge with in-memory service agents
    mem_agents = await admin_service.list_agents(role=role)
    for ma in mem_agents:
        e_val = (ma.get("email") or "").lower().strip()
        if e_val and e_val not in seen_emails:
            staff_agents.append(ma)
    if not role:
        _STAFF_ROSTER_CACHE = (time.time(), staff_agents)

    return {"agents": staff_agents, "total": len(staff_agents)}

@router.post("/agents")
async def create_agent(payload: AgentCreate):
    agent_role = payload.role if payload.role in ("agent", "manager", "admin") else "agent"
    pwd = payload.password
    if not pwd or len(pwd.strip()) < 6:
        pwd = "Staff@" + "".join(secrets.choice(string.digits) for _ in range(4)) + "!"

    user_id = None
    # 1. Provision / sync in Supabase Auth via Admin Service Role
    try:
        supabase = get_service_client()
        users_resp = supabase.auth.admin.list_users()
        existing_user = None
        for u in users_resp:
            if u.email.lower() == payload.email.lower():
                existing_user = u
                break

        if existing_user:
            supabase.auth.admin.update_user_by_id(
                existing_user.id,
                {
                    "password": pwd,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": payload.name,
                        "role": agent_role,
                        "email_verified": True
                    },
                    "app_metadata": {
                        "role": agent_role
                    }
                }
            )
            user_id = existing_user.id
        else:
            res = supabase.auth.admin.create_user({
                "email": payload.email,
                "password": pwd,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.name,
                    "role": agent_role,
                    "email_verified": True
                },
                "app_metadata": {
                    "role": agent_role
                }
            })
            user_id = res.user.id

        # 2. Sync Supabase DB agents table
        try:
            agent_res = supabase.table("agents").select("*").eq("auth_id", user_id).execute()
            if not agent_res.data:
                supabase.table("agents").insert({
                    "auth_id": user_id,
                    "email": payload.email,
                    "name": payload.name,
                    "role": agent_role,
                    "status": "active"
                }).execute()
            else:
                supabase.table("agents").update({
                    "email": payload.email,
                    "name": payload.name,
                    "role": agent_role,
                    "status": "active"
                }).eq("auth_id", user_id).execute()
        except Exception as ae:
            logger.warning(f"Could not sync agents DB table: {ae}")

        # 3. Sync Supabase DB customers table
        try:
            cust_res = supabase.table("customers").select("*").eq("auth_id", user_id).execute()
            if not cust_res.data:
                supabase.table("customers").insert({
                    "auth_id": user_id,
                    "email": payload.email,
                    "name": payload.name,
                    "role": agent_role,
                    "tenant_id": "00000000-0000-0000-0000-000000000000"
                }).execute()
            else:
                supabase.table("customers").update({
                    "email": payload.email,
                    "name": payload.name,
                    "role": agent_role
                }).eq("auth_id", user_id).execute()
        except Exception as ce:
            logger.warning(f"Could not sync customers DB table: {ce}")

    except Exception as se:
        logger.error(f"Supabase auth provisioning error: {se}")

    # 4. Also register in in-memory admin_service
    agent = await admin_service.create_agent(email=payload.email, name=payload.name, role=agent_role)
    result = agent.to_dict()
    if user_id:
        result["auth_id"] = user_id
    result["temporary_password"] = pwd
    return result

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
    await admin_service.deactivate_agent(agent_id)
    try:
        supabase = get_service_client()
        try:
            target_user = supabase.auth.admin.get_user_by_id(agent_id)
            curr_user_meta = dict(getattr(target_user.user, "user_metadata", {}) or {})
            curr_app_meta = dict(getattr(target_user.user, "app_metadata", {}) or {})
            curr_user_meta["status"] = "inactive"
            curr_app_meta["status"] = "inactive"
            supabase.auth.admin.update_user_by_id(agent_id, {"user_metadata": curr_user_meta, "app_metadata": curr_app_meta})
        except Exception:
            pass
        try:
            supabase.table("agents").update({"status": "inactive"}).or_(f"id.eq.{agent_id},auth_id.eq.{agent_id}").execute()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Error deactivating agent {agent_id}: {e}")
    finally:
        invalidate_roster_cache()
        clear_auth_cache_for_user(agent_id)
    return {"status": "deactivated"}

@router.post("/agents/{agent_id}/activate")
async def activate_agent(agent_id: str):
    await admin_service.activate_agent(agent_id)
    try:
        supabase = get_service_client()
        try:
            target_user = supabase.auth.admin.get_user_by_id(agent_id)
            curr_user_meta = dict(getattr(target_user.user, "user_metadata", {}) or {})
            curr_app_meta = dict(getattr(target_user.user, "app_metadata", {}) or {})
            curr_user_meta["status"] = "active"
            curr_app_meta["status"] = "active"
            original_role = curr_app_meta.get("role") or curr_user_meta.get("role") or "agent"

            supabase.auth.admin.update_user_by_id(
                agent_id,
                {
                    "user_metadata": curr_user_meta,
                    "app_metadata": curr_app_meta,
                    "ban_duration": "none"
                }
            )
        except Exception as ue:
            logger.warning(f"Auth unban failed: {ue}")

        try:
            supabase.table("agents").update({"status": "active"}).or_(f"id.eq.{agent_id},auth_id.eq.{agent_id}").execute()
        except Exception:
            pass

        try:
            supabase.table("customers").update({"role": original_role}).eq("auth_id", agent_id).execute()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Error activating agent {agent_id}: {e}")
    finally:
        invalidate_roster_cache()
        clear_auth_cache_for_user(agent_id)
    return {"status": "active"}

@router.post("/agents/{agent_id}/suspend")
async def suspend_agent(agent_id: str):
    await admin_service.suspend_agent(agent_id)
    try:
        supabase = get_service_client()
        try:
            target_user = supabase.auth.admin.get_user_by_id(agent_id)
            curr_user_meta = dict(getattr(target_user.user, "user_metadata", {}) or {})
            curr_app_meta = dict(getattr(target_user.user, "app_metadata", {}) or {})
            curr_user_meta["status"] = "suspended"
            curr_app_meta["status"] = "suspended"

            supabase.auth.admin.update_user_by_id(
                agent_id,
                {
                    "user_metadata": curr_user_meta,
                    "app_metadata": curr_app_meta,
                    "ban_duration": "876000h"
                }
            )
        except Exception as ue:
            logger.warning(f"Auth ban failed: {ue}")

        try:
            supabase.table("agents").update({"status": "suspended"}).or_(f"id.eq.{agent_id},auth_id.eq.{agent_id}").execute()
        except Exception:
            pass

        try:
            supabase.table("customers").update({"role": "suspended"}).eq("auth_id", agent_id).execute()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Error suspending agent {agent_id}: {e}")
    finally:
        invalidate_roster_cache()
        clear_auth_cache_for_user(agent_id)
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
