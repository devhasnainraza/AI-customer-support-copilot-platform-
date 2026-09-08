# 🤖 AI Customer Support Copilot

An enterprise-grade, multi-role AI customer support and automated escalation platform powered by **LangGraph multi-agent orchestration**, **FastAPI**, **Next.js 16 (App Router)**, **Supabase pgvector**, **Meta WhatsApp Cloud API**, and **Gmail SMTP multi-channel alerting**.

---

## ✨ System Highlights

- **Multi-Role Portal Hierarchy**: Strict 4-tier role separation with dedicated views and guards:
  - 👤 **Client Support Portal** (`/customer/chat`, `/customer/tickets`): AI-grounded conversational support with real-time vector citations, markdown rendering, and live escalation status tracking.
  - 🎧 **Specialist Command Center** (`/agent`): 3-pane real-time escalation workbench with customer chat, live agent presence heartbeat, and LangGraph copilot suggested responses.
  - 📊 **Operations Management Cockpit** (`/manager`, `/manager/escalations`, `/manager/team`, `/manager/reports`): Team workload capacity, SLA telemetry, priority review queue, and performance analytics.
  - ⚙️ **Root Admin & Knowledge Engine** (`/admin`, `/admin/agents`, `/admin/notifications`, `/admin/whatsapp`, `/admin/settings`): Supabase HNSW vector store ingestion, automated chunking, agent provisioning, and WhatsApp Cloud API configuration.
- **Multi-Agent Orchestrator (LangGraph)**:
  - Planner, Support Agent, Grounding & Vector Search (1536-dim), Sentiment Analyzer, Reflection & Guardrails, Summarizer, and Escalation Dispatcher.
- **Multi-Channel Notification Dispatch**:
  - Simultaneous automated dispatch across **WhatsApp (Meta Cloud API)** and **Email (Gmail SMTP)** with customizable rule matrix (Immediate, Escalation Only, High Priority).
- **VIP SaaS Design System**:
  - Unified `AppShell` with collapsible `GlobalSidebar`, `TopNavBar`, and `Ctrl+K` spotlight `CommandPalette`.
  - Micro-animations, live telemetry radar pulses, and fully responsive multi-device support.

---

## 🏗️ Architecture Overview

```
                          ┌─────────────────────────────┐
                          │    Next.js 16 VIP Frontend  │
                          │   (Tailwind, Lucide, SSE)   │
                          └──────────────┬──────────────┘
                                         │ REST / WebSockets
                                         ▼
                          ┌─────────────────────────────┐
                          │     FastAPI Gateway         │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  LangGraph   │                 │  Supabase    │                 │ Notification │
│ Multi-Agent  │                 │  PostgreSQL  │                 │   Engine     │
│   Engine     │                 │  + pgvector  │                 │ (Email/WA)   │
└──────────────┘                 └──────────────┘                 └──────────────┘
```
## 📜 License

MIT License © 2026 AI Customer Support Copilot Team
