"""
Email Notification Service - Resend API Integration with Sandbox Fallback
Sends critical alerts, escalation notifications, and system emails.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class EmailTemplate:
    """Pre-built HTML email templates for common notifications."""

    @staticmethod
    def base_layout(content: str, accent_color: str = "#6366f1") -> str:
        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <div style="background:{accent_color};padding:24px 32px;">
        <h1 style="margin:0;color:white;font-size:18px;font-weight:800;letter-spacing:-0.02em;">Copilot Platform</h1>
        <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;">Enterprise AI Customer Support</p>
      </div>
      <div style="padding:32px;">
        {content}
      </div>
      <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-weight:500;">
          AI Support Copilot &bull; Verified Notification Dispatch &bull; {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
        </p>
      </div>
    </div>
  </div>
</body>
</html>"""

    @staticmethod
    def escalation_alert(agent_name: str, customer_name: str, issue: str,
                         priority: str, ticket_id: str) -> tuple[str, str]:
        """Escalation alert email for managers."""
        subject = f"[CRITICAL] Escalation Alert: {customer_name} — {ticket_id}"
        priority_badge = {"critical": "#ef4444", "high": "#f97316", "medium": "#eab308"}
        color = priority_badge.get(priority, "#6366f1")
        content = f"""
        <div style="border-left:4px solid {color};padding:16px;background:#fef2f2;border-radius:8px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:800;color:#dc2626;text-transform:uppercase;">Priority Escalation: {priority.upper()}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:120px;font-weight:600;">Ticket ID</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f172a;font-family:monospace;">{ticket_id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Customer</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;">{customer_name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Assigned Agent</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;">{agent_name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Issue Context</td><td style="padding:8px 0;font-size:13px;color:#0f172a;line-height:1.5;">{issue}</td></tr>
        </table>
        <a href="http://localhost:3000/manager/escalations" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">Open Escalation Cockpit &rarr;</a>
        """
        return subject, EmailTemplate.base_layout(content, "#ef4444")

    @staticmethod
    def handoff_notification(agent_name: str, customer_name: str,
                             issue_summary: str) -> tuple[str, str]:
        """New handoff request notification for agents."""
        subject = f"New Handoff Request from {customer_name}"
        content = f"""
        <div style="border-left:4px solid #4f46e5;padding:16px;background:#eef2ff;border-radius:8px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:800;color:#4338ca;text-transform:uppercase;">Live Customer Handoff Request</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:120px;font-weight:600;">Customer</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f172a;">{customer_name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Summary</td><td style="padding:8px 0;font-size:13px;color:#0f172a;line-height:1.5;">{issue_summary}</td></tr>
        </table>
        <a href="http://localhost:3000/agent" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">Claim Conversation &rarr;</a>
        """
        return subject, EmailTemplate.base_layout(content, "#4f46e5")

    @staticmethod
    def ticket_created(ticket_id: str, customer_name: str, category: str,
                       subject_text: str) -> tuple[str, str]:
        """New ticket notification for managers."""
        subject = f"Ticket Created: {subject_text} — {ticket_id}"
        content = f"""
        <div style="border-left:4px solid #10b981;padding:16px;background:#ecfdf5;border-radius:8px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:800;color:#047857;text-transform:uppercase;">New Support Case Generated</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:120px;font-weight:600;">Ticket #</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f172a;font-family:monospace;">{ticket_id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Customer</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;">{customer_name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Category</td><td style="padding:8px 0;font-size:13px;color:#0f172a;">{category}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;">Summary</td><td style="padding:8px 0;font-size:13px;color:#0f172a;line-height:1.5;">{subject_text}</td></tr>
        </table>
        <a href="http://localhost:3000/tickets" style="display:inline-block;padding:12px 24px;background:#059669;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">View Ticket Details &rarr;</a>
        """
        return subject, EmailTemplate.base_layout(content, "#10b981")

    @staticmethod
    def system_alert(title: str, message: str, severity: str = "warning") -> tuple[str, str]:
        subject = f"[SYSTEM {severity.upper()}] {title}"
        content = f"""
        <div style="border-left:4px solid #f59e0b;padding:16px;background:#fffbeb;border-radius:8px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;font-weight:800;color:#b45309;text-transform:uppercase;">System Telemetry Alert</p>
        </div>
        <p style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px;">{title}</p>
        <p style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:24px;">{message}</p>
        <a href="http://localhost:3000/admin" style="display:inline-block;padding:12px 24px;background:#1e293b;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">Open Admin Console &rarr;</a>
        """
        return subject, EmailTemplate.base_layout(content, "#f59e0b")

    @staticmethod
    def custom(to: str, subject_text: str, heading: str, body_html: str,
               accent: str = "#6366f1") -> tuple[str, str]:
        content = f"""
        <h2 style="font-size:16px;font-weight:800;color:#0f172a;margin-top:0;margin-bottom:16px;">{heading}</h2>
        <div style="font-size:13px;color:#334155;line-height:1.6;">{body_html}</div>
        """
        return subject_text, EmailTemplate.base_layout(content, accent)


class EmailDeliveryRecord:
    def __init__(self, to: str, subject: str, template: str = "custom", body_html: str = ""):
        self.id = str(uuid4())
        self.to = to
        self.subject = subject
        self.template = template
        self.body_html = body_html
        self.status = "pending"
        self.error: Optional[str] = None
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.sent_at: Optional[str] = None
        self.mode = "api"  # "resend" or "simulated"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "to": self.to,
            "subject": self.subject,
            "template": self.template,
            "status": self.status,
            "error": self.error,
            "created_at": self.created_at,
            "sent_at": self.sent_at,
            "mode": self.mode,
            "has_body": bool(self.body_html),
        }


import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from src.config.settings import settings

class EmailService:
    def __init__(self):
        self._records: Dict[str, EmailDeliveryRecord] = {}
        self._config = {
            "api_key": os.getenv("RESEND_API_KEY", os.getenv("EMAIL_API_KEY", "")),
            "from_email": settings.email_from or os.getenv("EMAIL_FROM", "developerhasnainraza@gmail.com"),
            "from_name": os.getenv("EMAIL_FROM_NAME", "AI Support Copilot"),
        }
        self._templates: Dict[str, dict] = {
            "escalation_alert": {
                "name": "Escalation Alert",
                "description": "Critical escalation notification to managers",
                "trigger": "escalation.created",
                "recipients": "managers",
            },
            "handoff_notification": {
                "name": "Handoff Request",
                "description": "New handoff request for available agents",
                "trigger": "handoff.created",
                "recipients": "agents",
            },
            "ticket_created": {
                "name": "Ticket Created",
                "description": "New support ticket notification",
                "trigger": "ticket.created",
                "recipients": "managers",
            },
            "system_alert": {
                "name": "System Alert",
                "description": "System health and error notifications",
                "trigger": "system.alert",
                "recipients": "admins",
            },
        }
        mode = "SMTP (Gmail)" if settings.smtp_host else ("Resend API" if self._config["api_key"] else "dev sandbox mode")
        logger.info(f"EmailService initialized (Mode: {mode})")

    @property
    def has_smtp(self) -> bool:
        return bool(settings.smtp_host and settings.smtp_password)

    @property
    def is_configured(self) -> bool:
        return self.has_smtp or bool(self._config["api_key"] and self._config["api_key"].strip())

    def get_config(self) -> dict:
        mode = "live_smtp" if self.has_smtp else ("live_resend" if self._config["api_key"] else "sandbox_simulation")
        return {
            "configured": self.is_configured,
            "from_email": settings.email_from or self._config["from_email"],
            "from_name": self._config["from_name"],
            "has_api_key": self.is_configured,
            "smtp_host": settings.smtp_host,
            "mode": mode,
        }

    def update_config(self, api_key: Optional[str] = None,
                      from_email: Optional[str] = None,
                      from_name: Optional[str] = None) -> dict:
        if api_key is not None:
            self._config["api_key"] = api_key.strip()
        if from_email is not None and from_email.strip():
            self._config["from_email"] = from_email.strip()
        if from_name is not None and from_name.strip():
            self._config["from_name"] = from_name.strip()
        return self.get_config()

    def _send_smtp_sync(self, to: str, subject: str, html: str) -> None:
        """Synchronous SMTP sender run in background thread."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        from_addr = settings.email_from or self._config["from_email"]
        from_name = self._config["from_name"]
        msg["From"] = f"{from_name} <{from_addr}>"
        msg["To"] = to

        # Plain-text fallback
        plain = "Please open this email in an HTML-capable email client to view the notification content."
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        timeout = 15
        port = int(settings.smtp_port) if settings.smtp_port else 587
        if port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=timeout) as server:
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, port, timeout=timeout) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except Exception:
                    pass
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)

    async def send_email(self, to: str, subject: str, html: str,
                         template: str = "custom") -> EmailDeliveryRecord:
        """Send an email via configured SMTP (Gmail), Resend API, or fallback sandbox."""
        record = EmailDeliveryRecord(to, subject, template, html)

        # 1. Primary: SMTP (Gmail SMTP configured in .env)
        if self.has_smtp:
            try:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, self._send_smtp_sync, to, subject, html)
                record.status = "sent"
                record.mode = "smtp"
                record.sent_at = datetime.now(timezone.utc).isoformat()
                logger.info(f"Email dispatched via SMTP ({settings.smtp_host}): '{subject}' -> {to}")
                self._records[record.id] = record
                return record
            except Exception as e:
                logger.error(f"SMTP dispatch failed ({settings.smtp_host}) for {to}: {e}", exc_info=True)
                record.error = f"SMTP ({settings.smtp_host}): {str(e)}"

        # 2. Secondary: Resend HTTP API
        if self._config.get("api_key") and self._config["api_key"].strip():
            try:
                import httpx
                async with httpx.AsyncClient(timeout=12) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {self._config['api_key']}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "from": f"{self._config['from_name']} <{self._config['from_email']}>",
                            "to": [to],
                            "subject": subject,
                            "html": html,
                        },
                    )

                    if resp.status_code in (200, 201):
                        record.status = "sent"
                        record.mode = "resend"
                        record.sent_at = datetime.now(timezone.utc).isoformat()
                        logger.info(f"Email dispatched via Resend: '{subject}' -> {to}")
                        self._records[record.id] = record
                        return record
                    else:
                        error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
                        err_msg = error_data.get("message", f"HTTP {resp.status_code}")
                        logger.warning(f"Resend API error: {err_msg}")
                        record.error = f"Resend API: {err_msg}"
            except Exception as e:
                logger.warning(f"Resend request error: {e}")
                record.error = f"Resend: {str(e)}"

        # 3. Fallback: Dev Sandbox Delivery (Registers record if no live provider succeeded)
        if not record.status or record.status == "pending":
            record.status = "sent" if not record.error else "failed"
            record.mode = "simulated"
            record.sent_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"[Email Sandbox Dispatch] To: {to} | Subject: '{subject}' | Status: {record.status}")

        self._records[record.id] = record
        return record

    async def send_escalation_alert(self, manager_email: str, agent_name: str,
                                     customer_name: str, issue: str,
                                     priority: str, ticket_id: str) -> EmailDeliveryRecord:
        subject, html = EmailTemplate.escalation_alert(
            agent_name, customer_name, issue, priority, ticket_id
        )
        return await self.send_email(manager_email, subject, html, "escalation_alert")

    async def send_handoff_notification(self, agent_email: str, customer_name: str,
                                        issue_summary: str) -> EmailDeliveryRecord:
        subject, html = EmailTemplate.handoff_notification(
            "Support Agent", customer_name, issue_summary
        )
        return await self.send_email(agent_email, subject, html, "handoff_notification")

    async def send_ticket_notification(self, manager_email: str, ticket_id: str,
                                       customer_name: str, category: str,
                                       subject_text: str) -> EmailDeliveryRecord:
        subject, html = EmailTemplate.ticket_created(
            ticket_id, customer_name, category, subject_text
        )
        return await self.send_email(manager_email, subject, html, "ticket_created")

    async def send_system_alert(self, admin_email: str, title: str,
                                 message: str, severity: str = "warning") -> EmailDeliveryRecord:
        subject, html = EmailTemplate.system_alert(title, message, severity)
        return await self.send_email(admin_email, subject, html, "system_alert")

    async def send_custom_email(self, to: str, subject_text: str,
                                 heading: str, body_html: str,
                                 accent: str = "#6366f1") -> EmailDeliveryRecord:
        subject, html = EmailTemplate.custom(to, subject_text, heading, body_html, accent)
        return await self.send_email(to, subject, html, "custom")

    def get_delivery_history(self, limit: int = 50) -> List[dict]:
        records = sorted(self._records.values(), key=lambda r: r.created_at, reverse=True)
        return [r.to_dict() for r in records[:limit]]

    def get_record_html(self, record_id: str) -> Optional[str]:
        record = self._records.get(record_id)
        return record.body_html if record else None

    def get_email_stats(self) -> dict:
        total = len(self._records)
        sent = sum(1 for r in self._records.values() if r.status == "sent")
        failed = sum(1 for r in self._records.values() if r.status == "failed")
        pending = sum(1 for r in self._records.values() if r.status == "pending")
        return {
            "total": total,
            "sent": sent,
            "failed": failed,
            "pending": pending,
            "success_rate": f"{(sent / total * 100):.1f}%" if total > 0 else "100%",
            "configured": self.is_configured,
            "from_email": self._config["from_email"],
            "mode": "live_resend" if self.is_configured else "sandbox_simulation",
        }

    def get_templates(self) -> List[dict]:
        return [{"id": k, **v} for k, v in self._templates.items()]


# Global singleton
email_service = EmailService()
