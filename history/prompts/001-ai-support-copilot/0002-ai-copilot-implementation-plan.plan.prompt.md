---
id: 0002
title: AI Copilot Implementation Plan
stage: plan
date: 2026-06-20
surface: agent
model: claude-opus-4-8
feature: 001-ai-support-copilot
branch: 001-ai-support-copilot
user: Muhammad Hasnain
command: /sp.plan
labels: ["plan", "architecture", "design", "research", "api-contracts", "data-model", "event-driven", "rag", "multi-agent"]
links:
  spec: specs/001-ai-support-copilot/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-ai-support-copilot/plan.md
  - specs/001-ai-support-copilot/research.md
  - specs/001-ai-support-copilot/data-model.md
  - specs/001-ai-support-copilot/quickstart.md
  - specs/001-ai-support-copilot/contracts/chat-api.yaml
  - specs/001-ai-support-copilot/contracts/knowledge-api.yaml
  - specs/001-ai-support-copilot/contracts/ticket-api.yaml
  - specs/001-ai-support-copilot/contracts/analytics-api.yaml
  - specs/001-ai-support-copilot/contracts/events.md
  - CLAUDE.md (agent context updated)
tests:
  - none
---

## Prompt

@prompt.md

User requested implementation plan creation for AI Customer Support Copilot feature (001-ai-support-copilot).

Input from spec.md:
- 5 prioritized user stories (Real-Time Chat, Knowledge Base Management, Automated Tickets, Human Escalation, Analytics Dashboard)
- 43 functional requirements across 8 categories
- 10 measurable success criteria
- Multi-language support with separate knowledge bases per language
- Constitution mandates: event-driven (Kafka), RAG-first (pgvector), multi-agent (LangGraph), human-in-loop, scalability (Kubernetes), observability (OpenTelemetry), security (Supabase Auth + RLS)

## Response snapshot

**Phase 0: Research & Best Practices**

Created research.md with best practices for 7 key technology areas:
1. **LangGraph Multi-Agent Architecture**: StateGraph pattern with typed state, 5 specialized agents (Planner → Retrieval → Support → Escalation → Summarization), conditional routing
2. **FastAPI + WebSocket**: Connection manager pattern, Kafka producer for events, Redis pub/sub for response routing
3. **Kafka Event Schema Design**: Avro schemas with schema registry, 6 domain-separated topics (chat-events, chat-responses, ticket-events, ingestion-events, notification-events, audit-events)
4. **Supabase pgvector Optimization**: HNSW indexing, hybrid search (vector + full-text), separate indexes per language, chunk size 500-1000 tokens
5. **Multi-Language Knowledge Base**: Separate table collections per language, langdetect for auto-detection, language-specific HNSW indexes
6. **Kubernetes Deployment**: Helm charts, HPA for auto-scaling, managed Kafka/Redis, separate deployments for frontend/backend/workers
7. **OpenTelemetry Instrumentation**: Auto-instrumentation for FastAPI, custom spans for agents, correlation_id for distributed tracing

All "NEEDS CLARIFICATION" items resolved with technology choices validated against constitution.

**Phase 1: Design & Contracts**

Created comprehensive data model (data-model.md):
- **9 Core Entities**: Customer, Conversation, Message, Document, Chunk, Ticket, Agent (human), Event (Kafka), Metric
- **Multi-tenant isolation**: tenant_id on all tables with RLS policies
- **Vector embeddings**: Chunk entity with vector(1536) for pgvector semantic search
- **State machines**: Conversation (active → escalated/closed), Ticket (open → in_progress → resolved)
- **Immutable audit trail**: Messages never modified after creation
- **Relationships**: Full ERD with foreign keys and indexes

Created 5 API contract files:
1. **chat-api.yaml** (OpenAPI 3.0): Conversation CRUD, message history, escalation endpoint, WebSocket protocol with streaming AI responses
2. **knowledge-api.yaml**: Document upload (multipart/form-data), processing status, chunk preview, semantic search endpoint
3. **ticket-api.yaml**: Ticket CRUD, status updates, conversation linking, search by number
4. **analytics-api.yaml**: Dashboard overview, resolution rate time series, response times, top unresolved topics, cost breakdown, agent performance
5. **events.md** (Kafka schemas): 14 event types across 6 topics with full Avro-compatible JSON schemas, idempotency patterns, DLQ handling

Created quickstart.md:
- 12-step local setup guide (30-45 minutes)
- Prerequisites: Docker, Python 3.11+, Node 18+, Supabase account, Groq API key
- Infrastructure setup: docker-compose for Kafka/Redis, Supabase migrations
- Service startup: API server, AI inference worker, ingestion worker, frontend
- End-to-end validation: Chat flow, RAG retrieval, escalation, admin upload, analytics dashboard
- Troubleshooting section with common issues

**Project Structure**:
- Web application architecture (backend/ frontend/ shared/ infra/ scripts/)
- Backend: api/ workers/ agents/ models/ services/ config/ utils/
- Frontend: Next.js App Router with components/ lib/ hooks/ stores/
- Infrastructure: Docker, Kubernetes manifests, Helm charts

**Constitution Check**: ✅ PASSED before Phase 0 and re-validated after Phase 1 design - all 7 principles satisfied

**Agent Context Updated**: CLAUDE.md updated with Python 3.11+/TypeScript 5.x, Supabase pgvector, Redis, Kafka

## Outcome

- ✅ Impact: Created comprehensive implementation plan with architecture research, data model (9 entities), API contracts (4 OpenAPI specs + events schema), and quickstart validation guide
- 🧪 Tests: N/A (design/planning phase - test strategy documented in quickstart)
- 📁 Files: Created plan.md, research.md, data-model.md, quickstart.md, 5 contract files; updated CLAUDE.md agent context
- 🔁 Next prompts: /sp.tasks to create detailed implementation tasks organized by user story
- 🧠 Reflection: Plan successfully translates constitutional principles into concrete architecture. Event-driven design with Kafka enables async AI processing. Multi-agent LangGraph workflow balances complexity with maintainability. Multi-language support via separate knowledge bases avoids translation quality risks. All technology choices validated against mandated stack (Next.js, FastAPI, Groq, LangGraph, Supabase, Kafka, Kubernetes).

## Evaluation notes (flywheel)

- Failure modes observed: None - planning flow completed successfully through all phases
- Graders run and results (PASS/FAIL): Constitution Check validation - PASS (pre-research and post-design), Technical Context completeness - PASS (all NEEDS CLARIFICATION resolved)
- Prompt variant (if applicable): Standard /sp.plan workflow with Phase 0 (research) → Phase 1 (design) → agent context update
- Next experiment (smallest change to try): N/A - proceed to task breakdown with /sp.tasks
