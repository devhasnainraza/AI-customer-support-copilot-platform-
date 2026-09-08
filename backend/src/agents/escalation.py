"""
Escalation Agent - Confidence Check and Escalation Logic
T047: Decides if conversation should escalate to human
"""
from src.agents.graph import AgentState
import logging

logger = logging.getLogger(__name__)


async def escalation_agent(state: AgentState) -> AgentState:
    """
    Escalation Agent: Determines if conversation needs human intervention

    Escalation triggers:
    - User explicitly requests human agent
    - AI confidence is too low
    - Multiple failed attempts
    - Sensitive topics detected

    Args:
        state: Current agent state

    Returns:
        Updated state with should_escalate flag and escalation_reason
    """
    try:
        logger.info(f"Escalation Agent processing conversation {state['conversation_id']}")

        should_escalate = False
        escalation_reason = None

        # Trigger 1: Explicit escalation request
        if state.get('intent') == 'escalation_request':
            should_escalate = True
            escalation_reason = "User requested human agent"
            logger.info("Escalation triggered: User request")
            # Tag handoff priority based on sentiment
            sentiment = state.get('sentiment', 'neutral')
            urgency = state.get('sentiment_urgency', 'low')
            if urgency in ('high', 'critical') or sentiment in ('angry', 'frustrated'):
                state['handoff_priority'] = 'high'
            else:
                state['handoff_priority'] = 'medium'

        # Trigger 2: Low confidence
        elif state.get('confidence_score', 1.0) < 0.6:
            should_escalate = True
            escalation_reason = f"Low confidence score ({state['confidence_score']:.2f})"
            logger.info(f"Escalation triggered: Low confidence ({state['confidence_score']:.2f})")

        # Trigger 2b: High urgency sentiment
        elif state.get('sentiment_urgency') in ('high', 'critical') and state.get('confidence_score', 1.0) < 0.75:
            should_escalate = True
            escalation_reason = f"High urgency sentiment ({state.get('sentiment_urgency')}) with moderate confidence ({state.get('confidence_score', 1.0):.2f})"
            logger.info(f"Escalation triggered: High urgency sentiment")

        # Trigger 2c: Angry/frustrated customer with low-ish confidence
        elif state.get('sentiment') in ('frustrated', 'angry') and state.get('confidence_score', 1.0) < 0.75:
            should_escalate = True
            escalation_reason = f"Customer is {state.get('sentiment')} with moderate confidence ({state.get('confidence_score', 1.0):.2f})"
            logger.info(f"Escalation triggered: {state.get('sentiment')} customer")

        # Trigger 3: No retrieval results for question
        elif (
            state.get('intent') == 'question' and
            not state.get('retrieval_successful')
        ):
            should_escalate = True
            escalation_reason = "No relevant information found in knowledge base"
            logger.info("Escalation triggered: No retrieval results")

        # Trigger 4: Error occurred in workflow
        elif state.get('error'):
            should_escalate = True
            escalation_reason = "System error occurred"
            logger.info(f"Escalation triggered: Error - {state.get('error')}")

        # No escalation needed
        else:
            logger.info("No escalation needed - AI can handle this")

        # Update state
        state['should_escalate'] = should_escalate
        state['escalation_reason'] = escalation_reason
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Escalation Agent failed: {e}")
        # Default to escalation on error (safe behavior)
        state['should_escalate'] = True
        state['escalation_reason'] = f"Escalation check error: {str(e)}"
        state['error'] = f"Escalation error: {str(e)}"
        return state
