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

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows (or source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at:
- **Client App**: [http://localhost:3000](http://localhost:3000)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🐳 Docker Deployment

To build and run all microservices with Docker Compose:

```bash
cd infra/docker
docker compose up --build -d
```

Services initialized:
- `backend`: FastAPI API server on port 8000
- `frontend`: Next.js production server on port 3000
- `worker`: Background asynchronous AI inference & ingestion worker

---

## 🔐 Environment Configuration

Create `.env` in `backend/` and `frontend/.env.local`:

```env
# Backend .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
GROQ_API_KEY=your-groq-api-key
JWT_SECRET=your-jwt-secret
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
```

---

## 🧪 Testing

```bash
# Run backend tests
cd backend
pytest tests/

# Build frontend production bundle
cd frontend
npm run build
```

---

## 📜 License

MIT License © 2026 AI Customer Support Copilot Team
