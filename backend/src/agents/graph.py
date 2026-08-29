"""
LangGraph State Schema and Workflow
T043 & T048: LangGraph state machine definition with conditional edges
Extended with Sentiment, Tool-Use, Reflection, and Follow-up agents.
"""
from typing import TypedDict, List, Optional, Annotated
from uuid import UUID
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage
import operator


class AgentState(TypedDict):
    """
    Shared state for all agents in the workflow

    This state is passed between agents and updated at each step
    """
    # Conversation context
    conversation_id: UUID
    customer_id: UUID
    tenant_id: UUID
    language: str

    # Current message
    user_message: str

    # Conversation history
    messages: Annotated[List[BaseMessage], operator.add]

    # Intent classification (from Planner Agent)
    intent: Optional[str]
    requires_retrieval: bool

    # Retrieved context (from Retrieval Agent)
    retrieved_chunks: List[dict]
    retrieval_successful: bool

    # Generated response (from Support Agent)
    ai_response: Optional[str]
    confidence_score: float

    # Escalation decision (from Escalation Agent)
    should_escalate: bool
    escalation_reason: Optional[str]

    # Sentiment Analysis (from Sentiment Agent)
    sentiment: Optional[str]           # positive|neutral|negative|frustrated|angry
    sentiment_urgency: Optional[str]   # low|medium|high|critical
    emotional_cues: List[str]

    # Tool-Use (from Tool-Use Agent)
    tool_calls: List[dict]
    tool_results: List[dict]
    tools_used: List[str]

    # Self-Correction (from Reflection Agent)
    reflection_passed: bool
    reflection_issues: List[str]
    reflection_action: Optional[str]   # pass|revise|regenerate
    original_response: Optional[str]

    # Follow-up Suggestions (from Follow-up Agent)
    suggested_followups: List[str]

    # Metadata
    error: Optional[str]
    step_count: int


def create_agent_graph():
    """
    Create LangGraph workflow with conditional routing

    Workflow:
    1. Planner Agent -> classifies intent
    2. Sentiment Agent -> analyzes emotional state
    3. Retrieval Agent -> searches knowledge base (conditional)
    4. Support Agent -> generates response
    5. Tool-Use Agent -> executes actions if needed
    6. Reflection Agent -> reviews response quality
    7. Escalation Agent -> decides if escalation needed
    8. Follow-up Agent -> generates suggestions
    9. End or Summarize
    """
    from src.agents.planner import planner_agent
    from src.agents.sentiment import sentiment_agent
    from src.agents.retrieval import retrieval_agent
    from src.agents.support import support_agent
    from src.agents.tool_use import tool_use_agent
    from src.agents.reflection import reflection_agent
    from src.agents.escalation import escalation_agent
    from src.agents.follow_up import follow_up_agent
    from src.agents.summarization import summarization_agent

    # Create state graph
    workflow = StateGraph(AgentState)

    # Add nodes (wrapped with monitoring to emit step callbacks)
    workflow.add_node("planner", _make_monitored_node("planner", planner_agent))
    workflow.add_node("sentiment_analysis", _make_monitored_node("sentiment_analysis", sentiment_agent))
    workflow.add_node("retrieval", _make_monitored_node("retrieval", retrieval_agent))
    workflow.add_node("support", _make_monitored_node("support", support_agent))
    workflow.add_node("tool_use", _make_monitored_node("tool_use", tool_use_agent))
    workflow.add_node("reflection", _make_monitored_node("reflection", reflection_agent))
    workflow.add_node("escalation", _make_monitored_node("escalation", escalation_agent))
    workflow.add_node("follow_up", _make_monitored_node("follow_up", follow_up_agent))
    workflow.add_node("summarization", _make_monitored_node("summarization", summarization_agent))

    # Set entry point
    workflow.set_entry_point("planner")

    # Planner -> Sentiment (always runs)
    workflow.add_edge("planner", "sentiment_analysis")

    # Sentiment -> Retrieval or Support (conditional)
    def should_retrieve(state: AgentState) -> str:
        """Route to retrieval if needed"""
        if state.get("requires_retrieval", True):
            return "retrieval"
        return "support"

    workflow.add_conditional_edges(
        "sentiment_analysis",
        should_retrieve,
        {
            "retrieval": "retrieval",
            "support": "support"
        }
    )

    # Retrieval always goes to support
    workflow.add_edge("retrieval", "support")

    # Support goes to tool-use or reflection (conditional — skip tool-use for simple intents)
    def should_use_tools(state: AgentState) -> str:
        """Skip tool-use for greetings, escalation requests, and feedback."""
        intent = state.get("intent", "question")
        if intent in ("greeting", "escalation", "feedback"):
            return "reflection"
        return "tool_use"

    workflow.add_conditional_edges(
        "support",
        should_use_tools,
        {
            "tool_use": "tool_use",
            "reflection": "reflection"
        }
    )

    # Tool-use goes to reflection
    workflow.add_edge("tool_use", "reflection")

    # Reflection goes to escalation
    workflow.add_edge("reflection", "escalation")

    # Escalation goes to follow_up or summarize
    def post_escalation(state: AgentState) -> str:
        """Route to follow-up suggestions, or summarize if escalating"""
        if state.get("should_escalate", False):
            return "summarize"
        return "follow_up"

    workflow.add_conditional_edges(
        "escalation",
        post_escalation,
        {
            "follow_up": "follow_up",
            "summarize": "summarization"
        }
    )

    # Follow-up ends the workflow
    workflow.add_edge("follow_up", END)

    # Summarization ends the workflow
    workflow.add_edge("summarization", END)

    # Compile graph
    return workflow.compile()


# Global graph instance (initialized once)
agent_graph = None


def get_agent_graph():
    """Get or create the agent graph"""
    global agent_graph
    if agent_graph is None:
        agent_graph = create_agent_graph()
    return agent_graph


def reset_agent_graph():
    """Reset the cached graph (call after changing step callback)."""
    global agent_graph
    agent_graph = None


# Optional callback invoked before each agent step: callback(agent_name)
_step_callback = None


def set_step_callback(cb):
    """Set a callback to be invoked before each agent step."""
    global _step_callback
    _step_callback = cb


def clear_step_callback():
    """Clear the step callback."""
    global _step_callback
    _step_callback = None


# Agent display names for the typing indicator
AGENT_DISPLAY_NAMES = {
    'planner': 'Classifying your question',
    'sentiment_analysis': 'Analyzing your sentiment',
    'retrieval': 'Searching knowledge base',
    'support': 'Generating response',
    'tool_use': 'Checking available actions',
    'reflection': 'Reviewing response quality',
    'escalation': 'Evaluating escalation needs',
    'follow_up': 'Suggesting follow-ups',
    'summarization': 'Creating support ticket',
}


def _make_monitored_node(name, fn):
    """Wrap an agent node to emit the step callback before execution."""
    async def monitored(state):
        if _step_callback:
            display = AGENT_DISPLAY_NAMES.get(name, name)
            await _step_callback(display)
        return await fn(state)
    return monitored


async def run_agent_workflow(initial_state: AgentState) -> AgentState:
    """
    Run the complete agent workflow

    Args:
        initial_state: Initial state with conversation context and user message

    Returns:
        Final state after all agents have processed
    """
    graph = get_agent_graph()

    # Run the workflow
    final_state = await graph.ainvoke(initial_state)

    return final_state
