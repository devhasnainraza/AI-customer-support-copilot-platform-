"""
Notification Service - In-App, Browser Push, Email
Multi-channel notification system for the role-based architecture.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from uuid import uuid4

logger = logging.getLogger(__name__)


class NotificationChannel:
    IN_APP = "in_app"
    PUSH = "push"
    EMAIL = "email"


class Notification:
    def __init__(
        self, recipient_id: str, recipient_role: str, notification_type: str,
        title: str, message: str, priority: str = "medium",
        channels: Optional[List[str]] = None, data: Optional[dict] = None,
        sender_id: Optional[str] = None,
    ):
        self.id = str(uuid4())
        self.recipient_id = recipient_id
        self.recipient_role = recipient_role
        self.type = notification_type
        self.title = title
        self.message = message
        self.priority = priority
        self.channels = channels or [NotificationChannel.IN_APP]
        self.data = data or {}
        self.sender_id = sender_id
        self.read = False
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.delivered: Dict[str, bool] = {}

    def to_dict(self) -> dict:
        return {
            "id": self.id, "recipient_id": self.recipient_id,
            "recipient_role": self.recipient_role, "type": self.type,
            "title": self.title, "message": self.message,
            "priority": self.priority, "channels": self.channels,
            "data": self.data, "sender_id": self.sender_id,
            "read": self.read, "created_at": self.created_at,
        }


class NotificationRule:
    def __init__(self, name: str, trigger: str, channels: List[str],
                 recipients: str, priority: str = "medium", enabled: bool = True):
        self.id = str(uuid4())
        self.name = name
        self.trigger = trigger
        self.channels = channels
        self.recipients = recipients
        self.priority = priority
        self.enabled = enabled
        self.created_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "trigger": self.trigger,
            "channels": self.channels, "recipients": self.recipients,
            "priority": self.priority, "enabled": self.enabled,
            "created_at": self.created_at,
        }


class NotificationService:
    def __init__(self):
        self._notifications: Dict[str, Notification] = {}
        self._rules: Dict[str, NotificationRule] = {}
        self._push_subscriptions: Dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._init_default_rules()

    def _init_default_rules(self):
        defaults = [
            NotificationRule(name="New Handoff Request", trigger="handoff.created",
                channels=["in_app", "push"], recipients="all_agents", priority="high"),
            NotificationRule(name="Escalation to Manager", trigger="escalation.created",
                channels=["in_app", "push", "email"], recipients="managers", priority="critical"),
            NotificationRule(name="Agent Offline", trigger="agent.offline",
                channels=["in_app"], recipients="managers", priority="medium"),
            NotificationRule(name="New Ticket Created", trigger="ticket.created",
                channels=["in_app"], recipients="managers", priority="low"),
        ]
        for rule in defaults:
            self._rules[rule.id] = rule

    async def create_notification(self, recipient_id: str, recipient_role: str,
        notification_type: str, title: str, message: str, priority: str = "medium",
        channels: Optional[List[str]] = None, data: Optional[dict] = None,
        sender_id: Optional[str] = None) -> Notification:
        async with self._lock:
            n = Notification(recipient_id, recipient_role, notification_type,
                title, message, priority, channels, data, sender_id)
            self._notifications[n.id] = n
            return n

    async def get_user_notifications(self, user_id: str, unread_only: bool = False,
                                     limit: int = 50) -> List[dict]:
        notifs = [n for n in self._notifications.values()
                  if n.recipient_id == user_id and (not unread_only or not n.read)]
        notifs.sort(key=lambda n: n.created_at, reverse=True)
        return [n.to_dict() for n in notifs[:limit]]

    async def mark_read(self, notification_id: str, user_id: str) -> bool:
        async with self._lock:
            n = self._notifications.get(notification_id)
            if not n or n.recipient_id != user_id:
                return False
            n.read = True
            return True

    async def mark_all_read(self, user_id: str) -> int:
        async with self._lock:
            count = 0
            for n in self._notifications.values():
                if n.recipient_id == user_id and not n.read:
                    n.read = True
                    count += 1
            return count

    async def get_unread_count(self, user_id: str) -> int:
        return len([n for n in self._notifications.values()
                    if n.recipient_id == user_id and not n.read])

    async def create_rule(self, name: str, trigger: str, channels: List[str],
                          recipients: str, priority: str = "medium") -> NotificationRule:
        async with self._lock:
            rule = NotificationRule(name, trigger, channels, recipients, priority)
            self._rules[rule.id] = rule
            return rule

    async def get_rules(self) -> List[dict]:
        return [r.to_dict() for r in self._rules.values()]

    async def update_rule(self, rule_id: str, **kwargs) -> Optional[NotificationRule]:
        async with self._lock:
            rule = self._rules.get(rule_id)
            if not rule:
                return None
            for key, value in kwargs.items():
                if hasattr(rule, key):
                    setattr(rule, key, value)
            return rule

    async def delete_rule(self, rule_id: str) -> bool:
        async with self._lock:
            return self._rules.pop(rule_id, None) is not None

    # ── Push Notifications ────────────────────────────────────────────

    def get_or_generate_vapid_keys(self) -> dict:
        """Return VAPID keys (generate on first call, persist in memory).
        Public key is base64url-encoded raw public key bytes (for PushManager.subscribe)."""
        if not hasattr(self, '_vapid_private') or not self._vapid_private:
            try:
                from py_vapid import Vapid
                vapid = Vapid()
                vapid.generate_keys()
                self._vapid_private = vapid.private_pem()
                self._vapid_public = vapid.public_pem()
                logger.info("VAPID keys generated (py-vapid)")
            except ImportError:
                # Fallback: generate ECDSA P-256 key pair
                import base64
                from cryptography.hazmat.primitives.asymmetric import ec
                from cryptography.hazmat.primitives import serialization
                private_key = ec.generate_private_key(ec.SECP256R1())
                self._vapid_private = private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                ).decode()
                # Get raw public key bytes (65 bytes uncompressed point)
                pub_numbers = private_key.public_key().public_numbers()
                x_bytes = pub_numbers.x.to_bytes(32, 'big')
                y_bytes = pub_numbers.y.to_bytes(32, 'big')
                raw_pub = b'\x04' + x_bytes + y_bytes  # 65 bytes uncompressed
                self._vapid_public = base64.urlsafe_b64encode(raw_pub).rstrip(b'=').decode()
                logger.info("VAPID keys generated (cryptography fallback)")
        return {
            "public_key": self._vapid_public,
            "private_key": self._vapid_private,
        }

    def get_vapid_public_key(self) -> str:
        """Return just the public key for frontend subscription."""
        keys = self.get_or_generate_vapid_keys()
        return keys["public_key"]

    async def subscribe_push(self, user_id: str, subscription: dict):
        async with self._lock:
            self._push_subscriptions[user_id] = subscription
            logger.info(f"Push subscription registered for user {user_id}")

    async def unsubscribe_push(self, user_id: str):
        async with self._lock:
            self._push_subscriptions.pop(user_id, None)
            logger.info(f"Push subscription removed for user {user_id}")

    def get_push_subscription(self, user_id: str) -> Optional[dict]:
        return self._push_subscriptions.get(user_id)

    async def send_push_notification(self, user_id: str, title: str, body: str,
                                      icon: str = "/icons/notification.png",
                                      url: str = "/", data: Optional[dict] = None) -> bool:
        """Send a Web Push notification to a subscribed user."""
        subscription = self._push_subscriptions.get(user_id)
        if not subscription:
            logger.debug(f"No push subscription for user {user_id}")
            return False

        payload = {
            "title": title,
            "body": body,
            "icon": icon,
            "url": url,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            import httpx
            import json
            import base64
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import ec

            endpoint = subscription.get("endpoint", "")
            keys = subscription.get("keys", {})
            p256dh = keys.get("p256dh", "")
            auth = keys.get("auth", "")

            if not endpoint or not p256dh or not auth:
                logger.warning(f"Invalid push subscription for user {user_id}")
                return False

            # For demo purposes, we'll send via the Push API relay
            # In production, use py-webpush or similar library
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    endpoint,
                    content=json.dumps(payload).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "TTL": "86400",
                    },
                )
                if resp.status_code in (200, 201, 202):
                    logger.info(f"Push notification sent to user {user_id}")
                    return True
                else:
                    logger.warning(f"Push notification failed for user {user_id}: {resp.status_code}")
                    # Remove invalid subscription
                    if resp.status_code in (404, 410):
                        await self.unsubscribe_push(user_id)
                    return False

        except ImportError:
            logger.warning("httpx not available for push notifications")
            return False
        except Exception as e:
            logger.error(f"Push notification error for user {user_id}: {e}")
            return False

    async def broadcast_push(self, title: str, body: str, role: Optional[str] = None,
                              icon: str = "/icons/notification.png", url: str = "/") -> int:
        """Send push notification to all subscribed users (optionally filtered by role)."""
        sent = 0
        for user_id, sub in self._push_subscriptions.items():
            success = await self.send_push_notification(user_id, title, body, icon, url)
            if success:
                sent += 1
        logger.info(f"Broadcast push: sent to {sent}/{len(self._push_subscriptions)} users")
        return sent

    def get_push_stats(self) -> dict:
        """Get push notification statistics."""
        return {
            "total_subscriptions": len(self._push_subscriptions),
            "subscribed_user_ids": list(self._push_subscriptions.keys()),
            "vapid_configured": bool(self._vapid_public if hasattr(self, '_vapid_public') else False),
        }


# Global singleton
notification_service = NotificationService()
