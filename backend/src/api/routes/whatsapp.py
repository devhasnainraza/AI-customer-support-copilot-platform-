"""
WhatsApp Business API Routes
Webhook endpoint, message sending, conversation management, templates, analytics.
"""
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List
import logging

from src.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/whatsapp", tags=["whatsapp"])


# ── Models ────────────────────────────────────────────────────────────────

class WhatsAppConfigure(BaseModel):
    access_token: str
    phone_number_id: str
    business_account_id: str = ""
    verify_token: str = ""
    app_secret: str = ""
    business_name: str = ""
    display_phone_number: str = ""


class SendMessage(BaseModel):
    to_number: str
    message: str


class SendTemplate(BaseModel):
    to_number: str
    template_name: str
    language: str = "en"
    parameters: Optional[List[dict]] = None


class SendInteractive(BaseModel):
    to_number: str
    body_text: str
    buttons: Optional[List[dict]] = None
    footer: str = ""


class TemplateCreate(BaseModel):
    name: str
    language: str = "en"
    category: str = "UTILITY"
    body: str = ""
    parameters: Optional[List[dict]] = None


# ── Webhook ───────────────────────────────────────────────────────────────

@router.get("/webhook")
async def webhook_verify(
    mode: str = Query("", alias="hub.mode"),
    token: str = Query("", alias="hub.verify_token"),
    challenge: str = Query("", alias="hub.challenge"),
):
    """Meta webhook verification endpoint."""
    result = whatsapp_service.verify_webhook(mode, token, challenge)
    if result:
        return PlainTextResponse(content=result)
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook")
async def webhook_event(request: Request):
    """Meta webhook event receiver."""
    body = await request.body()

    # Validate signature if configured
    signature = request.headers.get("X-Hub-Signature-256", "")
    if signature and not whatsapp_service.validate_signature(body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        import json
        event = json.loads(body)
        processed = await whatsapp_service.handle_webhook_event(event)
        return {"status": "ok", "processed": len(processed)}
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        return {"status": "error", "message": str(e)}


# ── Configuration ─────────────────────────────────────────────────────────

@router.get("/config")
async def get_whatsapp_config():
    """Get current WhatsApp connection status."""
    return whatsapp_service.get_status()


@router.post("/configure")
async def configure_whatsapp(payload: WhatsAppConfigure):
    """Configure and connect WhatsApp Business API."""
    return await whatsapp_service.configure(
        access_token=payload.access_token,
        phone_number_id=payload.phone_number_id,
        business_account_id=payload.business_account_id,
        verify_token=payload.verify_token,
        app_secret=payload.app_secret,
        business_name=payload.business_name,
        display_phone_number=payload.display_phone_number,
    )


@router.post("/disconnect")
async def disconnect_whatsapp():
    """Disconnect WhatsApp integration."""
    success = await whatsapp_service.disconnect()
    return {"status": "disconnected" if success else "error"}


@router.post("/test-connection")
async def test_connection():
    """Test the WhatsApp API connection."""
    if not whatsapp_service.connected:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    status = whatsapp_service.get_status()
    return {"status": "ok" if status["connected"] else "failed", **status}


# ── Send Messages ─────────────────────────────────────────────────────────

@router.post("/send/text")
async def send_text(payload: SendMessage):
    """Send a plain text message."""
    result = await whatsapp_service.send_text_message(payload.to_number, payload.message)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to send message")
    return result


@router.post("/send/template")
async def send_template(payload: SendTemplate):
    """Send a template message."""
    result = await whatsapp_service.send_template_message(
        payload.to_number, payload.template_name, payload.language, payload.parameters
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to send template")
    return result


@router.post("/send/interactive")
async def send_interactive(payload: SendInteractive):
    """Send an interactive message with buttons."""
    result = await whatsapp_service.send_interactive_message(
        payload.to_number, payload.body_text, payload.buttons, payload.footer
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to send interactive message")
    return result


# ── Conversations ─────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(status: Optional[str] = Query(None)):
    """List all WhatsApp conversations."""
    return {"conversations": whatsapp_service.list_conversations(status)}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation details with full message history."""
    conv = whatsapp_service.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(conversation_id: str):
    """Archive a WhatsApp conversation."""
    success = await whatsapp_service.archive_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "archived"}


# ── Templates ─────────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates():
    """List all message templates."""
    return {"templates": whatsapp_service.templates_list()}


@router.post("/templates")
async def create_template(payload: TemplateCreate):
    """Create a new message template."""
    template = whatsapp_service.create_template(
        payload.name, payload.language, payload.category, payload.body, payload.parameters
    )
    return template


@router.post("/templates/sync")
async def sync_templates():
    """Sync templates from Meta Business Account."""
    templates = await whatsapp_service.sync_templates_from_meta()
    return {"templates": templates, "count": len(templates)}


@router.delete("/templates/{template_name}")
async def delete_template(template_name: str):
    """Delete a message template."""
    success = whatsapp_service.delete_template(template_name)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}


# ── Analytics ─────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics():
    """Get WhatsApp messaging analytics."""
    return whatsapp_service.get_analytics()
