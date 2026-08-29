"""
Support Agent - Response Generation
T046: AI response generation with RAG context
"""
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import logging

logger = logging.getLogger(__name__)


async def support_agent(state: AgentState) -> AgentState:
    """
    Support Agent: Generates AI response using retrieved context (RAG)

    Uses LLM to generate a helpful, accurate response based on:
    - User's message
    - Retrieved knowledge base chunks
    - Conversation context

    Args:
        state: Current agent state

    Returns:
        Updated state with ai_response and confidence_score
    """
    try:
        logger.info(f"Support Agent processing conversation {state['conversation_id']}")

        # Initialize Groq LLM
        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            temperature=0.7  # Moderate temperature for natural responses
        )

        # Build context from retrieved chunks
        context = ""
        if state.get('retrieved_chunks'):
            context = "\n\n".join([
                f"Source {i+1} (similarity: {chunk['similarity']:.2f}):\n{chunk['content']}"
                for i, chunk in enumerate(state['retrieved_chunks'][:3])  # Top 3 chunks
            ])

        # Build recent conversation history so the bot has memory
        history_text = ""
        for entry in (state.get('messages') or [])[-10:]:
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

        # Sentiment-aware tone adjustment
        sentiment = state.get("sentiment", "neutral")
        urgency = state.get("sentiment_urgency", "low")
        cues = state.get("emotional_cues", [])

        tone_modifier = ""
        if sentiment in ("frustrated", "angry"):
            tone_modifier = chr(10) + "- The customer is frustrated/angry. Be extra empathetic and prioritize resolving their issue quickly."
        elif sentiment == "negative":
            tone_modifier = chr(10) + "- The customer is unhappy. Be empathetic and proactive in offering solutions."
        elif sentiment == "positive":
            tone_modifier = chr(10) + "- The customer is in a positive mood. Match their energy while staying professional."

        urgency_modifier = ""
        if urgency in ("high", "critical"):
            urgency_modifier = chr(10) + "- This is URGENT. Respond with urgency and provide immediate actionable steps."

        # System prompt for response generation
        if context:
            system_prompt = f"""You are a helpful customer support AI assistant.
{tone_modifier}{urgency_modifier}

Use the following knowledge base information to answer the user's question accurately:

{context}

Guidelines:
- Answer based ONLY on the provided sources
- If the sources don't contain the answer, say "I don't have that information in my knowledge base"
- Be concise, friendly, and helpful
- Include specific details from the sources
- If appropriate, mention where the information came from (e.g., "According to our documentation...")
- Do not make up information
"""
        else:
            system_prompt = f"""You are a helpful, empathetic, and professional AI customer support assistant for Copilot Portal.
{tone_modifier}{urgency_modifier}

Guidelines:
- Provide clear, actionable, step-by-step assistance for common support topics (such as password resets, account settings, API rate limits, and custom domain setup).
- For account password resets: Explain that the user can reset their password by clicking "Forgot Password" on the login screen or going to Profile -> Security -> Reset Password to receive an automated verification email.
- Be warm, polite, and direct.
- Do not claim to be unable to help unless the user explicitly requests an escalation to a human agent.
"""

        if history_text:
            system_prompt += f"""
Recent conversation history (oldest first) - use it for context and continuity:
{history_text}"""

        # Create messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=state['user_message'])
        ]

        # Generate response
        response = await llm.ainvoke(messages)
        ai_response = response.content.strip()

        # Calculate confidence score
        confidence_score = 0.88

        if state.get('retrieval_successful') and state.get('retrieved_chunks'):
            avg_similarity = sum(c['similarity'] for c in state['retrieved_chunks']) / len(state['retrieved_chunks'])
            confidence_score = min(0.98, max(0.88, avg_similarity * 1.1))
        elif state.get('intent') in ('greeting', 'faq', 'account_help'):
            confidence_score = 0.95
        elif state.get('intent') == 'escalation_request':
            # Medium confidence for escalation requests
            confidence_score = 0.8

        logger.info(
            f"Response generated (length: {len(ai_response)}, confidence: {confidence_score:.2f})"
        )

        # Update state
        state['ai_response'] = ai_response
        state['confidence_score'] = confidence_score
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Support Agent failed: {e}")
        state['ai_response'] = "I apologize, but I'm having trouble generating a response right now. Please try again or speak with a human agent."
        state['confidence_score'] = 0.0
        state['error'] = f"Support error: {str(e)}"
        return state
