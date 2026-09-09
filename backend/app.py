"""
Copilot Customer Support — Hugging Face Space Entrypoint
Dual Mode: Interactive Gradio Multi-Agent Chat UI + Full FastAPI Backend API
"""
import os
import sys
from typing import List

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

import gradio as gr
from src.api.main import app as fastapi_app
from src.agents.planner import PlannerAgent
from src.agents.sentiment import SentimentAgent
from src.agents.support import SupportAgent
from src.agents.reflection import ReflectionAgent
from src.agents.escalation import EscalationAgent
from src.models.agent import AgentContext

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

    # Add user message to history
    updated_history = list(history) + [{"role": "user", "content": message}]
    yield updated_history, "Analyzing Intent...", "Calculating...", "..."

    try:
        # Build context
        conversation_history = [
            {"sender": m["role"], "content": m["content"]}
            for m in updated_history
        ]
        context = AgentContext(
            conversation_id="hf-space-session",
            customer_id="hf-guest-user",
            conversation_history=conversation_history,
            current_message=message
        )

        # 1. Planner Agent
        planner = PlannerAgent()
        plan_state = await planner.process(context)
        intent = plan_state.get("intent", "general_query")
        intent_status = f"Intent: {intent.upper()}"

        # 2. Sentiment Agent
        sentiment_agent = SentimentAgent()
        sentiment_state = await sentiment_agent.process(context)
        sentiment_val = sentiment_state.get("sentiment", "neutral").capitalize()

        # Check for immediate escalation
        if plan_state.get("should_escalate") or "human" in message.lower() or "agent" in message.lower():
            escalation_agent = EscalationAgent()
            esc_state = await escalation_agent.process(context)
            ticket_num = "TICK-LIVE-DEMO"
            bot_reply = (
                f"🚨 **Live Support Escalation Triggered**\n\n"
                f"I have transferred your request to our senior human support team. "
                f"A live support specialist will join shortly.\n\n"
                f"- **Ticket Number**: `{ticket_num}`\n"
                f"- **Reason**: {esc_state.get('escalation_reason', 'User requested specialist')}\n"
                f"- **Priority**: High\n"
                f"- **Status**: Waiting in queue"
            )
            updated_history.append({"role": "assistant", "content": bot_reply})
            yield updated_history, intent_status, sentiment_val, "100% (Escalated)"
            return

        # 3. Grounded Support Agent
        support_agent = SupportAgent()
        support_state = await support_agent.process(context)
        draft_response = support_state.get("response", "Thank you for reaching out. How can I assist you further?")

        # 4. Reflection & Guardrails Agent
        reflection_agent = ReflectionAgent()
        reflection_state = await reflection_agent.process(context)
        confidence = reflection_state.get("confidence_score", 0.95)
        conf_str = f"{(confidence * 100):.0f}% Grounded"

        final_response = draft_response
        updated_history.append({"role": "assistant", "content": final_response})
        yield updated_history, intent_status, sentiment_val, conf_str

    except Exception as e:
        err_msg = f"I am your AI Support Copilot. (Engine Note: {str(e)})"
        updated_history.append({"role": "assistant", "content": err_msg})
        yield updated_history, "Fallback Mode", "Neutral", "Degraded"


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
