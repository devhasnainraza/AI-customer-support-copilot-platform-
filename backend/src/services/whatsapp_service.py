"""
WhatsApp Business API Service
Handles Meta Cloud API integration for omnichannel customer support.
Supports: webhook verification, incoming/outgoing messages, template messages,
conversation tracking, delivery status, and quick replies.
"""
import asyncio
import hashlib
import hmac
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

import httpx

logger = logging.getLogger(__name__)

# ── Internal conversation ↔ WhatsApp mapping ──────────────────────────────────
# Each WhatsApp chat is linked to an internal conversation so agents can
# reply from the Copilot UI and customers receive replies on WhatsApp.


class WhatsAppMessage:
    """Represents a single WhatsApp message (in or out)."""

    def __init__(
        self,
        wa_message_id: str,
        direction: str,  # "inbound" | "outbound"
        from_number: str,
        to_number: str,
        message_type: str,  # text | image | template | interactive | etc.
        text: str = "",
        media_url: str = "",
        template_name: str = "",
        status: str = "sent",  # sent | delivered | read | failed
        timestamp: Optional[str] = None,
    ):
        self.id = str(uuid4())
        self.wa_message_id = wa_message_id
        self.direction = direction
        self.from_number = from_number
        self.to_number = to_number
        self.message_type = message_type
        self.text = text
        self.media_url = media_url
        self.template_name = template_name
        self.status = status
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.created_at = self.created_at_ts = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "wa_message_id": self.wa_message_id,
            "direction": self.direction,
            "from_number": self.from_number,
            "to_number": self.to_number,
            "message_type": self.message_type,
            "text": self.text,
            "media_url": self.media_url,
            "template_name": self.template_name,
            "status": self.status,
            "timestamp": self.timestamp,
        }


class WhatsAppConversation:
    """Tracks a WhatsApp conversation mapped to an internal conversation."""

    def __init__(
        self,
        wa_chat_id: str,
        customer_phone: str,
        customer_name: str = "",
        internal_conversation_id: str = "",
        status: str = "active",  # active | archived | bot_handled
    ):
        self.id = str(uuid4())
        self.wa_chat_id = wa_chat_id
        self.customer_phone = customer_phone
        self.customer_name = customer_name
        self.internal_conversation_id = internal_conversation_id
        self.status = status
        self.messages: List[WhatsAppMessage] = []
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.last_message_at = self.created_at
        self.unread_count = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "wa_chat_id": self.wa_chat_id,
            "customer_phone": self.customer_phone,
            "customer_name": self.customer_name,
            "internal_conversation_id": self.internal_conversation_id,
            "status": self.status,
            "message_count": len(self.messages),
            "last_message_at": self.last_message_at,
            "unread_count": self.unread_count,
            "last_message": self.messages[-1].to_dict() if self.messages else None,
        }


class WhatsAppTemplate:
    """Pre-approved Meta message template."""

    def __init__(
        self,
        name: str,
        language: str = "en",
        category: str = "UTILITY",
        status: str = "approved",
        parameters: Optional[List[dict]] = None,
        components: Optional[List[dict]] = None,
    ):
        self.name = name
        self.language = language
        self.category = category
        self.status = status
        self.parameters = parameters or []
        self.components = components or []
        self.times_used = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "language": self.language,
            "category": self.category,
            "status": self.status,
            "parameters": self.parameters,
            "components": self.components,
            "times_used": self.times_used,
        }


class WhatsAppService:
    """Full WhatsApp Business API integration service."""

    META_API_VERSION = "v21.0"
    META_BASE_URL = "https://graph.facebook.com"

    def __init__(self):
        import os
        from src.config.settings import settings

        # Config from settings / environment variables
        self.access_token: str = settings.whatsapp_access_token or os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        self.phone_number_id: str = settings.whatsapp_phone_number_id or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        self.business_account_id: str = settings.whatsapp_business_account_id or os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        self.verify_token: str = settings.whatsapp_verify_token or os.getenv("WHATSAPP_VERIFY_TOKEN", "copilot_meta_verify_2026")
        self.app_secret: str = settings.whatsapp_app_secret or os.getenv("WHATSAPP_APP_SECRET", "")
        self.business_phone: str = settings.whatsapp_display_phone or os.getenv("WHATSAPP_DISPLAY_PHONE", "+18005550199")
        self.business_name: str = settings.whatsapp_business_name or os.getenv("WHATSAPP_BUSINESS_NAME", "AI Support Copilot")
        self.display_phone_number: str = self.business_phone
        self.notification_phone: str = settings.whatsapp_notification_phone or os.getenv("WHATSAPP_NOTIFICATION_PHONE", "+18005550199")

        # Connection state
        self.connected: bool = bool(self.access_token and self.phone_number_id)

        # In-memory stores
        self._conversations: Dict[str, WhatsAppConversation] = {}
        self._templates: Dict[str, WhatsAppTemplate] = {}
        self._message_status: Dict[str, str] = {}  # wa_message_id → status
        self._notification_history: List[dict] = []
        self._lock = asyncio.Lock()

        # Seed some demo templates
        self._seed_templates()
        mode = "Meta Cloud API" if self.connected else "Sandbox Simulation Mode"
        logger.info(f"WhatsAppService initialized (Mode: {mode}, Notification Phone: {self.notification_phone})")

    # ── Configuration ─────────────────────────────────────────────────────

    async def configure(
        self,
        access_token: str,
        phone_number_id: str,
        business_account_id: str = "",
        verify_token: str = "",
        app_secret: str = "",
        business_name: str = "",
        display_phone_number: str = "",
        notification_phone: str = "",
    ) -> dict:
        """Save WhatsApp Business API credentials and verify the connection."""
        async with self._lock:
            self.access_token = access_token
            self.phone_number_id = phone_number_id
            self.business_account_id = business_account_id
            self.verify_token = verify_token or f"copilot-verify-{uuid4().hex[:12]}"
            self.app_secret = app_secret
            self.business_name = business_name
            self.display_phone_number = display_phone_number
            if notification_phone:
                self.notification_phone = notification_phone

        # Verify the token by calling the Meta API
        verified = await self._verify_connection()
        self.connected = verified

        if verified:
            logger.info(f"WhatsApp connected: {self.business_name} ({self.display_phone_number})")
        else:
            logger.warning("WhatsApp connection verification failed — stored config (sandbox mode available)")

        return self.get_status()

    async def update_notification_phone(self, phone: str) -> str:
        async with self._lock:
            self.notification_phone = phone.strip()
            logger.info(f"WhatsApp notification destination phone updated to: {self.notification_phone}")
            return self.notification_phone

    async def disconnect(self) -> bool:
        async with self._lock:
            self.connected = False
            self.access_token = ""
        return True

    def get_status(self) -> dict:
        mode = "live_meta_api" if (self.connected and self.access_token) else "sandbox_simulation"
        return {
            "connected": self.connected,
            "business_name": self.business_name,
            "display_phone_number": self.display_phone_number,
            "notification_phone": self.notification_phone,
            "phone_number_id": self.phone_number_id,
            "business_account_id": self.business_account_id,
            "verify_token": self.verify_token,
            "webhook_configured": bool(self.verify_token),
            "mode": mode,
        }

    # ── Meta API helpers ──────────────────────────────────────────────────

    async def _api_get(self, endpoint: str, params: Optional[dict] = None) -> Optional[dict]:
        """Make an authenticated GET request to the Meta Graph API."""
        if not self.access_token:
            return None
        url = f"{self.META_BASE_URL}/{self.META_API_VERSION}/{endpoint}"
        params = params or {}
        params["access_token"] = self.access_token
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    return resp.json()
                logger.error(f"Meta API GET {endpoint} failed: {resp.status_code} {resp.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"Meta API GET {endpoint} error: {e}")
            return None

    async def _api_post(self, endpoint: str, data: dict) -> Optional[dict]:
        """Make an authenticated POST request to the Meta Graph API."""
        if not self.access_token:
            return None
        url = f"{self.META_BASE_URL}/{self.META_API_VERSION}/{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=data, params={"access_token": self.access_token})
                if resp.status_code in (200, 201):
                    return resp.json()
                logger.error(f"Meta API POST {endpoint} failed: {resp.status_code} {resp.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"Meta API POST {endpoint} error: {e}")
            return None

    async def _verify_connection(self) -> bool:
        """Verify access token is valid by fetching the phone number info."""
        result = await self._api_get(f"{self.phone_number_id}")
        if result and "display_phone_number" in result:
            self.display_phone_number = result.get("display_phone_number", self.display_phone_number)
            if not self.business_name:
                self.business_name = result.get("verified_name", "WhatsApp Business")
            return True
        return False

    # ── Webhook handling ──────────────────────────────────────────────────

    def verify_webhook(self, mode: str, token: str, challenge: str) -> Optional[str]:
        """Meta webhook verification challenge."""
        if mode == "subscribe" and token == self.verify_token:
            logger.info("Webhook verified successfully")
            return challenge
        logger.warning(f"Webhook verification failed: mode={mode}")
        return None

    def validate_signature(self, payload: bytes, signature: str) -> bool:
        """Validate X-Hub-Signature-256 from Meta."""
        if not self.app_secret:
            return True  # Skip validation if no secret configured
        expected = hmac.new(
            self.app_secret.encode(), payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)

    async def handle_webhook_event(self, event: dict) -> List[dict]:
        """
        Process an incoming Meta webhook event.
        Returns a list of processed message dicts.
        """
        processed = []

        for entry in event.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") != "messages":
                    continue
                value = change.get("value", {})

                # Handle incoming messages
                for msg in value.get("messages", []):
                    result = await self._process_incoming_message(msg, value)
                    if result:
                        processed.append(result)

                # Handle status updates
                for status in value.get("statuses", []):
                    await self._process_status_update(status)

        return processed

    async def _process_incoming_message(self, msg: dict, context: dict) -> Optional[dict]:
        """Process a single incoming WhatsApp message."""
        wa_msg_id = msg.get("id", "")
        from_number = msg.get("from", "")
        msg_type = msg.get("type", "text")
        timestamp = msg.get("timestamp", "")

        # Extract text content
        text = ""
        if msg_type == "text":
            text = msg.get("text", {}).get("body", "")
        elif msg_type == "image":
            text = "[Image received]"
        elif msg_type == "audio":
            text = "[Audio received]"
        elif msg_type == "video":
            text = "[Video received]"
        elif msg_type == "document":
            text = "[Document received]"
        elif msg_type == "interactive":
            interactive = msg.get("interactive", {})
            if interactive.get("type") == "button_reply":
                text = interactive.get("button_reply", {}).get("title", "")
            elif interactive.get("type") == "list_reply":
                text = interactive.get("list_reply", {}).get("title", "")

        # Get customer name from contacts
        contacts = context.get("contacts", [])
        customer_name = ""
        for c in contacts:
            if c.get("wa_id") == from_number:
                customer_name = c.get("profile", {}).get("name", "")
                break

        # Find or create conversation
        conv = await self._get_or_create_conversation(from_number, customer_name)

        # Create message
        wa_msg = WhatsAppMessage(
            wa_message_id=wa_msg_id,
            direction="inbound",
            from_number=from_number,
            to_number=self.display_phone_number,
            message_type=msg_type,
            text=text,
            timestamp=datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat() if timestamp else None,
        )
        conv.messages.append(wa_msg)
        conv.last_message_at = wa_msg.timestamp
        conv.unread_count += 1

        logger.info(f"WhatsApp inbound [{msg_type}] from {from_number}: {text[:80]}")

        result = {
            "conversation_id": conv.id,
            "internal_conversation_id": conv.internal_conversation_id,
            "message": wa_msg.to_dict(),
            "customer_name": customer_name,
            "customer_phone": from_number,
        }

        # Broadcast to connected admin WebSocket clients
        await self._broadcast_event({
            "type": "new_message",
            "direction": "inbound",
            "conversation": conv.to_dict(),
            "message": wa_msg.to_dict(),
        })

        return result

    async def _process_status_update(self, status: dict) -> None:
        """Update message delivery status from Meta callbacks."""
        msg_id = status.get("id", "")
        new_status = status.get("status", "")
        if msg_id and new_status:
            self._message_status[msg_id] = new_status
            logger.debug(f"WhatsApp status update: {msg_id} → {new_status}")
            # Broadcast status update to admin clients
            await self._broadcast_event({
                "type": "status_update",
                "message_id": msg_id,
                "status": new_status,
            })

    async def _broadcast_event(self, event: dict) -> None:
        """Broadcast an event to all connected WhatsApp admin WebSocket clients."""
        try:
            from src.api.routes.whatsapp_ws import whatsapp_ws_manager
            if whatsapp_ws_manager.active_count > 0:
                await whatsapp_ws_manager.broadcast(event)
        except Exception as e:
            logger.debug(f"WhatsApp WS broadcast skipped: {e}")

    async def _get_or_create_conversation(self, phone: str, name: str = "") -> WhatsAppConversation:
        """Find existing conversation by phone or create a new one."""
        for conv in self._conversations.values():
            if conv.customer_phone == phone:
                if name and not conv.customer_name:
                    conv.customer_name = name
                return conv

        conv = WhatsAppConversation(
            wa_chat_id=f"wa_{uuid4().hex[:16]}",
            customer_phone=phone,
            customer_name=name,
        )
        self._conversations[conv.id] = conv
        return conv

    async def _find_conversation_by_phone(self, phone: str) -> Optional[WhatsAppConversation]:
        """Find an existing WhatsApp conversation by phone number."""
        clean_phone = phone.replace(" ", "").replace("-", "")
        for conv in self._conversations.values():
            conv_clean = conv.customer_phone.replace(" ", "").replace("-", "")
            if conv_clean == clean_phone:
                return conv
        return None

    # ── Sending messages ──────────────────────────────────────────────────

    async def send_text_message(self, to_number: str, text: str) -> Optional[dict]:
        """Send a plain text message via Meta Cloud API with sandbox simulation fallback."""
        data = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": text},
        }
        result = await self._api_post(f"{self.phone_number_id}/messages", data)
        if result:
            wa_msg_id = result.get("messages", [{}])[0].get("id", "")
            msg = WhatsAppMessage(
                wa_message_id=wa_msg_id,
                direction="outbound",
                from_number=self.display_phone_number,
                to_number=to_number,
                message_type="text",
                text=text,
            )
            msg.status = "sent"
            conv = await self._find_conversation_by_phone(to_number)
            if not conv:
                conv = await self._get_or_create_conversation(to_number, "WhatsApp Contact")
            conv.messages.append(msg)
            conv.last_message_at = msg.timestamp

            logger.info(f"WhatsApp Meta API outbound text to {to_number}: {text[:80]}")
            await self._broadcast_event({
                "type": "new_message",
                "direction": "outbound",
                "conversation": conv.to_dict() if conv else None,
                "message": msg.to_dict(),
            })
            ret = msg.to_dict()
            ret["mode"] = "meta_cloud"
            return ret
        else:
            # Fallback: Sandbox / Simulated Delivery Dispatch
            wa_msg_id = f"sim_wa_{uuid4().hex[:16]}"
            msg = WhatsAppMessage(
                wa_message_id=wa_msg_id,
                direction="outbound",
                from_number=self.display_phone_number,
                to_number=to_number,
                message_type="text",
                text=text,
            )
            msg.status = "delivered"
            conv = await self._find_conversation_by_phone(to_number)
            if not conv:
                conv = await self._get_or_create_conversation(to_number, "Alert Recipient")
            conv.messages.append(msg)
            conv.last_message_at = msg.timestamp

            logger.info(f"[WhatsApp Sandbox Dispatch] Outbound text to {to_number}: {text[:80]}")
            await self._broadcast_event({
                "type": "new_message",
                "direction": "outbound",
                "conversation": conv.to_dict() if conv else None,
                "message": msg.to_dict(),
            })
            ret = msg.to_dict()
            ret["mode"] = "simulated"
            return ret

    async def send_notification(
        self,
        to_phone: str,
        title: str,
        message: str,
        priority: str = "medium",
        data: Optional[dict] = None,
    ) -> dict:
        """Format and dispatch an enterprise alert notification via WhatsApp."""
        priority_emoji = {
            "critical": "🚨 [CRITICAL ALERT]",
            "high": "⚡ [HIGH PRIORITY]",
            "medium": "📢 [NOTIFICATION]",
            "low": "ℹ️ [INFO]",
        }.get(priority.lower(), "📢 [NOTIFICATION]")

        time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        formatted_text = (
            f"*{priority_emoji} {title}*\n\n"
            f"{message}\n\n"
            f"📅 *Time:* {time_str}\n"
            f"🛡️ *Support Copilot Platform*"
        )
        if data and "ticket_id" in data:
            formatted_text += f"\n🎫 *Ticket:* #{data['ticket_id']}"
        if data and "conversation_id" in data:
            formatted_text += f"\n💬 *Chat ID:* {str(data['conversation_id'])[:8]}"

        target_phone = to_phone or self.notification_phone or self.display_phone_number
        result = await self.send_text_message(target_phone, formatted_text)
        record = {
            "id": result.get("id") or str(uuid4()),
            "to": target_phone,
            "title": title,
            "message": message,
            "priority": priority,
            "status": "sent" if result else "failed",
            "mode": result.get("mode", "simulated") if result else "failed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "formatted_text": formatted_text,
        }
        self._notification_history.append(record)
        return record

    def get_notification_history(self, limit: int = 50) -> List[dict]:
        """Return history of dispatched WhatsApp notifications."""
        return list(reversed(self._notification_history))[:limit]

    async def send_template_message(
        self,
        to_number: str,
        template_name: str,
        language: str = "en",
        parameters: Optional[List[dict]] = None,
    ) -> Optional[dict]:
        """Send a pre-approved template message."""
        template = {
            "name": template_name,
            "language": {"code": language},
        }
        if parameters:
            template["components"] = [{"type": "body", "parameters": parameters}]

        data = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "template",
            "template": template,
        }
        result = await self._api_post(f"{self.phone_number_id}/messages", data)
        if result:
            wa_msg_id = result.get("messages", [{}])[0].get("id", "")
            msg = WhatsAppMessage(
                wa_message_id=wa_msg_id,
                direction="outbound",
                from_number=self.display_phone_number,
                to_number=to_number,
                message_type="template",
                template_name=template_name,
            )
            conv = await self._find_conversation_by_phone(to_number)
            if conv:
                conv.messages.append(msg)
                conv.last_message_at = msg.timestamp

            # Update template usage count
            if template_name in self._templates:
                self._templates[template_name].times_used += 1

            logger.info(f"WhatsApp outbound template '{template_name}' to {to_number}")
            return msg.to_dict()
        return None

    async def send_interactive_message(
        self,
        to_number: str,
        body_text: str,
        buttons: Optional[List[dict]] = None,
        footer: str = "",
    ) -> Optional[dict]:
        """Send an interactive message with quick-reply buttons."""
        interactive = {
            "type": "button",
            "body": {"text": body_text},
        }
        if buttons:
            interactive["action"] = {
                "buttons": [
                    {"type": "reply", "reply": {"id": b.get("id", f"btn_{i}"), "title": b.get("title", "")}}
                    for i, b in enumerate(buttons[:3])  # Meta allows max 3 buttons
                ]
            }
        if footer:
            interactive["footer"] = {"text": footer}

        data = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "interactive",
            "interactive": interactive,
        }
        result = await self._api_post(f"{self.phone_number_id}/messages", data)
        if result:
            wa_msg_id = result.get("messages", [{}])[0].get("id", "")
            msg = WhatsAppMessage(
                wa_message_id=wa_msg_id,
                direction="outbound",
                from_number=self.display_phone_number,
                to_number=to_number,
                message_type="interactive",
                text=body_text,
            )
            conv = await self._find_conversation_by_phone(to_number)
            if conv:
                conv.messages.append(msg)
                conv.last_message_at = msg.timestamp
            return msg.to_dict()
        return None

    async def _find_conversation_by_phone(self, phone: str) -> Optional[WhatsAppConversation]:
        for conv in self._conversations.values():
            if conv.customer_phone == phone:
                return conv
        return None

    # ── Conversations ─────────────────────────────────────────────────────

    def list_conversations(self, status: Optional[str] = None) -> List[dict]:
        convs = list(self._conversations.values())
        if status:
            convs = [c for c in convs if c.status == status]
        # Sort by last message time, newest first
        convs.sort(key=lambda c: c.last_message_at or "", reverse=True)
        return [c.to_dict() for c in convs]

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        conv = self._conversations.get(conversation_id)
        if not conv:
            return None
        data = conv.to_dict()
        data["messages"] = [m.to_dict() for m in conv.messages]
        return data

    async def archive_conversation(self, conversation_id: str) -> bool:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.status = "archived"
            return True
        return False

    # ── Templates ─────────────────────────────────────────────────────────

    def _seed_templates(self):
        """Seed some default message templates."""
        defaults = [
            WhatsAppTemplate("order_update", "en", "UTILITY", "approved",
                             parameters=[{"type": "text", "text": "{{1}}"}]),
            WhatsAppTemplate("welcome_message", "en", "MARKETING", "approved",
                             parameters=[{"type": "text", "text": "{{1}}"}]),
            WhatsAppTemplate("appointment_reminder", "en", "UTILITY", "approved",
                             parameters=[
                                 {"type": "text", "text": "{{1}}"},
                                 {"type": "text", "text": "{{2}}"},
                             ]),
            WhatsAppTemplate("support_ticket_update", "en", "UTILITY", "approved",
                             parameters=[
                                 {"type": "text", "text": "{{1}}"},
                                 {"type": "text", "text": "{{2}}"},
                             ]),
            WhatsAppTemplate("feedback_request", "en", "MARKETING", "approved",
                             parameters=[{"type": "text", "text": "{{1}}"}]),
        ]
        for t in defaults:
            self._templates[t.name] = t

    async def sync_templates_from_meta(self) -> List[dict]:
        """Fetch templates from the Meta Business Account."""
        if not self.business_account_id:
            return list(self.templates_list())

        result = await self._api_get(
            f"{self.business_account_id}/message_templates",
            params={"status": "APPROVED"},
        )
        if result and "data" in result:
            async with self._lock:
                for t in result["data"]:
                    template = WhatsAppTemplate(
                        name=t.get("name", ""),
                        language=t.get("language", "en"),
                        category=t.get("category", "UTILITY"),
                        status=t.get("status", "PENDING").lower(),
                    )
                    self._templates[template.name] = template
            logger.info(f"Synced {len(result['data'])} templates from Meta")

        return list(self.templates_list())

    def templates_list(self) -> List[dict]:
        return [t.to_dict() for t in self._templates.values()]

    def create_template(self, name: str, language: str, category: str, body: str, parameters: Optional[List[dict]] = None) -> dict:
        template = WhatsAppTemplate(name, language, category, "pending", parameters)
        self._templates[name] = template
        return template.to_dict()

    def delete_template(self, name: str) -> bool:
        if name in self._templates:
            del self._templates[name]
            return True
        return False

    # ── Analytics ─────────────────────────────────────────────────────────

    def get_analytics(self) -> dict:
        total_conversations = len(self._conversations)
        active_conversations = len([c for c in self._conversations.values() if c.status == "active"])
        total_messages = sum(len(c.messages) for c in self._conversations.values())
        inbound_messages = sum(
            1 for c in self._conversations.values()
            for m in c.messages if m.direction == "inbound"
        )
        outbound_messages = total_messages - inbound_messages

        # Template usage
        templates_used = sum(t.times_used for t in self._templates.values())

        # Message status breakdown
        statuses = {}
        for c in self._conversations.values():
            for m in c.messages:
                if m.direction == "outbound":
                    statuses[m.status] = statuses.get(m.status, 0) + 1

        return {
            "connected": self.connected,
            "total_conversations": total_conversations,
            "active_conversations": active_conversations,
            "total_messages": total_messages,
            "inbound_messages": inbound_messages,
            "outbound_messages": outbound_messages,
            "templates_available": len(self._templates),
            "templates_used": templates_used,
            "message_statuses": statuses,
        }


# ── Global singleton ─────────────────────────────────────────────────────
whatsapp_service = WhatsAppService()
