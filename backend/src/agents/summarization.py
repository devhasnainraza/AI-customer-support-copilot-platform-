"""
Summarization Agent - Generates ticket summary and creates ticket
T103: Summarize conversation and auto-create ticket
"""
from src.agents.graph import AgentState
from src.services.ticket_service import TicketService
from src.models.ticket import TicketCreate, TicketPriority, CreationSource
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import logging

logger = logging.getLogger(__name__)


def _append_escalation_notice(existing_response: str | None, notice: str) -> str:
    """
    Append the escalation notice to the answer the Support Agent produced.

    The real answer must be preserved -- overwriting it with ticket boilerplate
    throws away the response the customer actually asked for.
    """
    answer = (existing_response or "").strip()
    if not answer:
        return notice
    return f"{answer}\n\n{notice}"


async def summarization_agent(state: AgentState) -> AgentState:
    """
    Summarization Agent: Summarizes the conversation and creates a ticket
    """
    import asyncio
    try:
        logger.info(f"Summarization Agent processing conversation {state['conversation_id']}")

        from src.config.supabase import get_service_client
        from src.services.handoff_service import handoff_manager
        from src.api.websockets.connection_manager import manager

        # 0. Check if a ticket already exists for this conversation
        supabase = get_service_client()
        existing = (
            supabase.table("tickets")
            .select("ticket_number, id")
            .eq("conversation_id", str(state['conversation_id']))
            .limit(1)
            .execute()
        )

        ticket_number = None
        if existing.data:
            ticket_number = existing.data[0]["ticket_number"]
            logger.info(
                f"Ticket {ticket_number} already exists for conversation "
                f"{state['conversation_id']}; skipping creation"
            )

        # 1. Generate summary
        summary = ""
        user_msg = state.get('user_message', '')
        if state.get('intent') in ('escalation_request', 'escalation') and len(user_msg) < 150:
            summary = f"Customer requested human agent assistance: '{user_msg}'"
        else:
            try:
                from src.services.chat_service import ChatService
                messages = await ChatService.get_conversation_messages(state['conversation_id'])
                
                history_text = ""
                for msg in (messages or [])[-6:]:
                    sender = msg.sender_type.value if hasattr(msg.sender_type, "value") else str(msg.sender_type)
                    history_text += f"{sender}: {msg.content}\n"

                if not history_text.strip():
                    history_text = f"customer: {user_msg}"

                llm = ChatGroq(
                    api_key=settings.groq_api_key,
                    model_name=settings.groq_model,
                    temperature=0.2
                )

                system_prompt = "You are a support supervisor. Summarize the customer inquiry into 1-2 concise sentences."
                resp = await asyncio.wait_for(
                    llm.ainvoke([
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=f"Transcript:\n{history_text}")
                    ]),
                    timeout=4.0
                )
                summary = resp.content.strip()
            except Exception as sum_err:
                logger.warning(f"Summary generation fallback: {sum_err}")
                summary = f"Customer inquiry: '{user_msg}'"

        # 2. If ticket does not exist, create it
        if not ticket_number:
            priority = TicketPriority.MEDIUM
            urgency = state.get('sentiment_urgency', 'low')
            if urgency == 'critical':
                priority = TicketPriority.CRITICAL if hasattr(TicketPriority, 'CRITICAL') else TicketPriority.HIGH
            elif urgency == 'high':
                priority = TicketPriority.HIGH

            lower_summary = (summary + " " + user_msg).lower()
            if any(w in lower_summary for w in ["urgent", "critical", "broken", "down", "error 500", "cannot log in"]):
                priority = TicketPriority.HIGH
            if any(w in lower_summary for w in ["billing", "charged", "invoice", "payment", "refund"]):
                priority = TicketPriority.HIGH

            category = "general"
            if any(w in lower_summary for w in ["billing", "payment", "charge", "refund", "invoice"]):
                category = "billing"
            elif any(w in lower_summary for w in ["password", "login", "auth", "account", "profile"]):
                category = "account"
            elif any(w in lower_summary for w in ["bug", "crash", "error", "slow", "broken"]):
                category = "technical"

            try:
                ticket = await TicketService.create_ticket(
                    TicketCreate(
                        tenant_id=state['tenant_id'],
                        conversation_id=state['conversation_id'],
                        priority=priority,
                        category=category,
                        created_by=CreationSource.AI_AUTO,
                        ai_summary=summary
                    )
                )
                ticket_number = ticket.ticket_number
                logger.info(f"Ticket auto-created: {ticket_number}")
            except Exception as t_err:
                logger.error(f"Failed to create ticket: {t_err}")
                ticket_number = "SUPPORT-QUEUE"

        # 3. Create/update handoff request and broadcast to live agent center
        if state.get('intent') in ('escalation_request', 'escalation') or state.get('should_escalate'):
            try:
                handoff_priority = state.get('handoff_priority', 'medium')
                context = {
                    'ticket_number': ticket_number,
                    'sentiment': state.get('sentiment'),
                    'sentiment_urgency': state.get('sentiment_urgency'),
                    'ai_summary': summary,
                    'confidence_score': state.get('confidence_score'),
                }
                req = await handoff_manager.request_handoff(
                    conversation_id=str(state['conversation_id']),
                    customer_id=str(state['customer_id']),
                    tenant_id=str(state['tenant_id']),
                    reason=state.get('escalation_reason', 'User requested human specialist'),
                    priority=handoff_priority,
                    context=context,
                )
                await manager.broadcast_to_agents(
                    {
                        "type": "handoff_notification",
                        "handoff": req.to_dict(),
                    }
                )
                # Also notify customer websocket of handoff waiting status
                await manager.send_to_conversation(
                    {
                        "type": "handoff_notification",
                        "handoff": req.to_dict(),
                    },
                    str(state['conversation_id'])
                )
                logger.info(f"Handoff request created and broadcasted for conversation {state['conversation_id']}")
            except Exception as h_err:
                logger.warning(f"Failed to create handoff request: {h_err}")

        # 4. Set final AI response
        if state.get('intent') in ('escalation_request', 'escalation'):
            state['ai_response'] = (
                f"I have transferred your request to our live human support team (Ticket #{ticket_number}). "
                f"A support specialist has been alerted in our Escalation Command Center and will join you right away."
            )
        else:
            state['ai_response'] = _append_escalation_notice(
                state.get('ai_response'),
                f"I've also created a support ticket for you: {ticket_number}. "
                f"A member of our support team will follow up with you shortly."
            )

        state['step_count'] = state.get('step_count', 0) + 1
        return state

    except Exception as e:
        logger.error(f"Summarization Agent failed: {e}", exc_info=True)
        state['error'] = f"Summarization error: {str(e)}"
        if not state.get('ai_response'):
            state['ai_response'] = "I have notified our support team and created an escalation for you. A specialist will follow up shortly."
        return state
