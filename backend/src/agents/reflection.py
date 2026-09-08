"""
Self-Correction / Reflection Agent
Reviews the AI response for quality before sending.
"""
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import json
import logging

logger = logging.getLogger(__name__)


async def reflection_agent(state: AgentState) -> AgentState:
    """
    Reflection Agent: Reviews the Support Agent's response for quality,
    checks for hallucinations, and optionally regenerates.
    """
    try:
        logger.info(f"Reflection Agent processing conversation {state['conversation_id']}")

        ai_response = state.get('ai_response', '')
        if not ai_response or state.get('intent') in ('greeting', 'escalation_request', 'escalation', 'feedback') or state.get('should_escalate'):
            state['reflection_passed'] = True
            state['reflection_issues'] = []
            state['reflection_action'] = 'pass'
            state['original_response'] = None
            state['step_count'] = state.get('step_count', 0) + 1
            return state

        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            temperature=0.1
        )

        # Build context from retrieved chunks
        context = ""
        if state.get('retrieved_chunks'):
            context = "\n\n".join([
                f"Source {i+1}: {chunk['content'][:300]}"
                for i, chunk in enumerate(state['retrieved_chunks'][:3])
            ])

        system_prompt = """You are a quality reviewer for an AI customer support system.

Review the AI's response against the user's question and available knowledge base sources.

Check for:
1. Hallucinations: claims NOT supported by the sources
2. Incompleteness: missing important steps or information
3. Inaccuracy: information that contradicts the sources
4. Tone: inappropriate for the customer's emotional state

Respond with ONLY valid JSON (no markdown):
{
  "passed": true|false,
  "issues": ["issue1", "issue2"],
  "action": "pass|revise",
  "revised_response": null or "corrected response text" if action is revise
}

If there are minor issues, set action to "revise" and provide the corrected response.
If the response is good or issues are very minor, set passed to true and action to "pass"."""

        context_block = f"\n\nKnowledge base sources:\n{context}" if context else "\n\nNo knowledge base sources available."

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"User question: {state['user_message']}\n\nAI response:\n{ai_response}{context_block}")
        ]

        import asyncio
        try:
            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=4.0)
            raw = response.content.strip()
        except asyncio.TimeoutError:
            logger.warning("Reflection LLM timed out; passing by default")
            raw = '{"passed": true, "issues": [], "action": "pass"}'

        try:
            if raw.startswith(""):
                    raw = raw[:-3]
            result = json.loads(raw.strip())
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse reflection JSON: {raw[:200]}")
            result = {"passed": True, "issues": [], "action": "pass", "revised_response": None}

        passed = result.get('passed', True)
        issues = result.get('issues', [])
        action = result.get('action', 'pass')
        revised = result.get('revised_response')

        if not isinstance(issues, list):
            issues = []

        if action == 'revise' and revised:
            logger.info(f"Reflection: revising response ({len(issues)} issues found)")
            state['original_response'] = ai_response
            state['ai_response'] = revised
            state['confidence_score'] = min(state.get('confidence_score', 0.88) + 0.05, 0.98)
        else:
            logger.info(f"Reflection: passed ({len(issues)} minor issues)")
            state['original_response'] = None

        state['reflection_passed'] = passed
        state['reflection_issues'] = issues
        state['reflection_action'] = action
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Reflection Agent failed: {e}")
        state['reflection_passed'] = True
        state['reflection_issues'] = []
        state['reflection_action'] = 'pass'
        state['original_response'] = None
        state['error'] = f"Reflection error: {str(e)}"
        return state
