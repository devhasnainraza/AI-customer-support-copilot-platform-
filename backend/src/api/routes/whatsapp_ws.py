"""
WhatsApp WebSocket — Real-time admin notifications.
Broadcasts incoming messages, delivery status updates, and conversation events
to all connected admin/agent clients.
"""
import asyncio
import json
import logging
from typing import Dict, Set
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["whatsapp-ws"])


class WhatsAppAdminManager:
    """Manages WebSocket connections for WhatsApp admin real-time updates."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._user_roles: Dict[str, str] = {}  # connection_id → role
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, role: str = "admin") -> str:
        await websocket.accept()
        connection_id = str(uuid4())
        async with self._lock:
            self._connections[connection_id] = websocket
            self._user_roles[connection_id] = role
        logger.info(f"WhatsApp WS connected: {connection_id} (role={role})")
        return connection_id

    def disconnect(self, connection_id: str):
        self._connections.pop(connection_id, None)
        self._user_roles.pop(connection_id, None)
        logger.info(f"WhatsApp WS disconnected: {connection_id}")

    async def broadcast(self, event: dict):
        """Broadcast an event to all connected admin/manager/agent clients."""
        dead = []
        for cid, ws in self._connections.items():
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(cid)

    async def send_personal(self, connection_id: str, event: dict):
        ws = self._connections.get(connection_id)
        if ws:
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(connection_id)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Global singleton
whatsapp_ws_manager = WhatsAppAdminManager()


@router.websocket("/v1/whatsapp/ws")
async def whatsapp_admin_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time WhatsApp admin notifications.
    Sends: new_message, status_update, conversation_update, typing_indicator.
    """
    connection_id = await whatsapp_ws_manager.connect(websocket, role="admin")

    try:
        # Send initial connection confirmation
        await whatsapp_ws_manager.send_personal(connection_id, {
            "type": "connected",
            "connection_id": connection_id,
            "message": "WhatsApp real-time notifications active",
        })

        # Keep connection alive and listen for client messages (ping/pong, subscribe)
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(data)

                if msg.get("type") == "ping":
                    await whatsapp_ws_manager.send_personal(connection_id, {"type": "pong"})
                elif msg.get("type") == "subscribe_conversation":
                    # Client wants updates for a specific conversation
                    conv_id = msg.get("conversation_id", "")
                    await whatsapp_ws_manager.send_personal(connection_id, {
                        "type": "subscribed",
                        "conversation_id": conv_id,
                    })
                elif msg.get("type") == "read_receipt":
                    # Mark conversation messages as read
                    conv_id = msg.get("conversation_id", "")
                    from src.services.whatsapp_service import whatsapp_service
                    conv = whatsapp_service._conversations.get(conv_id)
                    if conv:
                        conv.unread_count = 0

            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WhatsApp WS error: {e}")
    finally:
        whatsapp_ws_manager.disconnect(connection_id)
