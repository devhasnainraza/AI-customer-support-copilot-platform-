# Tasks: AI Customer Support Copilot

**Input**: Design documents from `/specs/001-ai-support-copilot/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md

**Tests**: Not requested in specification - focus on implementation tasks

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/` at repository root
- **Frontend**: `frontend/src/` at repository root
- **Infrastructure**: `infra/` at repository root
- **Shared**: `shared/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create backend directory structure per plan.md (api/, workers/, agents/, models/, services/, config/, utils/)
- [ ] T002 Create frontend directory structure per plan.md (app/, components/, lib/, hooks/, stores/, types/)
- [ ] T003 Create shared directory for cross-language schemas in shared/schemas/
- [ ] T004 Create infrastructure directories in infra/ (docker/, kubernetes/, helm/)
- [ ] T005 Initialize Python backend project with requirements.txt in backend/
- [ ] T006 Initialize Next.js frontend project with package.json in frontend/
- [ ] T007 [P] Create docker-compose.yml for local Kafka, Redis, Zookeeper in infra/docker/
- [ ] T008 [P] Create backend Dockerfile in infra/docker/backend.Dockerfile
- [ ] T009 [P] Create frontend Dockerfile in infra/docker/frontend.Dockerfile
- [ ] T010 [P] Create worker Dockerfile in infra/docker/worker.Dockerfile
- [ ] T011 [P] Create .env.example file with required environment variables in project root
- [ ] T012 [P] Create setup-local.sh script in scripts/ for initializing local development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T013 Create Supabase database schema SQL in backend/migrations/001_initial_schema.sql
- [ ] T014 Create customers table with RLS policies in migration
- [ ] T015 Create conversations table with RLS policies in migration
- [ ] T016 Create messages table with RLS policies in migration
- [ ] T017 Create documents table with RLS policies in migration
- [ ] T018 Create chunks table with pgvector extension and HNSW indexes in migration
- [ ] T019 Create tickets table with RLS policies in migration
- [ ] T020 Create metrics table in migration
- [ ] T021 [P] Implement Supabase client initialization in backend/src/config/supabase.py
- [ ] T022 [P] Implement settings management with Pydantic in backend/src/config/settings.py
- [ ] T023 [P] Implement Redis connection manager in backend/src/config/redis.py
- [ ] T024 [P] Implement Kafka producer wrapper in backend/src/services/kafka_producer.py
- [ ] T025 [P] Implement OpenTelemetry setup in backend/src/utils/telemetry.py
- [ ] T026 [P] Implement authentication middleware in backend/src/api/middleware/auth.py
- [ ] T027 [P] Implement CORS and logging middleware in backend/src/api/middleware/logging.py
- [ ] T028 [P] Create FastAPI app entry point in backend/src/api/main.py
- [ ] T029 [P] Implement Supabase client initialization in frontend/src/lib/supabase.ts
- [ ] T030 [P] Implement API client with React Query setup in frontend/src/lib/api.ts
- [ ] T031 [P] Create root layout component in frontend/src/app/layout.tsx
- [ ] T032 [P] Create auth store with Zustand in frontend/src/stores/authStore.ts
- [ ] T033 Implement health check endpoint in backend/src/api/routes/health.py
- [ ] T034 Run database migrations and verify schema creation
- [ ] T035 Start local infrastructure with docker-compose up and verify connectivity

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Real-Time AI Support Chat (Priority: P1) 🎯 MVP

**Goal**: Customers can chat with AI that retrieves from knowledge base and streams responses in real-time

**Independent Test**: Customer visits chat, asks "How do I reset my password?", receives streaming AI response with source citations within 2 seconds, conversation persists across page refresh

### Backend Models & Services

- [ ] T036 [P] [US1] Create Customer Pydantic model in backend/src/models/customer.py
- [ ] T037 [P] [US1] Create Conversation Pydantic model in backend/src/models/conversation.py
- [ ] T038 [P] [US1] Create Message Pydantic model in backend/src/models/message.py
- [ ] T039 [P] [US1] Create Chunk Pydantic model in backend/src/models/chunk.py
- [ ] T040 [US1] Implement ChatService with conversation CRUD in backend/src/services/chat_service.py
- [ ] T041 [US1] Implement VectorSearchService with pgvector queries in backend/src/services/vector_search_service.py
- [ ] T042 [US1] Implement LanguageDetectionService using langdetect in backend/src/services/language_detection_service.py

### LangGraph AI Agents

- [ ] T043 [P] [US1] Define LangGraph state schema in backend/src/agents/graph.py
- [ ] T044 [P] [US1] Implement Planner Agent (intent classification) in backend/src/agents/planner.py
- [ ] T045 [P] [US1] Implement Retrieval Agent (vector search) in backend/src/agents/retrieval.py
- [ ] T046 [P] [US1] Implement Support Agent (response generation) in backend/src/agents/support.py
- [ ] T047 [P] [US1] Implement Escalation Agent (confidence check) in backend/src/agents/escalation.py
- [ ] T048 [US1] Wire LangGraph state machine with conditional edges in backend/src/agents/graph.py

### Backend API & WebSocket

- [ ] T049 [US1] Implement POST /chat/conversations endpoint in backend/src/api/routes/chat.py
- [ ] T050 [US1] Implement GET /chat/conversations endpoint in backend/src/api/routes/chat.py
- [ ] T051 [US1] Implement GET /chat/conversations/{id} endpoint in backend/src/api/routes/chat.py
- [ ] T052 [US1] Implement GET /chat/conversations/{id}/messages endpoint in backend/src/api/routes/chat.py
- [ ] T053 [US1] Implement WebSocket connection manager in backend/src/api/websockets/connection_manager.py
- [ ] T054 [US1] Implement WebSocket /chat/ws endpoint with authentication in backend/src/api/routes/chat.py
- [ ] T055 [US1] Implement Kafka event emission on message.created in WebSocket handler

### Kafka Workers

- [ ] T056 [US1] Implement AI Inference Worker consuming chat-events topic in backend/src/workers/ai_inference_worker.py
- [ ] T057 [US1] Implement LangGraph workflow execution in AI Inference Worker
- [ ] T058 [US1] Implement Kafka response event emission to chat-responses topic in worker
- [ ] T059 [US1] Implement Redis pub/sub for WebSocket delivery in backend/src/api/websockets/delivery.py
- [ ] T060 [US1] Implement streaming token delivery via WebSocket in delivery handler

### Frontend Chat Interface

- [ ] T061 [P] [US1] Create chat store with Zustand in frontend/src/stores/chatStore.ts
- [ ] T062 [P] [US1] Create useChat hook for WebSocket connection in frontend/src/hooks/useChat.ts
- [ ] T063 [P] [US1] Create ChatWidget component in frontend/src/components/chat/ChatWidget.tsx
- [ ] T064 [P] [US1] Create MessageList component in frontend/src/components/chat/MessageList.tsx
- [ ] T065 [P] [US1] Create MessageInput component in frontend/src/components/chat/MessageInput.tsx
- [ ] T066 [P] [US1] Create SourceCitation component in frontend/src/components/chat/SourceCitation.tsx
- [ ] T067 [US1] Create chat page in frontend/src/app/chat/page.tsx
- [ ] T068 [US1] Implement WebSocket connection manager in frontend/src/lib/websocket.ts
- [ ] T069 [US1] Implement streaming message rendering in MessageList component
- [ ] T070 [US1] Implement conversation persistence and reload on page refresh

### Utilities

- [ ] T071 [P] [US1] Implement embedding generation utility in backend/src/utils/embeddings.py
- [ ] T072 [P] [US1] Implement document chunking utility in backend/src/utils/chunking.py

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Customer can chat with AI, get RAG-grounded responses with citations, streaming works, conversation persists.

---

## Phase 4: User Story 2 - Knowledge Base Management (Priority: P2)

**Goal**: Admins can upload, manage, and organize documents that AI uses for answers

**Independent Test**: Admin uploads PDF, views processing status, verifies AI can answer questions from that document, updates/deletes documents and sees changes reflected

### Backend Models & Services

- [ ] T073 [P] [US2] Create Document Pydantic model in backend/src/models/document.py
- [ ] T074 [US2] Implement KnowledgeService with document CRUD in backend/src/services/knowledge_service.py

### Backend API

- [ ] T075 [US2] Implement POST /knowledge/documents (multipart upload) in backend/src/api/routes/knowledge.py
- [ ] T076 [US2] Implement GET /knowledge/documents endpoint in backend/src/api/routes/knowledge.py
- [ ] T077 [US2] Implement GET /knowledge/documents/{id} endpoint in backend/src/api/routes/knowledge.py
- [ ] T078 [US2] Implement PUT /knowledge/documents/{id} endpoint in backend/src/api/routes/knowledge.py
- [ ] T079 [US2] Implement DELETE /knowledge/documents/{id} endpoint in backend/src/api/routes/knowledge.py
- [ ] T080 [US2] Implement GET /knowledge/documents/{id}/chunks endpoint in backend/src/api/routes/knowledge.py
- [ ] T081 [US2] Implement POST /knowledge/search (admin preview) endpoint in backend/src/api/routes/knowledge.py
- [ ] T082 [US2] Implement GET /knowledge/languages endpoint in backend/src/api/routes/knowledge.py
- [ ] T083 [US2] Implement Kafka event emission on document.uploaded

### Kafka Workers

- [ ] T084 [US2] Implement Ingestion Worker consuming ingestion-events topic in backend/src/workers/ingestion_worker.py
- [ ] T085 [US2] Implement document parsing (PDF, DOCX, TXT, MD, HTML) in worker
- [ ] T086 [US2] Implement chunking logic with overlap in worker
- [ ] T087 [US2] Implement embedding generation for chunks in worker
- [ ] T088 [US2] Implement chunk insertion with pgvector embeddings in worker
- [ ] T089 [US2] Implement document.processing_completed event emission
- [ ] T090 [US2] Implement error handling and document.processing_failed event

### Frontend Admin Interface

- [ ] T091 [P] [US2] Create admin layout in frontend/src/app/admin/layout.tsx
- [ ] T092 [P] [US2] Create DocumentList component in frontend/src/components/knowledge/DocumentList.tsx
- [ ] T093 [P] [US2] Create DocumentUpload component in frontend/src/components/knowledge/DocumentUpload.tsx
- [ ] T094 [P] [US2] Create ProcessingStatus component in frontend/src/components/knowledge/ProcessingStatus.tsx
- [ ] T095 [P] [US2] Create SearchPreview component in frontend/src/components/knowledge/SearchPreview.tsx
- [ ] T096 [US2] Create knowledge base page in frontend/src/app/admin/page.tsx
- [ ] T097 [US2] Implement file upload with progress bar in DocumentUpload component
- [ ] T098 [US2] Implement real-time processing status updates via Supabase Realtime

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently. Admins can upload documents, see processing status, search to verify coverage, update/delete documents.

---

## Phase 5: User Story 3 - Automated Ticket Creation (Priority: P3)

**Goal**: System automatically creates tickets when AI cannot resolve issues

**Independent Test**: Customer reports complex billing issue, AI creates ticket with priority "High", attaches conversation, notifies billing team, customer gets ticket number

### Backend Models & Services

- [ ] T099 [P] [US3] Create Ticket Pydantic model in backend/src/models/ticket.py
- [ ] T100 [US3] Implement TicketService with ticket CRUD in backend/src/services/ticket_service.py
- [ ] T101 [US3] Implement ticket priority classification logic in TicketService
- [ ] T102 [US3] Implement ticket number generation (TICK-YYYYMMDD-NNNN) in TicketService

### LangGraph Agent Extension

- [ ] T103 [US3] Implement Summarization Agent in backend/src/agents/summarization.py
- [ ] T104 [US3] Add ticket creation logic to Escalation Agent when confidence low

### Backend API

- [ ] T105 [US3] Implement POST /tickets endpoint in backend/src/api/routes/tickets.py
- [ ] T106 [US3] Implement GET /tickets endpoint in backend/src/api/routes/tickets.py
- [ ] T107 [US3] Implement GET /tickets/{id} endpoint in backend/src/api/routes/tickets.py
- [ ] T108 [US3] Implement PATCH /tickets/{id} endpoint in backend/src/api/routes/tickets.py
- [ ] T109 [US3] Implement GET /tickets/{id}/conversation endpoint in backend/src/api/routes/tickets.py
- [ ] T110 [US3] Implement POST /tickets/search endpoint in backend/src/api/routes/tickets.py
- [ ] T111 [US3] Implement Kafka ticket.created event emission

### Kafka Workers

- [ ] T112 [US3] Implement Notification Worker consuming ticket-events topic in backend/src/workers/notification_worker.py
- [ ] T113 [US3] Implement email notification logic in Notification Worker
- [ ] T114 [US3] Implement Slack notification logic in Notification Worker

### Frontend Ticket Interface

- [ ] T115 [P] [US3] Create TicketList component in frontend/src/components/tickets/TicketList.tsx
- [ ] T116 [P] [US3] Create TicketDetail component in frontend/src/components/tickets/TicketDetail.tsx
- [ ] T117 [P] [US3] Create TicketStatus component in frontend/src/components/tickets/TicketStatus.tsx
- [ ] T118 [US3] Add ticket status query to chat interface in frontend/src/components/chat/ChatWidget.tsx
- [ ] T119 [US3] Create tickets page for customers in frontend/src/app/tickets/page.tsx

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently. AI creates tickets automatically, classifies priority, attaches conversation context, customers can view ticket status in chat.

---

## Phase 6: User Story 4 - Human Agent Escalation (Priority: P4)

**Goal**: Human agents can take over conversations with full context transfer

**Independent Test**: Customer requests human, AI escalates to agent, agent sees full history + AI context, customer sees "Connected to [Agent Name]", conversation continues seamlessly

### Backend API

- [ ] T120 [US4] Implement POST /chat/conversations/{id}/escalate endpoint in backend/src/api/routes/chat.py
- [ ] T121 [US4] Implement agent availability check in escalation endpoint
- [ ] T122 [US4] Implement conversation assignment to agent in ChatService
- [ ] T123 [US4] Implement Kafka escalation.triggered event emission

### Frontend Agent Dashboard

- [ ] T124 [P] [US4] Create agent layout in frontend/src/app/agent/layout.tsx
- [ ] T125 [P] [US4] Create EscalatedConversationsList component in frontend/src/components/agent/EscalatedList.tsx
- [ ] T126 [P] [US4] Create AgentChatInterface component in frontend/src/components/agent/AgentChat.tsx
- [ ] T127 [P] [US4] Create ConversationContext component in frontend/src/components/agent/ConversationContext.tsx
- [ ] T128 [P] [US4] Create AISuggestedReplies component in frontend/src/components/agent/AISuggested.tsx
- [ ] T129 [US4] Create agent dashboard page in frontend/src/app/agent/page.tsx
- [ ] T130 [US4] Implement real-time escalation notifications via Supabase Realtime
- [ ] T131 [US4] Implement agent assignment and acceptance flow
- [ ] T132 [US4] Implement AI copilot assistance for agents (suggested replies)

### WebSocket Extensions

- [ ] T133 [US4] Implement agent_joined WebSocket event in backend/src/api/websockets/events.py
- [ ] T134 [US4] Implement human agent message routing in WebSocket handler
- [ ] T135 [US4] Implement conversation handoff notification to customer

**Checkpoint**: At this point, User Story 4 should be fully functional and testable independently. Customers can escalate to humans, agents see full context, seamless handoff works, AI assists agents.

---

## Phase 7: User Story 5 - Analytics Dashboard (Priority: P5)

**Goal**: Managers can view real-time support performance metrics

**Independent Test**: Manager logs in, sees dashboard with 500 chats today, 85% AI resolution rate, 1.8s avg response time, 12% escalation rate, top 5 unresolved topics, cost savings

### Backend Models & Services

- [ ] T136 [P] [US5] Create Metric Pydantic model in backend/src/models/metric.py
- [ ] T137 [US5] Implement AnalyticsService with metric aggregation in backend/src/services/analytics_service.py

### Backend API

- [ ] T138 [US5] Implement GET /analytics/overview endpoint in backend/src/api/routes/analytics.py
- [ ] T139 [US5] Implement GET /analytics/resolution-rate endpoint in backend/src/api/routes/analytics.py
- [ ] T140 [US5] Implement GET /analytics/response-times endpoint in backend/src/api/routes/analytics.py
- [ ] T141 [US5] Implement GET /analytics/top-topics endpoint in backend/src/api/routes/analytics.py
- [ ] T142 [US5] Implement GET /analytics/costs endpoint in backend/src/api/routes/analytics.py
- [ ] T143 [US5] Implement GET /analytics/agent-performance endpoint in backend/src/api/routes/analytics.py
- [ ] T144 [US5] Implement GET /analytics/confidence-analysis endpoint in backend/src/api/routes/analytics.py

### Kafka Workers

- [ ] T145 [US5] Implement Analytics Worker consuming multiple topics in backend/src/workers/analytics_worker.py
- [ ] T146 [US5] Implement metric aggregation logic (hourly, daily, weekly) in worker
- [ ] T147 [US5] Implement metric persistence to metrics table in worker

### Frontend Analytics Dashboard

- [ ] T148 [P] [US5] Create analytics layout in frontend/src/app/analytics/layout.tsx
- [ ] T149 [P] [US5] Create OverviewMetrics component in frontend/src/components/analytics/Overview.tsx
- [ ] T150 [P] [US5] Create ResolutionRateChart component in frontend/src/components/analytics/ResolutionChart.tsx
- [ ] T151 [P] [US5] Create ResponseTimeChart component in frontend/src/components/analytics/ResponseTimeChart.tsx
- [ ] T152 [P] [US5] Create TopTopicsList component in frontend/src/components/analytics/TopTopics.tsx
- [ ] T153 [P] [US5] Create CostBreakdown component in frontend/src/components/analytics/CostBreakdown.tsx
- [ ] T154 [P] [US5] Create AgentPerformanceTable component in frontend/src/components/analytics/AgentPerformance.tsx
- [ ] T155 [US5] Create analytics dashboard page in frontend/src/app/analytics/page.tsx
- [ ] T156 [US5] Implement date range selector and filtering in dashboard
- [ ] T157 [US5] Implement chart rendering with Recharts or similar library

**Checkpoint**: All user stories should now be independently functional. Managers can view comprehensive analytics on support performance.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T158 [P] Create Kubernetes deployment manifests in infra/kubernetes/base/
- [ ] T159 [P] Create Helm chart structure in infra/helm/ai-copilot/
- [ ] T160 [P] Create Helm values files for dev/staging/production
- [ ] T161 [P] Implement Prometheus metrics exporters in backend
- [ ] T162 [P] Create Grafana dashboard configurations in infra/observability/
- [ ] T163 [P] Implement error boundary components in frontend
- [ ] T164 [P] Implement loading states and skeletons across frontend
- [ ] T165 [P] Create seed-knowledge-base.sh script with sample documents
- [ ] T166 [P] Implement rate limiting middleware in backend API
- [ ] T167 [P] Implement request timeout handling in backend
- [ ] T168 [P] Add accessibility attributes to frontend components
- [ ] T169 [P] Implement responsive design for mobile in frontend
- [ ] T170 [P] Create API documentation with OpenAPI/Swagger UI
- [ ] T171 [P] Implement log aggregation configuration for CloudWatch/Datadog
- [ ] T172 Run quickstart.md validation end-to-end
- [ ] T173 Performance testing and optimization
- [ ] T174 Security audit and penetration testing
- [ ] T175 Documentation updates in README.md and docs/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - No dependencies on other stories
  - User Story 3 (P3): Can start after Foundational - May reference US1 entities but independently testable
  - User Story 4 (P4): Can start after Foundational - May reference US1 entities but independently testable
  - User Story 5 (P5): Can start after Foundational - Aggregates data from all stories but independently testable
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent (provides knowledge base for US1 to use)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - References Conversation and Message from US1 but independently testable
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - References Conversation from US1 but independently testable
- **User Story 5 (P5)**: Can start after Foundational (Phase 2) - Observes events from all stories but independently testable

### Within Each User Story

- Models before services
- Services before API endpoints
- API endpoints before frontend components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T007-T012)
- All Foundational tasks marked [P] can run in parallel (T021-T032)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Within User Story 1: Models (T036-T039), Agents (T043-T047), Frontend components (T061-T066) can run in parallel
- Within User Story 2: Models + API + Frontend components can run in parallel
- Within User Story 3: Models + API + Frontend components can run in parallel
- Within User Story 4: API + Frontend dashboard components can run in parallel
- Within User Story 5: API endpoints + Frontend chart components can run in parallel
- All Polish tasks (T158-T171) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all models together:
Task T036: "Create Customer model"
Task T037: "Create Conversation model"
Task T038: "Create Message model"
Task T039: "Create Chunk model"

# Launch all AI agents together:
Task T043: "Define LangGraph state schema"
Task T044: "Implement Planner Agent"
Task T045: "Implement Retrieval Agent"
Task T046: "Implement Support Agent"
Task T047: "Implement Escalation Agent"

# Launch all frontend components together:
Task T061: "Create chat store"
Task T062: "Create useChat hook"
Task T063: "Create ChatWidget component"
Task T064: "Create MessageList component"
Task T065: "Create MessageInput component"
Task T066: "Create SourceCitation component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T012)
2. Complete Phase 2: Foundational (T013-T035) - **CRITICAL - blocks all stories**
3. Complete Phase 3: User Story 1 (T036-T072)
4. **STOP and VALIDATE**: Test User Story 1 independently per quickstart.md
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Real-Time Chat) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (Knowledge Base) → Test independently → Deploy/Demo
4. Add User Story 3 (Tickets) → Test independently → Deploy/Demo
5. Add User Story 4 (Escalation) → Test independently → Deploy/Demo
6. Add User Story 5 (Analytics) → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer/Team A: User Story 1 (Chat)
   - Developer/Team B: User Story 2 (Knowledge Base)
   - Developer/Team C: User Story 3 (Tickets)
   - Developer/Team D: User Story 4 (Escalation)
   - Developer/Team E: User Story 5 (Analytics)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [USX] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests not requested in specification - focus on implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Summary

**Total Tasks**: 175

**Task Count per Phase**:
- Phase 1 (Setup): 12 tasks
- Phase 2 (Foundational): 23 tasks
- Phase 3 (User Story 1 - Chat): 37 tasks
- Phase 4 (User Story 2 - Knowledge Base): 26 tasks
- Phase 5 (User Story 3 - Tickets): 21 tasks
- Phase 6 (User Story 4 - Escalation): 16 tasks
- Phase 7 (User Story 5 - Analytics): 22 tasks
- Phase 8 (Polish): 18 tasks

**Parallel Opportunities**: 89 tasks marked [P] across all phases

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 = 72 tasks for minimal viable product

**Independent Test Criteria**:
- User Story 1: Customer chats, gets RAG response with citations in <2s, conversation persists
- User Story 2: Admin uploads PDF, sees processing complete, verifies AI uses new content
- User Story 3: AI creates ticket automatically, customer gets ticket number, can check status
- User Story 4: Customer escalates to human, agent sees full context, seamless handoff
- User Story 5: Manager views dashboard with resolution rates, response times, top topics, costs
