"""
Copilot Customer Support — Hugging Face Space Entrypoint
Dual Mode: Interactive Gradio Multi-Agent Chat UI + Full FastAPI Backend API
"""
import os
import sys
import asyncio
from typing import List
from uuid import uuid4

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

import gradio as gr
from langchain_core.messages import HumanMessage, AIMessage

# ZeroGPU initialization guard (prevents shutdown if space is set to ZeroGPU hardware)
try:
    import spaces
    @spaces.GPU(duration=10)
    def _zero_gpu_init():
        return True
    try:
        _zero_gpu_init()
    except Exception:
        pass
except ImportError:
    pass

from src.api.main import app as fastapi_app
from src.agents.graph import run_agent_workflow, AgentState

# ─────────────────────────────────────────────────────────────────────────────
# Gradio Chat Logic using LangGraph Multi-Agent Pipeline
# ─────────────────────────────────────────────────────────────────────────────

async def process_chat_message(message: str, history: List[dict]):
    """
    Run multi-agent orchestration for incoming Gradio user message
    """
    if not message.strip():
        yield history, "Ready for next message", "Neutral", "N/A"
        return

    # Append user message to conversation history
    updated_history = list(history or []) + [{"role": "user", "content": message}]
    yield updated_history, "Analyzing Intent...", "Calculating...", "..."

    try:
        # Build LangChain message history
        lc_messages = []
        for m in (history or []):
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            else:
                lc_messages.append(AIMessage(content=content))

        # Build initial LangGraph AgentState
        initial_state: AgentState = {
            'conversation_id': uuid4(),
            'customer_id': uuid4(),
            'tenant_id': uuid4(),
            'language': 'en',
            'user_message': message,
            'messages': lc_messages,
            'intent': None,
            'requires_retrieval': True,
            'retrieved_chunks': [],
            'retrieval_successful': False,
            'ai_response': None,
            'confidence_score': 0.0,
            'should_escalate': False,
            'escalation_reason': None,
            'sentiment': None,
            'sentiment_urgency': None,
            'emotional_cues': [],
            'tool_calls': [],
            'tool_results': [],
            'tools_used': [],
            'reflection_passed': True,
            'reflection_issues': [],
            'reflection_action': None,
            'original_response': None,
            'suggested_followups': [],
            'handoff_priority': None,
            'error': None,
            'step_count': 0
        }

        # Run complete multi-agent workflow
        final_state = await asyncio.wait_for(run_agent_workflow(initial_state), timeout=25.0)

        # Extract telemetry
        intent = (final_state.get('intent') or 'general_query').upper()
        sentiment = (final_state.get('sentiment') or 'neutral').capitalize()
        urgency = final_state.get('sentiment_urgency') or 'Normal'
        confidence = final_state.get('confidence_score', 0.95)
        should_escalate = final_state.get('should_escalate', False)
        escalation_reason = final_state.get('escalation_reason')
        ai_response = final_state.get('ai_response') or "Thank you for reaching out. How can I assist you further?"
        followups = final_state.get('suggested_followups') or []

        intent_status = f"{intent} ({'RAG Active' if final_state.get('retrieval_successful') else 'Direct Flow'})"
        sentiment_status = f"{sentiment} (Urgency: {urgency.capitalize()})"
        confidence_status = f"{int(confidence * 100)}% Grounded"

        # Format output if escalated
        if should_escalate or intent == 'ESCALATION_REQUEST':
            confidence_status = "100% (Escalated)"
            escalation_badge = (
                f"🚨 **Live Support Escalation Triggered**\n\n"
                f"{ai_response}\n\n"
                f"- **Ticket Ref**: `TICK-LIVE-DEMO`\n"
                f"- **Reason**: {escalation_reason or 'Transferred to human specialist'}\n"
                f"- **Priority**: {urgency.capitalize()}\n"
                f"- **Specialist Queue**: Active"
            )
            updated_history.append({"role": "assistant", "content": escalation_badge})
            yield updated_history, intent_status, sentiment_status, confidence_status
            return

        # Append follow-up suggestions if available
        if followups and isinstance(followups, list):
            followup_text = "\n\n💡 **Suggested Next Questions:**\n" + "\n".join([f"- {f}" for f in followups[:3]])
            ai_response += followup_text

        updated_history.append({"role": "assistant", "content": ai_response})
        yield updated_history, intent_status, sentiment_status, confidence_status

    except Exception as e:
        fallback_reply = (
            f"Hello! I am your AI Support Copilot. I'm currently running in resilient fallback mode.\n\n"
            f"*(Engine status: {str(e)})*"
        )
        updated_history.append({"role": "assistant", "content": fallback_reply})
        yield updated_history, "FALLBACK", "Neutral", "Degraded"


# ─────────────────────────────────────────────────────────────────────────────
# Custom CSS for Cyan (#06B6D4) -> Navy (#1E3A8A) SVG Theme
# ─────────────────────────────────────────────────────────────────────────────

CUSTOM_CSS = """
:root {
    --brand-cyan: #06B6D4;
    --brand-navy: #1E3A8A;
    --brand-dark: #0E2A47;
}

body, .gradio-container {
    background-color: #f8fafc !important;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

.brand-header {
    background: linear-gradient(135deg, #06B6D4 0%, #1E3A8A 100%);
    border-radius: 1.25rem;
    padding: 1.5rem 2rem;
    color: white;
    margin-bottom: 1.25rem;
    box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.25);
}

.brand-title {
    font-size: 1.75rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.brand-subtitle {
    font-size: 0.875rem;
    opacity: 0.9;
    margin-top: 0.25rem;
    font-weight: 500;
}

button.primary-btn {
    background: linear-gradient(135deg, #06B6D4 0%, #1E3A8A 100%) !important;
    color: white !important;
    font-weight: 700 !important;
    border: none !important;
    border-radius: 0.75rem !important;
    box-shadow: 0 4px 14px 0 rgba(6, 182, 212, 0.35) !important;
    transition: all 0.2s ease !important;
}

button.primary-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px 0 rgba(6, 182, 212, 0.45) !important;
}
"""

with gr.Blocks(title="Copilot Support • AI Multi-Agent Platform", css=CUSTOM_CSS, theme=gr.themes.Soft()) as demo:
    with gr.Column():
        gr.HTML("""
        <div class="brand-header">
            <div class="brand-title">
                <span>🤖 Copilot SUPPORT</span>
                <span style="font-size: 0.75rem; font-weight: 800; background: rgba(255,255,255,0.2); padding: 0.25rem 0.6rem; border-radius: 9999px; text-transform: uppercase;">
                    Multi-Agent LangGraph
                </span>
            </div>
            <div class="brand-subtitle">
                Enterprise AI Customer Support with Grounded RAG, Sentiment Analysis & Live Human Specialist Escalation
            </div>
        </div>
        """)

        with gr.Row():
            with gr.Column(scale=4):
                chatbot = gr.Chatbot(
                    label="Live Conversation",
                    type="messages",
                    height=480,
                    show_copy_button=True,
                    avatar_images=(None, "https://cdn-icons-png.flaticon.com/512/4712/4712038.png"),
                )
                with gr.Row():
                    msg_input = gr.Textbox(
                        placeholder="Type your message or query here... (e.g. 'How do I reset my password?' or 'I need to talk to a human')",
                        label="Your Message",
                        scale=5,
                        lines=1,
                    )
                    send_btn = gr.Button("Send Message ↵", variant="primary", elem_classes=["primary-btn"], scale=1)
                
                gr.Examples(
                    examples=[
                        "How do I reset my account password?",
                        "What are the API rate limits and quotas?",
                        "How do I configure custom domain SSL settings?",
                        "I need to talk to a human support specialist right now.",
                    ],
                    inputs=msg_input,
                    label="Suggested Prompts"
                )

            with gr.Column(scale=1):
                gr.Markdown("### 📡 Agent Telemetry")
                intent_box = gr.Textbox(label="Classified Intent", value="Awaiting input...", interactive=False)
                sentiment_box = gr.Textbox(label="Detected Sentiment", value="Neutral", interactive=False)
                confidence_box = gr.Textbox(label="Grounded Confidence", value="N/A", interactive=False)

                gr.Markdown("""
                ---
                ### 🔗 Backend Services
                - **FastAPI OpenAPI Docs**: [`/docs`](/docs)
                - **Health Telemetry**: [`/health`](/health)
                - **Live Escalation Queue**: [`/v1/handoff/queue`](/v1/handoff/queue)
                """)

        # Wire inputs
        msg_input.submit(
            process_chat_message,
            inputs=[msg_input, chatbot],
            outputs=[chatbot, intent_box, sentiment_box, confidence_box]
        ).then(lambda: "", outputs=[msg_input])

        send_btn.click(
            process_chat_message,
            inputs=[msg_input, chatbot],
            outputs=[chatbot, intent_box, sentiment_box, confidence_box]
        ).then(lambda: "", outputs=[msg_input])

# Mount Gradio app onto FastAPI root so both REST API and Gradio UI work
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
