"""
Auth Routes - Password Reset via SMTP (Resend)
Sends a password reset email using the configured SMTP provider.
"""
import asyncio
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from src.config.settings import settings
from src.config.supabase import get_service_client
from src.utils.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

# ── Request / Response Models ──────────────────────────────────────────

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetResponse(BaseModel):
    message: str

class AdminSignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = "User"


@router.post("/admin-signup")
@rate_limit(max_requests=5, window_seconds=300)
async def admin_signup(request: Request, req: AdminSignUpRequest):
    """
    Auto-confirm user signup using Supabase Service Role.
    Bypasses SMTP email rate limits.
    """
    supabase = get_service_client()
    try:
        # Check existing user
        users_resp = supabase.auth.admin.list_users()
        existing_user = None
        for u in users_resp:
            if u.email.lower() == req.email.lower():
                existing_user = u
                break

        if existing_user:
            supabase.auth.admin.update_user_by_id(
                existing_user.id,
                {
                    "password": req.password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": req.full_name,
                        "role": "customer",
                        "email_verified": True
                    }
                }
            )
            user_id = existing_user.id
        else:
            res = supabase.auth.admin.create_user({
                "email": req.email,
                "password": req.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": req.full_name,
                    "role": "customer",
                    "email_verified": True
                }
            })
            user_id = res.user.id

        # Sync customer DB
        cust_res = supabase.table("customers").select("*").eq("auth_id", user_id).execute()
        if not cust_res.data:
            supabase.table("customers").insert({
                "auth_id": user_id,
                "email": req.email,
                "name": req.full_name,
                "role": "customer",
                "tenant_id": "00000000-0000-0000-0000-000000000000"
            }).execute()
        else:
            supabase.table("customers").update({
                "email": req.email,
                "name": req.full_name,
                "role": "customer"
            }).eq("auth_id", user_id).execute()

        return {"message": "Account created and auto-confirmed successfully!", "user_id": user_id}
    except Exception as e:
        logger.error(f"Admin signup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Helpers ─────────────────────────────────────────────────────────────

def _build_reset_email_html(reset_url: str) -> str:
    """Build a premium HTML email for password reset."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#ec4899 100%);padding:32px 40px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background:rgba(255,255,255,0.2);color:#fff;font-weight:800;font-size:22px;text-align:center;margin-bottom:12px;">C</div>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Copilot Portal</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">AI Customer Support</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:800;">Reset Your Password</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:22px;">
                We received a request to reset the password for your account. Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="{reset_url}" target="_blank"
                       style="display:inline-block;padding:14px 36px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:18px;">
                This link will expire in <strong style="color:#64748b;">1 hour</strong>. If you didn't request this reset, you can safely ignore this email.
              </p>
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:16px;">
                If the button doesn't work, copy and paste this URL into your browser:<br>
                <a href="{reset_url}" style="color:#6366f1;word-break:break-all;font-size:11px;">{reset_url}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;text-align:center;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">&copy; 2026 AI Customer Support Copilot Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def _send_smtp_email(to_email: str, subject: str, html_body: str) -> None:
    """Send email via configured SMTP (Resend)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Copilot Portal <{settings.email_from}>"
    msg["To"] = to_email

    # Plain-text fallback
    plain = "You requested a password reset. Please open this email in an HTML-capable client to see the reset link."
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    loop = asyncio.get_running_loop()

    def _send():
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_password:
                server.starttls()
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)

    await loop.run_in_executor(None, _send)


# ── Endpoint ────────────────────────────────────────────────────────────

@router.post("/request-password-reset", response_model=PasswordResetResponse)
@rate_limit(max_requests=5, window_seconds=300)
async def request_password_reset(request: Request, body: PasswordResetRequest):
    """
    Send a password reset email to the user.

    Strategy (fallback chain):
    1. Generate a recovery link via Supabase Admin API.
    2. Try sending it through the configured SMTP provider (Resend).
    3. If SMTP fails (e.g. unverified sender domain), fall back to
       Supabase's built-in password reset email which uses their own SMTP.
    """
    email = body.email.lower().strip()

    # Always return success to prevent email enumeration attacks,
    # but only actually send the email if the user exists.
    success_msg = "If an account with that email exists, a password reset link has been sent."

    try:
        supabase = get_service_client()

        # Check if user exists in Supabase Auth (admin API)
        users_response = supabase.auth.admin.list_users()
        user_match = None
        for u in users_response:
            if hasattr(u, 'email') and u.email and u.email.lower() == email:
                user_match = u
                break

        if not user_match:
            logger.info(f"Password reset requested for non-existent email: {email}")
            return PasswordResetResponse(message=success_msg)

        redirect_to = f"{settings.frontend_url}/reset-password"

        # ── Step 1: Generate recovery link via Supabase Admin API ───────
        action_link = None
        try:
            link_response = supabase.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {
                    "redirect_to": redirect_to
                }
            })
            if hasattr(link_response, 'properties') and hasattr(link_response.properties, 'action_link'):
                action_link = link_response.properties.action_link
            elif isinstance(link_response, dict):
                action_link = link_response.get('properties', {}).get('action_link')
        except Exception as e:
            logger.warning(f"generate_link failed for {email}: {e}")

        # ── Step 2: Try sending via SMTP (Resend) ──────────────────────
        smtp_sent = False
        if action_link and settings.smtp_host and settings.smtp_password:
            try:
                html_body = _build_reset_email_html(action_link)
                await _send_smtp_email(
                    to_email=email,
                    subject="Reset Your Password — Copilot Portal",
                    html_body=html_body,
                )
                smtp_sent = True
                logger.info(f"Password reset email sent to {email} via SMTP")
            except Exception as e:
                logger.warning(
                    f"SMTP send failed for {email} (will fall back to Supabase): {e}"
                )

        # ── Step 3: Fallback to Supabase built-in email ────────────────
        if not smtp_sent:
            try:
                supabase.auth.reset_password_for_email(
                    email,
                    options={"redirect_to": redirect_to}
                )
                logger.info(f"Password reset email sent to {email} via Supabase built-in")
            except Exception as e:
                logger.error(
                    f"Supabase built-in reset also failed for {email}: {e}",
                    exc_info=True,
                )

        return PasswordResetResponse(message=success_msg)

    except Exception as e:
        logger.error(f"Password reset error for {email}: {e}", exc_info=True)
        # Still return success to prevent enumeration
        return PasswordResetResponse(message=success_msg)
