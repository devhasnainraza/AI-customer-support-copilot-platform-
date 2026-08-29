"""
Ticket Service - Support Ticket CRUD, classification, and event emission
T100-T102: TicketService implementation
"""
import logging
from datetime import datetime, date
from typing import List, Optional, Tuple
from uuid import UUID, uuid4

from src.config.supabase import get_service_client
from src.models.ticket import Ticket, TicketCreate, TicketUpdate, TicketDetail, TicketTimelineItem, TicketPriority, TicketStatus
from src.services.kafka_producer import send_kafka_event

logger = logging.getLogger(__name__)


class TicketService:
    """Service for managing support tickets"""

    @staticmethod
    def _is_ticket_number_conflict(error: Exception) -> bool:
        """
        Detect a UNIQUE-violation on tickets.ticket_number.

        PostgREST surfaces this as code 23505; the ticket_number index name is
        checked so a conversation_id conflict is not silently retried.
        """
        code = getattr(error, "code", None)
        message = str(error)
        if code != "23505" and "23505" not in message:
            return False
        return "ticket_number" in message

    @staticmethod
    def generate_ticket_number() -> str:
        """
        Generate ticket number matching format TICK-YYYYMMDD-NNNN
        T102: Unique sequential ticket number generator
        """
        supabase = get_service_client()
        today_str = date.today().strftime("%Y%m%d")
        prefix = f"TICK-{today_str}-"

        try:
            # Fetch all ticket numbers created today
            result = (
                supabase.table("tickets")
                .select("ticket_number")
                .like("ticket_number", f"{prefix}%")
                .execute()
            )

            max_num = 0
            for row in result.data:
                parts = row["ticket_number"].split("-")
                if len(parts) == 3:
                    try:
                        max_num = max(max_num, int(parts[2]))
                    except ValueError:
                        pass

            next_num = max_num + 1
            return f"{prefix}{next_num:04d}"

        except Exception as e:
            logger.error(f"Failed to generate ticket number: {e}")
            # Safe random/fallback format if query fails
            import random
            return f"TICK-{today_str}-{random.randint(1000, 9999)}"

    @staticmethod
    async def create_ticket(ticket: TicketCreate) -> Ticket:
        """
        Create a new support ticket
        T100: Create ticket record and emit event
        """
        supabase = get_service_client()

        try:
            # Initialize timeline in metadata
            initial_timeline = [
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "event": "ticket_created",
                    "from_value": None,
                    "to_value": TicketStatus.OPEN.value,
                    "actor_id": None,
                    "actor_name": "System (AI)"
                }
            ]

            metadata = ticket.metadata or {}
            metadata["timeline"] = initial_timeline

            data = {
                "tenant_id": str(ticket.tenant_id),
                "conversation_id": str(ticket.conversation_id),
                "ticket_number": None,  # assigned per attempt below
                "priority": ticket.priority.value,
                "status": TicketStatus.OPEN.value,
                "category": ticket.category,
                "assigned_team": ticket.assigned_team,
                "created_by": ticket.created_by.value,
                "ai_summary": ticket.ai_summary,
                "metadata": metadata
            }

            # ticket_number is generated read-max-then-insert, which races under
            # concurrency against the UNIQUE constraint. Re-read and retry.
            max_attempts = 5
            result = None
            last_error = None

            for attempt in range(max_attempts):
                data["ticket_number"] = TicketService.generate_ticket_number()
                try:
                    result = supabase.table("tickets").insert(data).execute()
                    break
                except Exception as insert_err:
                    if not TicketService._is_ticket_number_conflict(insert_err):
                        raise
                    last_error = insert_err
                    logger.warning(
                        f"Ticket number collision on attempt {attempt + 1}/{max_attempts}: "
                        f"{data['ticket_number']}"
                    )

            if result is None:
                raise Exception(
                    f"Failed to allocate a unique ticket number after {max_attempts} attempts"
                ) from last_error

            if not result.data:
                raise Exception("Failed to insert ticket record")

            created_ticket = Ticket(**result.data[0])
            logger.info(f"Ticket created successfully: {created_ticket.ticket_number}")

            # Emit Kafka event ticket.created (T111)
            try:
                send_kafka_event(
                    topic="ticket-events",
                    event_type="ticket.created",
                    payload={
                        "ticket_id": str(created_ticket.id),
                        "tenant_id": str(created_ticket.tenant_id),
                        "conversation_id": str(created_ticket.conversation_id),
                        "ticket_number": created_ticket.ticket_number,
                        "priority": created_ticket.priority.value,
                        "status": created_ticket.status.value,
                        "category": created_ticket.category,
                        "ai_summary": created_ticket.ai_summary
                    },
                    tenant_id=str(created_ticket.tenant_id),
                    correlation_id=str(created_ticket.id)
                )
            except Exception as e:
                logger.error(f"Failed to emit Kafka event for ticket {created_ticket.id}: {e}")

            return created_ticket

        except Exception as e:
            logger.error(f"Failed to create ticket: {e}")
            raise

    @staticmethod
    async def get_ticket(ticket_id: UUID) -> Optional[Ticket]:
        """Get ticket by ID"""
        supabase = get_service_client()

        try:
            result = supabase.table("tickets").select("*").eq("id", str(ticket_id)).execute()
            if not result.data:
                return None
            return Ticket(**result.data[0])
        except Exception as e:
            logger.error(f"Failed to get ticket {ticket_id}: {e}")
            raise

    @staticmethod
    async def get_ticket_detail(ticket_id: UUID) -> Optional[TicketDetail]:
        """
        Get ticket details, including customer info and conversation preview
        """
        supabase = get_service_client()

        try:
            # 1. Fetch ticket
            ticket_res = supabase.table("tickets").select("*").eq("id", str(ticket_id)).execute()
            if not ticket_res.data:
                return None
            t_row = ticket_res.data[0]

            # 2. Fetch conversation & customer details
            conv_id = t_row["conversation_id"]
            conv_res = (
                supabase.table("conversations")
                .select("customer_id, status, language, started_at")
                .eq("id", conv_id)
                .execute()
            )
            
            customer_data = {"id": str(uuid4()), "name": "Unknown Customer", "email": "unknown@example.com"}
            if conv_res.data:
                cust_id = conv_res.data[0]["customer_id"]
                cust_res = (
                    supabase.table("customers")
                    .select("id, name, email")
                    .eq("id", cust_id)
                    .execute()
                )
                if cust_res.data:
                    customer_data = {
                        "id": cust_res.data[0]["id"],
                        "name": cust_res.data[0].get("name") or "Customer",
                        "email": cust_res.data[0]["email"]
                    }

            # 3. Fetch conversation messages count & last preview
            msg_res = (
                supabase.table("messages")
                .select("content, timestamp")
                .eq("conversation_id", conv_id)
                .order("timestamp", desc=True)
                .execute()
            )

            msg_count = len(msg_res.data)
            last_message_at = t_row["created_at"]
            last_message_preview = ""
            if msg_res.data:
                last_message_at = msg_res.data[0]["timestamp"]
                last_message_preview = msg_res.data[0]["content"][:100]

            # 4. Resolve agent name if assigned
            agent_name = None
            if t_row.get("assigned_agent_id"):
                agent_res = (
                    supabase.table("customers")
                    .select("name")
                    .eq("id", t_row["assigned_agent_id"])
                    .execute()
                )
                if agent_res.data:
                    agent_name = agent_res.data[0].get("name") or "Agent"

            # 5. Extract timeline & notes from metadata
            metadata = t_row.get("metadata") or {}
            raw_timeline = metadata.get("timeline") or []
            timeline = [
                TicketTimelineItem(
                    timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
                    event=item["event"],
                    from_value=item.get("from_value"),
                    to_value=item["to_value"],
                    actor_id=UUID(item["actor_id"]) if item.get("actor_id") else None,
                    actor_name=item.get("actor_name")
                )
                for item in raw_timeline
            ]
            notes = metadata.get("notes") or []
 
            return TicketDetail(
                id=t_row["id"],
                tenant_id=t_row["tenant_id"],
                ticket_number=t_row["ticket_number"],
                conversation_id=UUID(t_row["conversation_id"]),
                priority=TicketPriority(t_row["priority"]),
                status=TicketStatus(t_row["status"]),
                category=t_row.get("category"),
                assigned_team=t_row.get("assigned_team"),
                assigned_agent_id=UUID(t_row["assigned_agent_id"]) if t_row.get("assigned_agent_id") else None,
                assigned_agent_name=agent_name,
                created_at=t_row["created_at"],
                resolved_at=t_row.get("resolved_at"),
                created_by=t_row["created_by"],
                ai_summary=t_row.get("ai_summary"),
                customer=customer_data,
                conversation_preview={
                    "message_count": msg_count,
                    "last_message_at": last_message_at,
                    "last_message_preview": last_message_preview
                },
                timeline=timeline,
                notes=notes
            )

        except Exception as e:
            logger.error(f"Failed to fetch ticket details for {ticket_id}: {e}")
            raise

    @staticmethod
    async def get_tenant_tickets(
        tenant_id: UUID,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assigned_agent_id: Optional[UUID] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Ticket], int]:
        """
        List tickets for a tenant with filters and pagination
        """
        supabase = get_service_client()

        try:
            query = supabase.table("tickets").select("*", count="exact").eq("tenant_id", str(tenant_id))

            if status:
                query = query.eq("status", status)
            if priority:
                query = query.eq("priority", priority)
            if assigned_agent_id:
                query = query.eq("assigned_agent_id", str(assigned_agent_id))

            result = (
                query.order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            tickets = [Ticket(**row) for row in result.data]
            total_count = result.count or len(tickets)

            return tickets, total_count

        except Exception as e:
            logger.error(f"Failed to get tickets: {e}")
            raise

    @staticmethod
    async def update_ticket(
        ticket_id: UUID,
        update: TicketUpdate,
        actor_id: Optional[UUID] = None,
        actor_name: str = "System"
    ) -> Ticket:
        """
        Update ticket and record state transition in timeline
        """
        supabase = get_service_client()

        try:
            # 1. Fetch current ticket to compare state changes
            current = await TicketService.get_ticket(ticket_id)
            if not current:
                raise Exception(f"Ticket {ticket_id} not found")

            # mode="json" serializes assigned_agent_id (UUID) and resolved_at
            # (datetime) so the PostgREST payload is valid JSON.
            data = update.model_dump(mode="json", exclude_none=True)

            # Enforce enums to string
            if "status" in data and data["status"]:
                data["status"] = TicketStatus(data["status"]).value
                # If resolved/closed, set resolved_at
                if data["status"] in [TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value]:
                    data["resolved_at"] = datetime.utcnow().isoformat()
            if "priority" in data and data["priority"]:
                data["priority"] = TicketPriority(data["priority"]).value

            # 2. Append timeline event if status/agent/priority changed
            metadata = current.metadata or {}
            timeline = metadata.get("timeline") or []
            
            changes_logged = False
            for field in ["status", "priority", "assigned_agent_id"]:
                if field in data and str(data[field]) != str(getattr(current, field)):
                    from_val = getattr(current, field)
                    timeline.append({
                        "timestamp": datetime.utcnow().isoformat(),
                        "event": f"{field}_changed",
                        "from_value": str(from_val.value) if hasattr(from_val, 'value') else (str(from_val) if from_val else None),
                        "to_value": str(data[field]),
                        "actor_id": str(actor_id) if actor_id else None,
                        "actor_name": actor_name
                    })
                    changes_logged = True

            if changes_logged:
                metadata["timeline"] = timeline
                data["metadata"] = metadata

            # 3. Save updates
            result = supabase.table("tickets").update(data).eq("id", str(ticket_id)).execute()
            if not result.data:
                raise Exception("Failed to update ticket record")

            updated_ticket = Ticket(**result.data[0])
            logger.info(f"Ticket updated: {updated_ticket.ticket_number}")

            # Emit Kafka event ticket.updated
            try:
                send_kafka_event(
                    topic="ticket-events",
                    event_type="ticket.updated",
                    payload={
                        "ticket_id": str(updated_ticket.id),
                        "tenant_id": str(updated_ticket.tenant_id),
                        "ticket_number": updated_ticket.ticket_number,
                        "priority": updated_ticket.priority.value,
                        "status": updated_ticket.status.value,
                        "assigned_agent_id": str(updated_ticket.assigned_agent_id) if updated_ticket.assigned_agent_id else None
                    },
                    tenant_id=str(updated_ticket.tenant_id),
                    correlation_id=str(updated_ticket.id)
                )
            except Exception as e:
                logger.error(f"Failed to emit Kafka event for update of ticket {updated_ticket.id}: {e}")

            return updated_ticket

        except Exception as e:
            logger.error(f"Failed to update ticket {ticket_id}: {e}")
            raise

    @staticmethod
    def _escape_like_pattern(value: str) -> str:
        """Escape LIKE/ILIKE wildcards so user input is matched literally."""
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    @staticmethod
    async def search_tickets(tenant_id: UUID, query: str) -> List[Ticket]:
        """Search tickets by number, category, or summary text match"""
        supabase = get_service_client()

        term = (query or "").strip()
        if not term:
            return []

        try:
            # Query match on ticket number (like match)
            if term.upper().startswith("TICK-"):
                result = (
                    supabase.table("tickets")
                    .select("*")
                    .eq("tenant_id", str(tenant_id))
                    .ilike("ticket_number", f"%{TicketService._escape_like_pattern(term)}%")
                    .limit(20)
                    .execute()
                )
                return [Ticket(**row) for row in result.data]

            # Two separate parameterized queries instead of interpolating the
            # user's term into PostgREST `.or_()` grammar (comma/dot/paren are
            # operator separators there, so interpolation is a filter-injection).
            summary_res = (
                supabase.table("tickets")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .ilike("ai_summary", f"%{TicketService._escape_like_pattern(term)}%")
                .limit(20)
                .execute()
            )

            category_res = (
                supabase.table("tickets")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .eq("category", term)
                .limit(20)
                .execute()
            )

            # Merge, de-duplicating on ticket id
            merged = {}
            for row in list(summary_res.data or []) + list(category_res.data or []):
                merged[row["id"]] = row

            return [Ticket(**row) for row in list(merged.values())[:20]]

        except Exception as e:
            logger.error(f"Failed to search tickets: {e}")
            raise
