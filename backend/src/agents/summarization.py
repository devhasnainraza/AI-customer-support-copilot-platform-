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
    try:
        logger.info(f"Summarization Agent processing conversation {state['conversation_id']}")

        # 0. A conversation may only have one ticket (tickets.conversation_id is
        # UNIQUE). Re-escalation must not attempt a duplicate insert.
        from src.config.supabase import get_service_client

        supabase = get_service_client()
        existing = (
            supabase.table("tickets")
            .select("ticket_number")
            .eq("conversation_id", str(state['conversation_id']))
            .limit(1)
            .execute()
        )

        if existing.data:
            existing_number = existing.data[0]["ticket_number"]
            logger.info(
                f"Ticket {existing_number} already exists for conversation "
                f"{state['conversation_id']}; skipping creation"
            )
            state['ai_response'] = _append_escalation_notice(
                state.get('ai_response'),
                f"Your existing support ticket {existing_number} has been updated. "
                f"A member of our support team will follow up with you shortly."
            )
            return state

        # 1. Fetch conversation history
        from src.services.chat_service import ChatService
        messages = await ChatService.get_conversation_messages(state['conversation_id'])
        
        history_text = ""
        for msg in messages:
            sender = msg.sender_type.value if hasattr(msg.sender_type, "value") else str(msg.sender_type)
            history_text += f"{sender}: {msg.content}\n"

        # 2. Call LLM to summarize
        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            temperature=0.2
        )

        # Enrich summary with sentiment and tool data
        sentiment_info = state.get('sentiment', 'neutral')
        urgency_info = state.get('sentiment_urgency', 'low')
        tools_info = state.get('tools_used', [])
        cues_info = state.get('emotional_cues', [])

        context_extra = f"""

Additional context:
- Customer sentiment: {sentiment_info}
- Urgency level: {urgency_info}
- Emotional cues: {', '.join(cues_info) if cues_info else 'none'}
- Tools used: {', '.join(tools_info) if tools_info else 'none'}"""

        system_prompt = f"""You are a support supervisor. Summarize the customer chat transcript below into a concise summary of the core issue.
Keep it under 3-4 sentences. Identify what the customer wants and what has been tried.
Include sentiment and urgency in the summary."""

        history_text += context_extra
        
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Transcript:\n{history_text}")
        ])
        
        summary = response.content.strip()
        logger.info(f"Conversation summary generated: {summary[:100]}...")

        # 3. Classify Priority (Low, Medium, High, Critical) - also factor in sentiment urgency
        priority = TicketPriority.MEDIUM
        urgency = state.get('sentiment_urgency', 'low')
        if urgency == 'critical':
            priority = TicketPriority.CRITICAL if hasattr(TicketPriority, 'CRITICAL') else TicketPriority.HIGH
        elif urgency == 'high':
            priority = TicketPriority.HIGH
        lower_summary = (summary + " " + state.get('user_message', '')).lower()
        if any(w in lower_summary for w in ["urgent", "critical", "broken", "down", "error 500", "cannot log in"]):
            priority = TicketPriority.HIGH
        if any(w in lower_summary for w in ["billing", "charged", "invoice", "payment", "refund"]):
            priority = TicketPriority.HIGH
            
        # 4. Create Ticket
        category = "general"
        if any(w in lower_summary for w in ["billing", "payment", "charge", "refund", "invoice"]):
            category = "billing"
        elif any(w in lower_summary for w in ["password", "login", "auth", "account", "profile"]):
            category = "account"
        elif any(w in lower_summary for w in ["bug", "crash", "error", "slow", "broken"]):
            category = "technical"

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
        
        logger.info(f"Ticket auto-created: {ticket.ticket_number}")

        # 5. If user explicitly asked for a human, create a handoff request
        if state.get('intent') == 'escalation_request':
            try:
                from src.services.handoff_service import handoff_manager
                handoff_priority = state.get('_handoff_priority', 'medium')
                context = {
                    'ticket_number': ticket.ticket_number,
                    'sentiment': state.get('sentiment'),
                    'sentiment_urgency': state.get('sentiment_urgency'),
                    'ai_summary': summary,
                    'confidence_score': state.get('confidence_score'),
                }
                await handoff_manager.request_handoff(
                    conversation_id=str(state['conversation_id']),
                    customer_id=str(state['customer_id']),
                    tenant_id=str(state['tenant_id']),
                    reason=state.get('escalation_reason', 'User requested human agent'),
                    priority=handoff_priority,
                    context=context,
                )
                logger.info(f"Handoff request created for conversation {state['conversation_id']}")
            except Exception as h_err:
                logger.warning(f"Failed to create handoff request: {h_err}")

        # 6. Update state: keep the Support Agent's answer, append the notice
        state['ai_response'] = _append_escalation_notice(
            state.get('ai_response'),
            f"I've also created a support ticket for you: {ticket.ticket_number}. "
            f"A member of our support team will follow up with you shortly."
        )

        return state

    except Exception as e:
        logger.error(f"Summarization Agent failed: {e}")
        state['error'] = f"Summarization error: {str(e)}"
        return state
