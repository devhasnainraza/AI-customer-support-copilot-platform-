"""
Sentiment Analysis Agent
Analyzes customer emotional state and urgency from their message + conversation history.
"""
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import json
import logging

logger = logging.getLogger(__name__)


async def sentiment_agent(state: AgentState) -> AgentState:
    """
    Sentiment Agent: Classifies customer emotional state and urgency level.

    Outputs:
    - sentiment: positive | neutral | negative | frustrated | angry
    - sentiment_urgency: low | medium | high | critical
    - emotional_cues: list of detected signals
    """
    try:
        logger.info(f"Sentiment Agent processing conversation {state['conversation_id']}")

        # Fast-path for explicit escalation requests
        if state.get('intent') == 'escalation_request':
            state['sentiment'] = 'frustrated'
            state['sentiment_urgency'] = 'high'
            state['emotional_cues'] = ['requests human support specialist']
            state['step_count'] = state.get('step_count', 0) + 1
            logger.info("Fast-path: Sentiment classified for escalation_request")
            return state

        # Fast-path for greetings
        if state.get('intent') == 'greeting':
            state['sentiment'] = 'positive'
            state['sentiment_urgency'] = 'low'
            state['emotional_cues'] = ['friendly greeting']
            state['step_count'] = state.get('step_count', 0) + 1
            return state

        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            temperature=0.1
        )

        # Build recent conversation history for context
        history_text = ""
        for entry in (state.get('messages') or [])[-6:]:
            if isinstance(entry, dict):
                role = entry.get('role', 'customer')
                text = entry.get('content', '')
            else:
                role = getattr(entry, 'type', 'customer')
                text = getattr(entry, 'content', '')
            if not text:
                continue
            label = "Assistant" if str(role).lower() in ("ai", "assistant", "agent") else "Customer"
            history_text += f"{label}: {text}\n"

        system_prompt = """You are a sentiment analysis agent for a customer support system.

Analyze the customer's message and recent conversation history to determine:
1. Emotional sentiment
2. Urgency level
3. Key emotional cues

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "sentiment": "positive|neutral|negative|frustrated|angry",
  "urgency": "low|medium|high|critical",
  "emotional_cues": ["cue1", "cue2"]
}

Classification guide:
- positive: satisfied, happy, grateful
- neutral: informational, calm inquiry
- negative: disappointed, mildly unhappy
- frustrated: repeated questions, impatience, "still waiting", "this isn't working"
- angry: threats to cancel, profanity, ALL CAPS, extreme dissatisfaction

- low: general inquiry, no time pressure
- medium: wants an answer but not urgent
- high: time-sensitive, business impact, multiple follow-ups
- critical: service down, billing emergency, legal/compliance issue, explicit threats"""

        context = f"Conversation history:\n{history_text}" if history_text else ""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Customer message: {state['user_message']}\n\n{context}")
        ]

        import asyncio
        try:
            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=4.0)
            raw = response.content.strip()
        except asyncio.TimeoutError:
            logger.warning("Sentiment LLM timed out; defaulting to neutral")
            raw = '{"sentiment": "neutral", "urgency": "low", "emotional_cues": []}'

        # Parse JSON response
        try:
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                if raw.endswith("```"):
                    raw = raw[:-3]
            result = json.loads(raw.strip())
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse sentiment JSON: {raw[:200]}")
            result = {
                "sentiment": "neutral",
                "urgency": "low",
                "emotional_cues": []
            }

        valid_sentiments = ['positive', 'neutral', 'negative', 'frustrated', 'angry']
        valid_urgencies = ['low', 'medium', 'high', 'critical']

        sentiment = result.get('sentiment', 'neutral')
        urgency = result.get('urgency', 'low')
        cues = result.get('emotional_cues', [])

        if sentiment not in valid_sentiments:
            sentiment = 'neutral'
        if urgency not in valid_urgencies:
            urgency = 'low'
        if not isinstance(cues, list):
            cues = []

        logger.info(
            f"Sentiment: {sentiment}, Urgency: {urgency}, Cues: {cues}"
        )

        state['sentiment'] = sentiment
        state['sentiment_urgency'] = urgency
        state['emotional_cues'] = cues
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Sentiment Agent failed: {e}")
        state['sentiment'] = 'neutral'
        state['sentiment_urgency'] = 'low'
        state['emotional_cues'] = []
        state['error'] = f"Sentiment error: {str(e)}"
        return state
