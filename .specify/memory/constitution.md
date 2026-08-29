<!--
Sync Impact Report:
- Version: 1.0.0 (Initial Constitution)
- Modified Principles: All 7 principles established from project requirements
- Added Sections: Technology Stack Constraints, Performance & Scalability Standards, Governance
- Templates Status:
  ✅ spec-template.md: Reviewed - Constitution Check placeholder exists
  ✅ plan-template.md: Reviewed - Constitution Check gate exists
  ✅ tasks-template.md: Reviewed - User story structure aligns with principles
- Follow-up TODOs: None
-->

# AI Customer Support Copilot Constitution

## Core Principles

### I. Event-Driven First Architecture

All system actions MUST be event-driven rather than tightly coupled.

**Requirements:**
- Every major action MUST emit Kafka events (chat messages, ticket creation, escalations)
- Async processing required for AI inference and workflows
- Services MUST be decoupled for independent scalability
- NO blocking workflows in core request cycle
- All side effects MUST be processed asynchronously via Kafka

**Rationale:** Event-driven architecture enables horizontal scaling, fault isolation, and independent service evolution. Blocking workflows create cascading failures and prevent the system from meeting enterprise-level SLAs.

---

### II. AI Grounded in Knowledge (RAG-first)

AI responses MUST always prioritize retrieved knowledge over generative inference.

**Requirements:**
- Supabase pgvector MUST be used for semantic search
- Document ingestion pipeline with chunking + embeddings required
- Retrieval MUST occur before generation
- Responses MUST be traceable to knowledge base sources
- NO hallucinated company-specific answers permitted

**Rationale:** Grounding AI in retrieved knowledge ensures factual accuracy, builds customer trust, and provides audit trails for compliance. Ungrounded responses create legal and reputation risks in enterprise support contexts.

---

### III. Multi-Agent Intelligence

System MUST support multiple specialized AI agents collaborating via LangGraph workflows.

**Required Agent Types:**
- Planner Agent (workflow orchestration)
- Support Agent (customer interaction)
- Retrieval Agent (knowledge search)
- Escalation Agent (human handoff logic)
- Summarization Agent (conversation summaries)

**Requirements:**
- Agents MUST collaborate via LangGraph state machines
- Clear state transitions between agents required
- Each agent MUST have single, well-defined responsibility
- Agent outputs MUST be logged for observability

**Rationale:** Specialized agents prevent monolithic complexity, enable independent testing and improvement, and provide explainable reasoning chains for debugging and compliance.

---

### IV. Human-in-the-Loop Control (NON-NEGOTIABLE)

Critical actions MUST involve human approval. NO irreversible action without human oversight.

**Requirements:**
- Escalation to human agents MUST be available at all times
- Approval workflows required for sensitive actions (refunds, account changes, data access)
- Human override capability MUST be present in all automated workflows
- Seamless AI-to-human handoff with full context transfer required

**Rationale:** Autonomous AI systems without human oversight create liability, compliance violations, and customer trust erosion. Human control is a regulatory and ethical requirement for enterprise support systems.

---

### V. Scalability by Design

System MUST handle enterprise-level traffic with horizontal scaling.

**Requirements:**
- Kubernetes-based deployment mandatory
- All backend services MUST be stateless
- Async workers required for AI processing
- Independent scaling of components (frontend, API, workers, Kafka)
- MUST scale to thousands of concurrent chats without degradation under load spikes

**Rationale:** Enterprise SaaS products require proven scalability patterns. Vertical scaling hits hard limits; horizontal scaling with Kubernetes provides predictable capacity expansion and cost management.

---

### VI. Observability & Transparency (NON-NEGOTIABLE)

Every system decision MUST be traceable and reconstructable.

**Requirements:**
- Full request tracing via OpenTelemetry mandatory
- Kafka event logs for all state changes
- AI reasoning logs (prompts, retrieved context, decisions) required
- Supabase audit logs for data access
- Metrics dashboards (Prometheus + Grafana) required
- Any response MUST be reconstructable step-by-step from logs

**Rationale:** Without observability, debugging is guesswork, compliance is impossible, and performance optimization is blind. Traceability builds customer trust and satisfies regulatory audit requirements.

---

### VII. Security First Design (NON-NEGOTIABLE)

Security MUST be embedded in every layer, not bolted on.

**Requirements:**
- Supabase Auth with RBAC mandatory
- Row Level Security (RLS) enforced at database layer
- Secure API gateways with authentication/authorization
- Encrypted secrets via Kubernetes Secrets
- Multi-tenant isolation with ZERO cross-tenant data leakage
- All APIs MUST be authenticated and authorized
- Audit logging for all sensitive operations

**Rationale:** Enterprise customers require SOC 2, GDPR, and HIPAA compliance. Security breaches destroy business value. Defense-in-depth with RLS, RBAC, and encryption is mandatory for SaaS platforms.

---

## Technology Stack Constraints

The following technology choices are mandated by architectural principles and MUST NOT be substituted without constitution amendment:

**Frontend:**
- Next.js 16+ (App Router), TypeScript, Tailwind CSS, ShadCN UI, React Query, Zustand

**Backend:**
- FastAPI (Python), Async services, WebSockets for real-time

**AI Layer:**
- Groq API (LLM inference), LangChain, LangGraph (multi-agent orchestration)

**Data Layer:**
- Supabase (PostgreSQL, Auth, Storage, pgvector, Realtime)
- Redis (caching, session management)

**Event Streaming:**
- Apache Kafka (chat, ticket, ingestion, notification, audit events)

**Deployment:**
- Docker, Docker Compose (local), Kubernetes, Helm Charts, Minikube (local K8s)

**Observability:**
- Prometheus, Grafana, OpenTelemetry, Kafka logs, Sentry

---

## Performance & Scalability Standards

These are non-negotiable performance requirements derived from enterprise SLA expectations:

**Latency Targets:**
- API response (non-AI): < 300ms (p95)
- AI response streaming start: < 2s
- Kafka event processing: near real-time (< 100ms)
- Search latency (pgvector): < 500ms (p95)

**Scalability Targets:**
- 10,000+ concurrent users
- 1M+ messages per day
- Horizontal scaling via Kubernetes HPA
- Independent worker scaling based on queue depth

**Failure Modes:**
- Graceful degradation required (fallback to cached responses when AI unavailable)
- Circuit breakers for external dependencies (Groq API, Supabase)
- Retry with exponential backoff for transient failures

---

## Governance

### Amendment Procedure

1. Amendments MUST be proposed with rationale and impact analysis
2. Significant changes (new principles, technology substitutions) require architectural review
3. All amendments MUST include migration plan for existing code
4. Version MUST be incremented according to semantic versioning:
   - **MAJOR**: Backward incompatible governance changes, principle removals/redefinitions
   - **MINOR**: New principles or materially expanded guidance
   - **PATCH**: Clarifications, wording improvements, non-semantic refinements

### Compliance Requirements

- All PRs and code reviews MUST verify compliance with constitution principles
- Constitution violations MUST be explicitly justified in `plan.md` Complexity Tracking section
- Unjustified complexity or principle violations are grounds for PR rejection
- Constitution supersedes all other practices and documentation

### Runtime Development Guidance

For day-to-day development workflows, agents and developers MUST follow:
- `.specify/memory/constitution.md` (this file) - authoritative source
- `CLAUDE.md` in project root - agent execution rules
- Feature specs in `specs/<feature>/` - requirements and design decisions

---

**Version**: 1.0.0 | **Ratified**: 2026-06-20 | **Last Amended**: 2026-06-20
