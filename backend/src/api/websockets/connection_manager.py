"""
WebSocket Connection Manager
T053: Manage active WebSocket connections
"""
from fastapi import WebSocket
from typing import Dict, Set
from uuid import UUID
import logging
import asyncio

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections for real-time chat

    Maintains mappings:
    - connection_id -> WebSocket
    - conversation_id -> Set[connection_id]
    - user_id -> Set[connection_id]
    """

    def __init__(self):
        # Active connections: connection_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

        # Conversation subscriptions: conversation_id -> Set[connection_id]
        self.conversation_connections: Dict[str, Set[str]] = {}

        # User connections: user_id -> Set[connection_id]
        self.user_connections: Dict[str, Set[str]] = {}

        # Connection metadata: connection_id -> dict
        self.connection_metadata: Dict[str, dict] = {}

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: str,
        conversation_id: str = None
    ):
        """
        Accept and register a new WebSocket connection

        Args:
            websocket: WebSocket instance
            connection_id: Unique connection identifier
            user_id: User UUID
            conversation_id: Optional conversation UUID
        """
        await websocket.accept()

        # Store connection
        self.active_connections[connection_id] = websocket

        # Track user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection_id)

        # Track conversation subscriptions
        if conversation_id:
            if conversation_id not in self.conversation_connections:
                self.conversation_connections[conversation_id] = set()
            self.conversation_connections[conversation_id].add(connection_id)

        # Store metadata
        self.connection_metadata[connection_id] = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "connected_at": asyncio.get_event_loop().time()
        }

        logger.info(
            f"WebSocket connected: connection_id={connection_id}, "
            f"user_id={user_id}, conversation_id={conversation_id}"
        )

    def disconnect(self, connection_id: str):
        """
        Remove a WebSocket connection

        Args:
            connection_id: Connection identifier
        """
        if connection_id not in self.active_connections:
            return

        # Get metadata before removal
        metadata = self.connection_metadata.get(connection_id, {})
        user_id = metadata.get("user_id")
        conversation_id = metadata.get("conversation_id")

        # Remove from active connections
        del self.active_connections[connection_id]

        # Remove from user connections
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Remove from conversation connections
        if conversation_id and conversation_id in self.conversation_connections:
            self.conversation_connections[conversation_id].discard(connection_id)
            if not self.conversation_connections[conversation_id]:
                del self.conversation_connections[conversation_id]

        # Remove metadata
        if connection_id in self.connection_metadata:
            del self.connection_metadata[connection_id]

        logger.info(f"WebSocket disconnected: connection_id={connection_id}")

    async def send_personal_message(self, message: dict, connection_id: str):
        """
        Send message to specific connection

        Args:
            message: Message data (will be JSON serialized)
            connection_id: Target connection ID
        """
        if connection_id not in self.active_connections:
            logger.warning(f"Connection {connection_id} not found")
            return

        websocket = self.active_connections[connection_id]

        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send message to {connection_id}: {e}")
            # Connection may be dead, disconnect it
            self.disconnect(connection_id)

    async def send_to_conversation(self, message: dict, conversation_id: str):
        """
        Broadcast message to all connections subscribed to a conversation

        Args:
            message: Message data
            conversation_id: Conversation UUID
        """
        if conversation_id not in self.conversation_connections:
            logger.debug(f"No active connections for conversation {conversation_id}")
            return

        connection_ids = self.conversation_connections[conversation_id].copy()

        for connection_id in connection_ids:
            await self.send_personal_message(message, connection_id)

    async def send_to_user(self, message: dict, user_id: str):
        """
        Send message to all connections for a user

        Args:
            message: Message data
            user_id: User UUID
        """
        if user_id not in self.user_connections:
            logger.debug(f"No active connections for user {user_id}")
            return

        connection_ids = self.user_connections[user_id].copy()

        for connection_id in connection_ids:
            await self.send_personal_message(message, connection_id)

    def get_active_connections_count(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)

    def get_conversation_connections_count(self, conversation_id: str) -> int:
        """Get number of connections for a specific conversation"""
        return len(self.conversation_connections.get(conversation_id, set()))


# Global connection manager instance
manager = ConnectionManager()
