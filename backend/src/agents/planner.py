"""
Planner Agent - Intent Classification
T044: Intent classification and routing decision
"""
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import logging

logger = logging.getLogger(__name__)


async def planner_agent(state: AgentState) -> AgentState:
    """
    Planner Agent: Classifies user intent and determines if retrieval is needed

    Intents:
    - question: User is asking a question (needs retrieval)
    - greeting: User is greeting (no retrieval)
    - escalation_request: User wants human agent (no retrieval)
    - feedback: User is providing feedback (no retrieval)
    - other: Unknown intent (needs retrieval to be safe)

    Args:
        state: Current agent state

    Returns:
        Updated state with intent and requires_retrieval flag
    """
    try:
        logger.info(f"Planner Agent processing conversation {state['conversation_id']}")

        user_msg = (state.get('user_message') or '').strip().lower()

        # Fast-path for explicit human escalation requests
        escalation_keywords = [
            "talk to a human", "speak to a human", "human agent", "human support",
            "real person", "human specialist", "talk to agent", "representative",
            "customer support agent", "speak with someone", "live person", "support specialist",
            "talk to human", "speak to human", "human assistant", "live agent"
        ]
        if any(kw in user_msg for kw in escalation_keywords):
            logger.info("Fast-path: classified intent as 'escalation_request'")
            state['intent'] = 'escalation_request'
            state['requires_retrieval'] = False
            state['step_count'] = state.get('step_count', 0) + 1
            return state

        # Fast-path for simple greetings
        greeting_words = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy", "hola"}
        if user_msg in greeting_words or user_msg.rstrip("!.,") in greeting_words:
            logger.info("Fast-path: classified intent as 'greeting'")
            state['intent'] = 'greeting'
            state['requires_retrieval'] = False
            state['step_count'] = state.get('step_count', 0) + 1
            return state

        # Initialize Groq LLM
        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            temperature=0.1  # Low temperature for consistent classification
        )

        # System prompt for intent classification
        system_prompt = """You are an intent classifier for a customer support system.

Analyze the user's message and classify it into one of these intents:
- question: User is asking a question about products, services, or how to do something
- greeting: User is saying hello, hi, or starting a conversation casually
- escalation_request: User explicitly wants to talk to a human agent
- feedback: User is providing feedback, complaint, or expressing satisfaction
- other: Anything else

Respond with ONLY the intent keyword, nothing else."""

        # Create messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"User message: {state['user_message']}")
        ]

        # Get intent classification with timeout
        import asyncio
        try:
            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=4.0)
            intent = response.content.strip().lower()
        except asyncio.TimeoutError:
            logger.warning("Planner LLM timed out; defaulting intent to 'question'")
            intent = 'question'

        # Validate intent
        valid_intents = ['question', 'greeting', 'escalation_request', 'feedback', 'other']
        if intent not in valid_intents:
            logger.warning(f"Invalid intent '{intent}', defaulting to 'other'")
            intent = 'other'

        # Determine if retrieval is needed
        requires_retrieval = intent in ['question', 'other', 'feedback']

        logger.info(
            f"Intent classified: {intent} "
            f"(requires_retrieval={requires_retrieval})"
        )

        # Update state
        state['intent'] = intent
        state['requires_retrieval'] = requires_retrieval
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Planner Agent failed: {e}")
        # Default to safe behavior: require retrieval
        state['intent'] = 'other'
        state['requires_retrieval'] = True
        state['error'] = f"Planner error: {str(e)}"
        return state
