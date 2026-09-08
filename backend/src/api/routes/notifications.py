"""Notification API Routes - In-App, Push, Email"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging

from src.services.notification_service import notification_service
from src.services.email_service import email_service
from src.services.email_preference_service import email_preference_service
from src.services.whatsapp_service import whatsapp_service

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

from src.api.middleware.auth import get_optional_user

# User Notifications
@router.get("/user/{user_id}")
async def get_user_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    user_role = current_user.get("role", "customer") if current_user else "customer"
    if current_user and current_user.get("user_id") and str(current_user["user_id"]) != str(user_id) and user_role != "admin":
        user_id = str(current_user["user_id"])

    notifications = await notification_service.get_user_notifications(
        user_id, unread_only=unread_only, limit=limit, user_role=user_role
    )
    return {"notifications": notifications, "total": len(notifications)}

@router.get("/user/{user_id}/unread-count")
async def get_unread_count(
    user_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    user_role = current_user.get("role", "customer") if current_user else "customer"
    if current_user and current_user.get("user_id") and str(current_user["user_id"]) != str(user_id) and user_role != "admin":
        user_id = str(current_user["user_id"])

    count = await notification_service.get_unread_count(user_id, user_role=user_role)
    return {"count": count}

@router.post("/user/{user_id}/mark-read/{notification_id}")
async def mark_read(
    user_id: str,
    notification_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    if current_user and current_user.get("user_id") and str(current_user["user_id"]) != str(user_id):
        user_id = str(current_user["user_id"])
    success = await notification_service.mark_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}

@router.post("/user/{user_id}/mark-all-read")
async def mark_all_read(
    user_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    user_role = current_user.get("role", "customer") if current_user else "customer"
    if current_user and current_user.get("user_id") and str(current_user["user_id"]) != str(user_id):
        user_id = str(current_user["user_id"])
    count = await notification_service.mark_all_read(user_id, user_role=user_role)
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

@router.get("/email/preview/{record_id}")
async def preview_email_html(record_id: str):
    """Render the full HTML template of an email record for preview."""
    from fastapi.responses import HTMLResponse
    html = email_service.get_record_html(record_id)
    if not html:
        raise HTTPException(status_code=404, detail="Email record not found or no HTML preview available")
    return HTMLResponse(content=html)

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


# ── WhatsApp Notification Endpoints ─────────────────────────────────────

class SendWhatsAppNotificationRequest(BaseModel):
    to_phone: Optional[str] = None
    title: str = "Enterprise Support Alert"
    message: str = "This is a verified alert notification from AI Support Copilot."
    priority: str = "medium"
    data: Optional[dict] = None

class UpdateWhatsAppNotificationConfigRequest(BaseModel):
    notification_phone: str

class MultiChannelTestRequest(BaseModel):
    title: str = "🚨 Escalation & Support Test Alert"
    message: str = "Testing multi-channel notification delivery across WhatsApp and Email."
    priority: str = "high"
    to_email: Optional[str] = None
    to_phone: Optional[str] = None

@router.get("/whatsapp/config")
async def get_whatsapp_notification_config():
    """Get WhatsApp notification destination configuration and status."""
    return whatsapp_service.get_status()

@router.post("/whatsapp/config")
async def update_whatsapp_notification_config(payload: UpdateWhatsAppNotificationConfigRequest):
    """Update WhatsApp notification destination phone number."""
    phone = await whatsapp_service.update_notification_phone(payload.notification_phone)
    return {"status": "updated", "notification_phone": phone}

@router.get("/whatsapp/history")
async def get_whatsapp_notification_history(limit: int = 50):
    """Get list of dispatched WhatsApp notifications."""
    return {"history": whatsapp_service.get_notification_history(limit)}

@router.post("/whatsapp/test")
async def send_test_whatsapp_notification(payload: SendWhatsAppNotificationRequest):
    """Dispatch a test WhatsApp notification."""
    record = await whatsapp_service.send_notification(
        to_phone=payload.to_phone or "",
        title=payload.title,
        message=payload.message,
        priority=payload.priority,
        data=payload.data or {},
    )
    return {"status": "sent", "record": record}

@router.post("/test-multi-channel")
async def send_multi_channel_test_notification(payload: MultiChannelTestRequest):
    """Send a simultaneous test notification to both WhatsApp and Email."""
    from src.config.settings import settings
    from src.services.email_service import EmailTemplate

    results = {}

    # 1. Dispatch Email
    target_email = payload.to_email or settings.admin_notification_email or "admin@example.com"
    try:
        subject, html = EmailTemplate.custom(
            to=target_email,
            subject_text=f"[{payload.priority.upper()}] {payload.title}",
            heading=payload.title,
            body_html=f"<p style='font-size:14px;color:#0f172a;line-height:1.6;'>{payload.message}</p>"
                      f"<p style='margin-top:16px;font-size:12px;color:#64748b;'>"
                      f"<strong>Priority:</strong> <span style='color:#4f46e5;'>{payload.priority.upper()}</span> &bull; "
                      f"<strong>Channel:</strong> Multi-Channel Verification</p>",
            accent="#4f46e5" if payload.priority != "critical" else "#ef4444",
        )
        email_record = await email_service.send_email(
            to=target_email, subject=subject, html=html, template="system_alert"
        )
        results["email"] = {
            "status": email_record.status,
            "to": target_email,
            "mode": email_record.mode,
            "id": email_record.id,
            "error": email_record.error,
        }
    except Exception as e:
        results["email"] = {"status": "failed", "error": str(e)}

    # 2. Dispatch WhatsApp
    target_phone = payload.to_phone or whatsapp_service.notification_phone or "+18005550199"
    try:
        wa_record = await whatsapp_service.send_notification(
            to_phone=target_phone,
            title=payload.title,
            message=payload.message,
            priority=payload.priority,
            data={"test": True},
        )
        results["whatsapp"] = {
            "status": wa_record.get("status", "sent"),
            "to": target_phone,
            "mode": wa_record.get("mode", "simulated"),
            "id": wa_record.get("id"),
        }
    except Exception as e:
        results["whatsapp"] = {"status": "failed", "error": str(e)}

    return {
        "status": "completed",
        "title": payload.title,
        "results": results,
    }

