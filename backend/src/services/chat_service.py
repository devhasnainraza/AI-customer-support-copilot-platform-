"""
Chat Service - Conversation and Message CRUD
T040: ChatService with conversation management
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import logging

from src.config.supabase import get_service_client
from src.models.conversation import (
    Conversation,
    ConversationCreate,
    ConversationUpdate,
    ConversationStatus
)
from src.models.message import Message, MessageCreate

logger = logging.getLogger(__name__)


class ChatService:
    """Service for managing conversations and messages"""

    @staticmethod
    async def create_conversation(
        customer_id: UUID,
        tenant_id: UUID,
        language: str
    ) -> Conversation:
        """
        Create a new conversation

        Args:
            customer_id: Customer UUID
            tenant_id: Tenant UUID
            language: ISO 639-1 language code

        Returns:
            Created conversation
        """
        supabase = get_service_client()

        try:
            data = {
                "customer_id": str(customer_id),
                "tenant_id": str(tenant_id),
                "language": language,
                "status": ConversationStatus.ACTIVE,
                "ai_resolution": False,
            }

            try:
                result = supabase.table("conversations").insert(data).execute()
            except Exception as insert_err:
                # If foreign key constraint failed, ensure customer row exists and retry
                logger.warning(f"Initial conversation insert failed ({insert_err}), verifying customer row...")
                try:
                    cust_chk = supabase.table("customers").select("id").eq("id", str(customer_id)).execute()
                    if not cust_chk.data:
                        # Also check by auth_id
                        by_auth = supabase.table("customers").select("id").eq("auth_id", str(customer_id)).execute()
                        if by_auth.data:
                            data["customer_id"] = str(by_auth.data[0]["id"])
                        else:
                            supabase.table("customers").insert({
                                "id": str(customer_id),
                                "auth_id": str(customer_id),
                                "email": f"customer_{str(customer_id)[:8]}@example.com",
                                "name": "Customer",
                                "role": "customer",
                                "tenant_id": str(tenant_id),
                            }).execute()
                    result = supabase.table("conversations").insert(data).execute()
                except Exception as retry_err:
                    logger.error(f"Retry conversation insert failed: {retry_err}")
                    raise retry_err

            if not result.data:
                raise Exception("Failed to create conversation")

            logger.info(f"Conversation created: {result.data[0]['id']}")
            return Conversation(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to create conversation: {e}")
            raise

    @staticmethod
    async def get_conversation(conversation_id: UUID) -> Optional[Conversation]:
        """Get conversation by ID"""
        supabase = get_service_client()

        try:
            result = supabase.table("conversations").select("*").eq("id", str(conversation_id)).execute()

            if not result.data:
                return None

            return Conversation(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to get conversation {conversation_id}: {e}")
            raise

    @staticmethod
    async def get_customer_conversations(
        customer_id: UUID,
        alternate_customer_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[Conversation]:
        """Get all conversations for a customer (supporting primary & alternate customer ids, excluding blank sessions)"""
        supabase = get_service_client()

        try:
            query = supabase.table("conversations").select("*, messages(id)")
            if alternate_customer_id and str(alternate_customer_id) != str(customer_id):
                query = query.or_(f"customer_id.eq.{customer_id},customer_id.eq.{alternate_customer_id}")
            else:
                query = query.eq("customer_id", str(customer_id))

            result = query.order("started_at", desc=True).limit(limit).execute()

            non_empty_convs = []
            for conv in result.data:
                msgs = conv.pop("messages", [])
                if msgs and len(msgs) > 0:
                    non_empty_convs.append(Conversation(**conv))

            return non_empty_convs

        except Exception as e:
            logger.error(f"Failed to get conversations for customer {customer_id}: {e}")
            raise

    @staticmethod
    async def update_conversation(
        conversation_id: UUID,
        update: ConversationUpdate
    ) -> Conversation:
        """Update conversation"""
        supabase = get_service_client()

        try:
            # Build update data. mode="json" serializes UUID/datetime values so
            # the PostgREST JSON payload is valid.
            data = update.model_dump(mode="json", exclude_none=True)

            # NOTE: the conversations table has no `updated_at` column; writing
            # one returns PGRST204 and fails every escalate/close.

            result = (
                supabase.table("conversations")
                .update(data)
                .eq("id", str(conversation_id))
                .execute()
            )

            if not result.data:
                raise Exception(f"Conversation {conversation_id} not found")

            logger.info(f"Conversation updated: {conversation_id}")
            return Conversation(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to update conversation {conversation_id}: {e}")
            raise

    @staticmethod
    async def create_message(message: MessageCreate) -> Message:
        """Create a new message in a conversation"""
        supabase = get_service_client()

        try:
            data = {
                "conversation_id": str(message.conversation_id),
                "tenant_id": str(message.tenant_id),
                "sender_id": str(message.sender_id),
                "sender_type": message.sender_type.value,
                "content": message.content,
                "confidence_score": message.confidence_score,
                "retrieved_chunks": message.retrieved_chunks,
                "metadata": message.metadata,
            }

            result = supabase.table("messages").insert(data).execute()

            if not result.data:
                raise Exception("Failed to create message")

            logger.info(f"Message created: {result.data[0]['id']}")
            return Message(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to create message: {e}")
            raise

    @staticmethod
    async def get_conversation_messages(
        conversation_id: UUID,
        limit: int = 100
    ) -> List[Message]:
        """Get all messages for a conversation"""
        supabase = get_service_client()

        try:
            result = (
                supabase.table("messages")
                .select("*")
                .eq("conversation_id", str(conversation_id))
                .order("timestamp", desc=False)
                .limit(limit)
                .execute()
            )

            return [Message(**msg) for msg in result.data]

        except Exception as e:
            logger.error(f"Failed to get messages for conversation {conversation_id}: {e}")
            raise

    @staticmethod
    async def escalate_conversation(
        conversation_id: UUID,
        agent_id: Optional[UUID] = None
    ) -> Conversation:
        """Escalate conversation to human agent"""
        update = ConversationUpdate(
            status=ConversationStatus.ESCALATED,
            assigned_agent_id=agent_id
        )

        conversation = await ChatService.update_conversation(conversation_id, update)

        logger.info(f"Conversation {conversation_id} escalated to agent {agent_id}")
        return conversation

    @staticmethod
    async def close_conversation(
        conversation_id: UUID,
        ai_resolution: bool = False
    ) -> Conversation:
        """Close a conversation"""
        update = ConversationUpdate(
            status=ConversationStatus.CLOSED,
            ended_at=datetime.utcnow(),
            ai_resolution=ai_resolution
        )

        conversation = await ChatService.update_conversation(conversation_id, update)

        logger.info(f"Conversation {conversation_id} closed (AI resolution: {ai_resolution})")
        return conversation
