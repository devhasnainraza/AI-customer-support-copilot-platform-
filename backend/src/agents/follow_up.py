# Follow-up Suggestions Agent
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import json, logging

logger = logging.getLogger(__name__)

async def follow_up_agent(state):
    try:
        logger.info("Follow-up Agent processing %s", state["conversation_id"])
        ai_resp = state.get("ai_response", "")
        user_msg = state.get("user_message", "")
        if not ai_resp:
            state["suggested_followups"] = []; state["step_count"] = state.get("step_count",0)+1; return state
        llm = ChatGroq(api_key=settings.groq_api_key, model_name=settings.groq_model, temperature=0.3)
        NL = chr(10)
        hist = ""
        for entry in (state.get("messages") or [])[-8:]:
            if isinstance(entry, dict):
                role = entry.get("role", "customer"); text = entry.get("content", "")
            else:
                role = getattr(entry, "type", "customer"); text = getattr(entry, "content", "")
            if not text: continue
            label = "Assistant" if str(role).lower() in ("ai","assistant","agent") else "Customer"
            hist += label + ": " + text + NL
        sp = "Generate 2-3 follow-up questions after an AI support response." + NL
        sp += "Keep each under 60 chars. Make them clickable and actionable." + NL
        sp += "Respond with JSON: {followups: [q1, q2, q3]}"
        msgs = [SystemMessage(content=sp), HumanMessage(content="Customer: " + user_msg + NL + "AI: " + ai_resp[:500] + NL + "History: " + hist)]
        resp = await llm.ainvoke(msgs)
        raw = resp.content.strip()
        try:
            if raw.startswith(""): raw = raw[:-3]
            r = json.loads(raw.strip())
        except: r = {"followups": []}
        fu = r.get("followups", [])
        if not isinstance(fu, list): fu = []
        fu = [str(f) for f in fu[:3] if f]
        state["suggested_followups"] = fu; state["step_count"] = state.get("step_count",0)+1
        return state
    except Exception as e:
        logger.error("Follow-up Agent failed: %s", e)
        state["suggested_followups"] = []; state["error"] = "Follow-up error: "+str(e); return state

