# Tool-Use Agent
from src.agents.graph import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from src.config.settings import settings
import json, logging, random
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

TOOL_DEFS = [
  {"name": "lookup_account", "desc": "Look up account by email"},
  {"name": "check_order_status", "desc": "Check order status"},
  {"name": "schedule_callback", "desc": "Schedule human callback"},
  {"name": "create_ticket", "desc": "Create support ticket"},
]

async def execute_lookup_account(email):
    return {"found": True, "email": email, "status": "active", "plan": "Professional"}

async def execute_check_order_status(order_id):
    s = random.choice(["shipped","processing","delivered","pending"])
    e = (datetime.now() + timedelta(days=random.randint(1,5))).strftime("%Y-%m-%d")
    return {"order_id": order_id, "status": s, "eta": e, "carrier": "FedEx"}

async def execute_schedule_callback(time, reason):
    return {"scheduled": True, "id": "CB-" + str(random.randint(10000,99999)), "wait": "2-4 hours"}

async def execute_create_ticket(priority, category, description):
    num = "TICK-" + datetime.now().strftime("%Y%m%d") + "-" + str(random.randint(1000,9999))
    return {"ticket": num, "priority": priority, "category": category, "status": "open"}

EXECUTORS = {
    "lookup_account": execute_lookup_account,
    "check_order_status": execute_check_order_status,
    "schedule_callback": execute_schedule_callback,
    "create_ticket": execute_create_ticket,
}

async def tool_use_agent(state):
    try:
        logger.info("Tool-Use Agent processing %s", state["conversation_id"])
        llm = ChatGroq(api_key=settings.groq_api_key, model_name=settings.groq_model, temperature=0.1)
        td = json.dumps(TOOL_DEFS, indent=2)
        NL = chr(10)
        sp = "You are a tool-calling agent." + NL + "Available tools:" + NL + td + NL + NL
        sp += "Determine if tools should be called. Respond with JSON:" + NL
        sp += chr(123) + "should_call_tools: true/false, tool_calls: [{tool, args}]" + chr(125)
        ctx = ""
        if state.get("ai_response"):
            ctx = NL + "AI context: " + state["ai_response"][:500]
        msgs = [SystemMessage(content=sp), HumanMessage(content="Customer: " + state["user_message"] + ctx)]
        resp = await llm.ainvoke(msgs)
        raw = resp.content.strip()
        try:
            if raw.startswith(""): raw = raw[:-3]
            r = json.loads(raw.strip())
        except: r = {"should_call_tools": False, "tool_calls": []}
        if not r.get("should_call_tools") or not r.get("tool_calls"):
            state["tool_calls"]=[]; state["tool_results"]=[]; state["tools_used"]=[]; state["step_count"]=state.get("step_count",0)+1; return state
        tr=[]; tu=[]
        for c in r["tool_calls"][:3]:
            tn=c.get("tool",""); ta=c.get("args",{})
            if tn not in EXECUTORS: continue
            try:
                rd = await EXECUTORS[tn](**ta)
                tr.append({"tool":tn,"args":ta,"result":rd,"success":True}); tu.append(tn)
            except Exception as e: tr.append({"tool":tn,"args":ta,"result":{"error":str(e)},"success":False})
        if tr and state.get("ai_response"):
            parts=[]
            for t in tr:
                if t["success"]:
                    tn=t["tool"]; r=t["result"]
                    if tn=="lookup_account": parts.append("Account: " + r.get("status","?") + ", Plan: " + r.get("plan","?"))
                    elif tn=="check_order_status": parts.append("Order " + r.get("order_id","?") + ": " + r.get("status","?") + " (ETA: " + r.get("eta","?") + ")")
                    elif tn=="schedule_callback": parts.append("Callback " + r.get("id","?") + " (Wait: " + r.get("wait","?") + ")")
                    elif tn=="create_ticket": parts.append("Ticket " + r.get("ticket","?") + " (Priority: " + r.get("priority","?") + ")")
            if parts: state["ai_response"] = state["ai_response"] + NL + NL + NL.join(parts)
        state["tool_calls"]=r.get("tool_calls",[]); state["tool_results"]=tr; state["tools_used"]=tu; state["step_count"]=state.get("step_count",0)+1
        return state
    except Exception as e:
        logger.error("Tool-Use Agent failed: %s", e)
        state["tool_calls"]=[]; state["tool_results"]=[]; state["tools_used"]=[]; state["error"]="Tool-use error: "+str(e)
        return state
