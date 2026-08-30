"""Notification API Routes - In-App, Push, Email"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging

from src.services.notification_service import notification_service
from src.services.email_service import email_service
from src.services.email_preference_service import email_preference_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    heading: str
    body_html: str
    accent: Optional[str] = "#6366f1"

class UpdateEmailConfigRequest(BaseModel):
    api_key: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None

class EscalationEmailRequest(BaseModel):
    manager_email: str
    agent_name: str
    customer_name: str
    issue: str
    priority: str = "high"
    ticket_id: str

class HandoffEmailRequest(BaseModel):
    agent_email: str
    customer_name: str
    issue_summary: str

class TicketEmailRequest(BaseModel):
    manager_email: str
    ticket_id: str
    customer_name: str
    category: str
    subject_text: str

class SystemAlertEmailRequest(BaseModel):
    admin_email: str
    title: str
    message: str
    severity: Optional[str] = "warning"

# User Notifications
@router.get("/user/{user_id}")
async def get_user_notifications(user_id: str, unread_only: bool = False, limit: int = 50):
    notifications = await notification_service.get_user_notifications(
        user_id, unread_only=unread_only, limit=limit
    )
    return {"notifications": notifications, "total": len(notifications)}

@router.get("/user/{user_id}/unread-count")
async def get_unread_count(user_id: str):
    count = await notification_service.get_unread_count(user_id)
    return {"count": count}

@router.post("/user/{user_id}/mark-read/{notification_id}")
async def mark_read(user_id: str, notification_id: str):
    success = await notification_service.mark_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}

@router.post("/user/{user_id}/mark-all-read")
async def mark_all_read(user_id: str):
    count = await notification_service.mark_all_read(user_id)
    return {"marked": count}

# Push Notifications
@router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key for frontend push subscription."""
    key = notification_service.get_vapid_public_key()
    return {"public_key": key}

@router.post("/push/subscribe/{user_id}")
async def subscribe_push(user_id: str, payload: PushSubscription):
    await notification_service.subscribe_push(user_id, payload.model_dump())
    return {"status": "subscribed"}

@router.post("/push/unsubscribe/{user_id}")
async def unsubscribe_push(user_id: str):
    await notification_service.unsubscribe_push(user_id)
    return {"status": "unsubscribed"}

@router.get("/push/stats")
async def push_stats():
    return notification_service.get_push_stats()

@router.post("/push/send/{user_id}")
async def send_push(user_id: str, payload: dict):
    """Send a push notification to a specific user."""
    success = await notification_service.send_push_notification(
        user_id=user_id,
        title=payload.get("title", "Notification"),
        body=payload.get("body", ""),
        icon=payload.get("icon", "/icons/notification.png"),
        url=payload.get("url", "/"),
        data=payload.get("data"),
    )
    return {"sent": success}

@router.post("/push/broadcast")
async def broadcast_push(payload: dict):
    """Send push notification to all subscribed users."""
    sent = await notification_service.broadcast_push(
        title=payload.get("title", "Notification"),
        body=payload.get("body", ""),
        role=payload.get("role"),
        icon=payload.get("icon", "/icons/notification.png"),
        url=payload.get("url", "/"),
    )
    return {"sent_to": sent}

# ── Email Notifications (Resend) ───────────────────────────────────────

@router.get("/email/config")
async def get_email_config():
    """Get email notification configuration status."""
    return email_service.get_config()

@router.post("/email/config")
async def update_email_config(payload: UpdateEmailConfigRequest):
    """Update email notification configuration (API key, sender)."""
    return email_service.update_config(
        api_key=payload.api_key,
        from_email=payload.from_email,
        from_name=payload.from_name,
    )

@router.get("/email/stats")
async def email_stats():
    """Get email delivery statistics."""
    return email_service.get_email_stats()

@router.get("/email/history")
async def email_history(limit: int = 50):
    """Get email delivery history."""
    return {"history": email_service.get_delivery_history(limit)}

@router.get("/email/templates")
async def email_templates():
    """List available email templates."""
    return {"templates": email_service.get_templates()}

@router.post("/email/send")
async def send_email(payload: SendEmailRequest):
    """Send a custom email notification."""
    record = await email_service.send_custom_email(
        to=payload.to, subject_text=payload.subject,
        heading=payload.heading, body_html=payload.body_html,
        accent=payload.accent,
    )
    return record.to_dict()

@router.post("/email/send/escalation")
async def send_escalation_email(payload: EscalationEmailRequest):
    """Send an escalation alert email to a manager."""
    record = await email_service.send_escalation_alert(
        manager_email=payload.manager_email, agent_name=payload.agent_name,
        customer_name=payload.customer_name, issue=payload.issue,
        priority=payload.priority, ticket_id=payload.ticket_id,
    )
    return record.to_dict()

@router.post("/email/send/handoff")
async def send_handoff_email(payload: HandoffEmailRequest):
    """Send a handoff notification email to an agent."""
    record = await email_service.send_handoff_notification(
        agent_email=payload.agent_email, customer_name=payload.customer_name,
        issue_summary=payload.issue_summary,
    )
    return record.to_dict()

@router.post("/email/send/ticket")
async def send_ticket_email(payload: TicketEmailRequest):
    """Send a new ticket notification email."""
    record = await email_service.send_ticket_notification(
        manager_email=payload.manager_email, ticket_id=payload.ticket_id,
        customer_name=payload.customer_name, category=payload.category,
        subject_text=payload.subject_text,
    )
    return record.to_dict()

@router.post("/email/send/system-alert")
async def send_system_alert_email(payload: SystemAlertEmailRequest):
    """Send a system alert email to an admin."""
    record = await email_service.send_system_alert(
        admin_email=payload.admin_email, title=payload.title,
        message=payload.message, severity=payload.severity,
    )
    return record.to_dict()

@router.post("/email/test")
async def send_test_email(payload: SendEmailRequest):
    """Send a test email to verify configuration."""
    record = await email_service.send_custom_email(
        to=payload.to, subject_text=payload.subject,
        heading=payload.heading, body_html=payload.body_html,
        accent=payload.accent,
    )
    return record.to_dict()

# ── Email Notification Preferences ──────────────────────────────────────

class UpdatePreferenceRequest(BaseModel):
    enabled: bool
    email: Optional[str] = ""

class BulkUpdatePreferencesRequest(BaseModel):
    preferences: Dict[str, bool]
    email: Optional[str] = ""

class RoleBulkUpdateRequest(BaseModel):
    role: str
    enabled: bool

@router.get("/email/preferences/{user_id}")
async def get_user_email_preferences(user_id: str, role: str = "customer", email: str = ""):
    """Get all email notification preferences for a user."""
    prefs = await email_preference_service.get_user_preferences(user_id, role, email)
    return {"preferences": prefs}

@router.post("/email/preferences/{user_id}")
async def update_user_email_preference(user_id: str, category: str, payload: UpdatePreferenceRequest):
    """Update a single email preference for a user."""
    pref = await email_preference_service.update_preference(
        user_id, category, payload.enabled, payload.email
    )
    if not pref:
        raise HTTPException(status_code=400, detail="Invalid category")
    return pref.to_dict()

@router.put("/email/preferences/{user_id}")
async def bulk_update_email_preferences(user_id: str, payload: BulkUpdatePreferencesRequest):
    """Update multiple email preferences at once."""
    results = await email_preference_service.update_multiple_preferences(
        user_id, payload.preferences, payload.email
    )
    return {"updated": len(results), "preferences": results}

@router.get("/email/preferences/stats")
async def email_preference_stats():
    """Get statistics about email preferences."""
    return await email_preference_service.get_preference_stats()

@router.get("/email/preferences/all")
async def get_all_email_preferences():
    """Admin: Get all user email preferences."""
    all_prefs = await email_preference_service.get_all_preferences()
    return {"preferences": all_prefs}

@router.post("/email/preferences/bulk-role")
async def bulk_update_role_preferences(payload: RoleBulkUpdateRequest):
    """Admin: Bulk update a category for all users of a role."""
    count = await email_preference_service.bulk_enable_for_role(
        payload.role, "all", payload.enabled
    )
    return {"updated": count}
