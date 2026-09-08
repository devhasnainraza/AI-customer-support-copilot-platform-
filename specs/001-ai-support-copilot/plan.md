# Implementation Plan: AI Customer Support Copilot

**Branch**: `001-ai-support-copilot` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-support-copilot/spec.md`

**Note**: This template is filled in by the `/sp.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a production-grade, enterprise AI Customer Support Copilot that combines multi-agent AI reasoning (LangGraph), event-driven architecture (Kafka), real-time customer chat, knowledge-grounded RAG responses (Supabase pgvector), human-in-the-loop escalation, and full observability. The system enables customers to receive instant, accurate support through AI agents that retrieve information from a managed knowledge base, with seamless escalation to human agents when needed. Includes automated ticket creation, analytics dashboard, and multi-language support via separate knowledge bases per language.

## Technical Context

**Language/Version**: Python 3.11+ (backend/workers), TypeScript 5.x+ (frontend)  
**Primary Dependencies**: 
- Backend: FastAPI 0.110+, LangChain 0.1+, LangGraph 0.0.20+, asyncio, websockets
- Frontend: Next.js 16+, React 18+, React Query (TanStack), Zustand, ShadCN UI, Tailwind CSS
- AI: Groq API SDK, OpenAI-compatible client
- Data: Supabase Python/JS SDKs, Redis-py, kafka-python  
**Storage**: Supabase PostgreSQL with pgvector extension, Redis (cache/sessions), Kafka topics (events)  
**Testing**: pytest (backend), pytest-asyncio, Jest/Vitest (frontend), Playwright (e2e)  
**Target Platform**: Linux containers (Docker), Kubernetes cluster (Minikube local, cloud production)  
**Project Type**: Web application (Next.js frontend + FastAPI backend + async workers)  
**Performance Goals**: 
- API response (non-AI): < 300ms (p95)
- AI streaming start: < 2s
- Vector search: < 500ms (p95)
- Kafka processing: < 100ms
- 10,000+ concurrent users
- 1M+ messages per day  
**Constraints**: 
- Stateless services (horizontal scaling requirement)
- At-least-once event delivery semantics
- Multi-tenant data isolation via RLS
- Source citations required for all AI responses (RAG traceability)  
**Scale/Scope**: Enterprise SaaS platform targeting 10k+ concurrent users, 5 specialized AI agents, 2-3 initial languages, 50+ knowledge base documents per language

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Event-Driven First Architecture
- [x] Kafka configured for all major actions (chat, tickets, escalations, document ingestion)
- [x] Async workers for AI inference via Kafka consumers
- [x] No blocking workflows in API request cycle
- [x] All side effects processed asynchronously
- **Compliance**: Architecture uses Kafka for decoupling; API returns immediately while workers process AI inference

### ✅ II. AI Grounded in Knowledge (RAG-first)
- [x] Supabase pgvector for semantic search
- [x] Document ingestion pipeline (chunk → embed → index)
- [x] Retrieval before generation in all AI responses
- [x] Source citations included in responses
- [x] No hallucinated answers (explicit "no information" when retrieval fails)
- **Compliance**: RAG pattern enforced; retrieval agent runs before support agent generates response

### ✅ III. Multi-Agent Intelligence
- [x] LangGraph workflow orchestration
- [x] 5 specialized agents: Planner, Support, Retrieval, Escalation, Summarization
- [x] State machine transitions logged
- [x] Single responsibility per agent
- **Compliance**: LangGraph state machine coordinates agent collaboration; each agent has defined input/output contracts

### ✅ IV. Human-in-the-Loop Control
- [x] Escalation available at all times
- [x] Human approval for sensitive actions
- [x] Full context transfer on handoff
- [x] Human override capability
- **Compliance**: Escalation agent detects intent; agent dashboard shows full context; humans can override AI suggestions

### ✅ V. Scalability by Design
- [x] Kubernetes deployment (Helm charts)
- [x] Stateless backend services (session in Redis/Supabase)
- [x] Async workers scale independently
- [x] HPA configured for frontend, API, workers
- **Compliance**: All services containerized; no local state; Redis for shared session; Kafka for async work distribution

### ✅ VI. Observability & Transparency
- [x] OpenTelemetry tracing for all requests
- [x] Kafka event logs for state changes
- [x] AI reasoning logs (prompt, context, response, confidence)
- [x] Supabase audit logs for data access
- [x] Prometheus metrics + Grafana dashboards
- **Compliance**: Tracing spans cover API → Kafka → worker → AI; every AI decision logged with retrieved chunks

### ✅ VII. Security First Design
- [x] Supabase Auth with RBAC (Customer, Agent, Admin, Manager roles)
- [x] Row Level Security (RLS) for multi-tenant isolation
- [x] API authentication/authorization on all endpoints
- [x] Kubernetes Secrets for credentials
- [x] Audit logging for sensitive operations
- **Compliance**: Supabase RLS policies enforce tenant isolation; API middleware validates JWT; secrets never in code

**Gate Status**: ✅ **PASSED** - All 7 constitutional principles satisfied by planned architecture

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design (data model, API contracts, quickstart) - 2026-06-20*

**Result**: ✅ **STILL COMPLIANT**

All constitutional principles remain satisfied after detailed design:

1. **Event-Driven Architecture**: Kafka events schema (14 event types across 6 topics) confirms async processing
2. **RAG-first**: Data model includes Document→Chunk with pgvector embeddings; API contracts show source citations in responses
3. **Multi-Agent**: LangGraph workflow documented in research.md; agent state transitions captured in events
4. **Human-in-Loop**: Escalation endpoints in chat-api.yaml; ticket creation for human follow-up
5. **Scalability**: Project structure shows separate deployments for frontend, backend, workers; Kubernetes manifests planned
6. **Observability**: OpenTelemetry integration documented; correlation_id in all events; audit-events topic for compliance
7. **Security**: RLS policies in data-model.md; authentication required on all API endpoints; tenant_id in all entities

**No design changes required** - proceed to Phase 2 (tasks.md creation via `/sp.tasks`)

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-support-copilot/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/sp.plan command output)
├── research.md          # Phase 0 output (/sp.plan command)
├── data-model.md        # Phase 1 output (/sp.plan command)
├── quickstart.md        # Phase 1 output (/sp.plan command)
├── contracts/           # Phase 1 output (/sp.plan command)
│   ├── chat-api.yaml
│   ├── knowledge-api.yaml
│   ├── ticket-api.yaml
│   ├── analytics-api.yaml
│   └── events.yaml
└── tasks.md             # Phase 2 output (/sp.tasks command - NOT created by /sp.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/                    # FastAPI application
│   │   ├── main.py            # App entry, middleware, CORS
│   │   ├── routes/            # API endpoints
│   │   │   ├── chat.py        # Chat endpoints (WebSocket + REST)
│   │   │   ├── knowledge.py   # Document upload/management
│   │   │   ├── tickets.py     # Ticket CRUD
│   │   │   ├── analytics.py   # Metrics/dashboard
│   │   │   └── auth.py        # Supabase Auth integration
│   │   ├── middleware/        # Auth, logging, tracing
│   │   └── websockets/        # WebSocket handlers
│   ├── workers/               # Kafka consumers
│   │   ├── ai_inference_worker.py      # Processes chat-events → AI response
│   │   ├── ingestion_worker.py         # Processes document uploads
│   │   ├── notification_worker.py      # Email/Slack notifications
│   │   └── analytics_worker.py         # Aggregates metrics
│   ├── agents/                # LangGraph AI agents
│   │   ├── graph.py           # LangGraph state machine definition
│   │   ├── planner.py         # Planner agent
│   │   ├── support.py         # Support agent
│   │   ├── retrieval.py       # Retrieval agent
│   │   ├── escalation.py      # Escalation agent
│   │   └── summarization.py   # Summarization agent
│   ├── models/                # Supabase table models (Pydantic)
│   │   ├── conversation.py
│   │   ├── message.py
│   │   ├── document.py
│   │   ├── chunk.py
│   │   ├── ticket.py
│   │   └── customer.py
│   ├── services/              # Business logic
│   │   ├── chat_service.py
│   │   ├── knowledge_service.py
│   │   ├── ticket_service.py
│   │   ├── vector_search_service.py
│   │   ├── language_detection_service.py
│   │   └── kafka_producer.py
│   ├── config/                # Configuration management
│   │   ├── settings.py        # Pydantic settings from env
│   │   └── supabase.py        # Supabase client initialization
│   └── utils/                 # Shared utilities
│       ├── telemetry.py       # OpenTelemetry setup
│       ├── embeddings.py      # Embedding generation
│       └── chunking.py        # Document chunking logic
└── tests/
    ├── unit/
    ├── integration/
    └── contract/              # API contract tests

frontend/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   ├── chat/              # Customer chat interface
│   │   ├── admin/             # Admin knowledge base management
│   │   ├── agent/             # Human agent dashboard
│   │   └── analytics/         # Manager analytics dashboard
│   ├── components/            # React components
│   │   ├── ui/                # ShadCN UI components
│   │   ├── chat/              # Chat widget, message list
│   │   ├── knowledge/         # Document upload, list
│   │   ├── tickets/           # Ticket display
│   │   └── analytics/         # Chart components
│   ├── lib/                   # Utilities
│   │   ├── supabase.ts        # Supabase client
│   │   ├── websocket.ts       # WebSocket connection manager
│   │   └── api.ts             # API client (React Query)
│   ├── hooks/                 # Custom React hooks
│   │   ├── useChat.ts
│   │   ├── useTickets.ts
│   │   └── useRealtime.ts     # Supabase Realtime subscriptions
│   ├── stores/                # Zustand state management
│   │   ├── chatStore.ts
│   │   └── authStore.ts
│   └── types/                 # TypeScript types
└── tests/
    ├── unit/
    └── e2e/                   # Playwright tests

shared/
├── schemas/                   # Shared Pydantic/TypeScript schemas
│   ├── events.py / events.ts  # Kafka event schemas
│   └── api.py / api.ts        # API request/response schemas

infra/
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── worker.Dockerfile
├── docker-compose.yml         # Local development setup
├── kubernetes/
│   ├── base/                  # Base K8s manifests
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── worker-deployment.yaml
│   │   ├── kafka.yaml
│   │   ├── redis.yaml
│   │   └── ingress.yaml
│   └── overlays/              # Environment-specific overlays
│       ├── dev/
│       ├── staging/
│       └── production/
└── helm/
    ├── ai-copilot/            # Helm chart
    │   ├── Chart.yaml
    │   ├── values.yaml
    │   ├── values-dev.yaml
    │   ├── values-staging.yaml
    │   ├── values-production.yaml
    │   └── templates/
    └── dependencies/          # Dependency charts (Kafka, Redis if not external)

.github/
└── workflows/
    ├── backend-ci.yml
    ├── frontend-ci.yml
    └── deploy.yml

scripts/
├── setup-local.sh             # Initialize local dev environment
├── seed-knowledge-base.sh     # Load sample documents
└── run-migrations.sh          # Supabase migrations
```

**Structure Decision**: Web application architecture selected due to frontend (Next.js) + backend (FastAPI) + async workers pattern. Backend handles API + WebSocket connections; workers consume Kafka events for AI inference and background processing; frontend provides customer chat, admin knowledge management, agent dashboard, and analytics interfaces. Shared schemas ensure type safety across language boundaries. Infrastructure-as-code via Kubernetes manifests and Helm charts enables consistent deployment across environments.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected - all constitutional principles satisfied by planned architecture.
