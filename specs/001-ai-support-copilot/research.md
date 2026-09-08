# Research: AI Customer Support Copilot

**Phase**: 0 - Research & Best Practices  
**Date**: 2026-06-20  
**Purpose**: Research best practices, patterns, and integration approaches for mandated technology stack

---

## 1. LangGraph Multi-Agent Architecture

**Decision**: Use LangGraph's StateGraph with typed state for orchestrating 5 specialized agents

**Rationale**: 
- LangGraph provides explicit state machine modeling for agent workflows
- Typed state ensures predictable data flow between agents
- Built-in checkpointing enables conversation recovery and debugging
- Supports conditional edges for dynamic routing based on agent outputs

**Best Practices**:
- Define shared state schema with conversation context, retrieved chunks, confidence scores
- Use conditional edges to route based on intent classification
- Implement fallback edges for error handling
- Log state transitions at each node for observability
- Use async execution for I/O-bound operations (API calls, vector search)

**Agent Workflow Pattern**:
```
User Message → Planner Agent (intent classification) 
            → Retrieval Agent (vector search) 
            → Support Agent (response generation with retrieved context)
            → Escalation Agent (confidence check, escalation logic)
            → Summarization Agent (ticket creation if needed)
```

**Alternatives Considered**:
- LangChain SequentialChain: Rejected due to lack of conditional routing and state persistence
- Custom orchestrator: Rejected due to reinventing LangGraph's proven patterns

**References**: LangGraph documentation on state machines, multi-agent collaboration patterns

---

## 2. FastAPI + WebSocket Real-Time Architecture

**Decision**: Use FastAPI WebSocket endpoints with Kafka producer for bi-directional real-time chat

**Rationale**:
- FastAPI native WebSocket support with async/await
- Connection manager pattern for tracking active WebSocket connections
- Kafka decouples WebSocket handler from AI processing (non-blocking)
- Redis pub/sub for broadcasting responses back to specific WebSocket connections

**Architecture Pattern**:
```
Client WebSocket → FastAPI WebSocket Handler → Emit Kafka event (chat-events topic)
                                              ↓
Worker consumes event → AI inference → Emit response event (chat-responses topic)
                                              ↓
Redis pub/sub listener → Route to correct WebSocket connection → Stream to client
```

**Best Practices**:
- Implement connection heartbeat/ping-pong to detect disconnects
- Store connection_id → user_id mapping in Redis for response routing
- Use WebSocket connection manager class to handle lifecycle
- Implement exponential backoff reconnection on client side
- Add connection limits per user to prevent abuse
- Use WebSocket subprotocols for versioning

**Alternatives Considered**:
- Server-Sent Events (SSE): Rejected due to lack of bi-directional communication
- Polling: Rejected due to inefficiency and latency
- Socket.io: Rejected to avoid adding another abstraction layer over native WebSockets

**References**: FastAPI WebSocket documentation, Kafka WebSocket integration patterns

---

## 3. Kafka Event Schema Design

**Decision**: Use Avro schemas with schema registry for strongly-typed events; separate topics by domain

**Rationale**:
- Avro provides schema evolution with backward/forward compatibility
- Schema registry ensures producers and consumers stay in sync
- Domain-separated topics enable independent scaling and processing

**Topic Design**:
- `chat-events`: User messages, AI requests
- `chat-responses`: AI-generated responses ready for delivery
- `ticket-events`: Ticket creation, updates, assignments
- `ingestion-events`: Document uploads, processing status
- `notification-events`: Email, Slack notifications
- `audit-events`: Security-relevant actions for compliance

**Event Schema Pattern**:
```json
{
  "event_id": "uuid",
  "event_type": "message.created",
  "timestamp": "iso8601",
  "correlation_id": "uuid",  // For tracing across services
  "tenant_id": "uuid",
  "payload": { ... },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Best Practices**:
- Include correlation_id for distributed tracing
- Add tenant_id to all events for multi-tenant isolation
- Use event versioning in metadata
- Implement idempotency keys for at-least-once processing
- Set appropriate retention policies per topic (7 days for chat, 90 days for audit)
- Use partitioning by conversation_id for ordered processing

**Alternatives Considered**:
- JSON without schema validation: Rejected due to lack of type safety and schema evolution
- Single topic for all events: Rejected due to scaling and consumer isolation concerns
- Protobuf: Rejected in favor of Avro's better schema evolution and JSON compatibility

**References**: Kafka schema design best practices, Avro schema evolution patterns

---

## 4. Supabase pgvector Optimization

**Decision**: Use HNSW index with appropriate parameters; implement hybrid search (vector + full-text)

**Rationale**:
- HNSW (Hierarchical Navigable Small World) provides best balance of speed and accuracy
- Hybrid search improves recall by combining semantic and keyword matching
- Separate indexes per language knowledge base for performance

**Index Configuration**:
```sql
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

**Query Pattern**:
```sql
-- Vector similarity search
SELECT chunk_id, content, document_id, 1 - (embedding <=> query_embedding) AS similarity
FROM chunks
WHERE language = 'en'
ORDER BY embedding <=> query_embedding
LIMIT 5;

-- Hybrid search (combine with full-text)
SELECT c.*, ts_rank(to_tsvector('english', c.content), query) AS text_rank,
       1 - (c.embedding <=> query_embedding) AS vector_similarity
FROM chunks c
WHERE language = 'en' 
  AND (to_tsvector('english', c.content) @@ query OR TRUE)
ORDER BY (0.7 * vector_similarity + 0.3 * text_rank) DESC
LIMIT 5;
```

**Best Practices**:
- Chunk size: 500-1000 tokens with 100-token overlap for context preservation
- Use embedding model: text-embedding-ada-002 (1536 dimensions) or equivalent
- Normalize embeddings before insertion
- Implement metadata filtering (document_id, language, date) before vector search
- Pre-warm index with representative queries
- Monitor query latency and adjust HNSW parameters (ef_search) dynamically

**Alternatives Considered**:
- IVFFlat index: Rejected due to lower accuracy and need for training
- Full-text only: Rejected due to semantic understanding limitations
- External vector DB (Pinecone, Weaviate): Rejected to minimize dependencies (Supabase pgvector is mandated)

**References**: pgvector documentation, HNSW tuning guides, hybrid search patterns

---

## 5. Multi-Language Knowledge Base Organization

**Decision**: Separate table collections per language with language detection routing layer

**Rationale**:
- Separate embeddings per language improve semantic search accuracy
- Language-specific indexes optimize query performance
- Avoids cross-language contamination in search results
- Simplifies admin document management (explicit language selection on upload)

**Schema Design**:
```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  filename TEXT,
  language TEXT,  -- ISO 639-1 code (en, es, fr)
  uploaded_at TIMESTAMP,
  tenant_id UUID,
  ...
);

-- Chunks table with language column
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  content TEXT,
  embedding VECTOR(1536),
  language TEXT,
  position INT,
  ...
);

-- Separate indexes per language
CREATE INDEX idx_chunks_lang_en ON chunks USING hnsw (embedding vector_cosine_ops) 
WHERE language = 'en';

CREATE INDEX idx_chunks_lang_es ON chunks USING hnsw (embedding vector_cosine_ops) 
WHERE language = 'es';
```

**Language Detection Approach**:
- Use langdetect or fasttext library for automatic detection from first customer message
- Confidence threshold: 0.8 (above = use detected language, below = ask customer)
- Fallback to English if detected language has no knowledge base
- Store detected language in conversation metadata for consistency

**Best Practices**:
- Support 2-3 initial languages (e.g., English, Spanish, French) based on customer demographics
- Require admins to tag documents with language on upload (no auto-detection for documents)
- Display supported languages to customers upfront
- Implement language switcher in chat UI
- Log language detection confidence for quality monitoring

**Alternatives Considered**:
- Auto-translation with single English knowledge base: Rejected due to translation quality risks and latency
- Unified multilingual embeddings: Rejected due to semantic accuracy degradation across languages
- Separate databases per language: Rejected due to operational complexity

**References**: langdetect documentation, multilingual semantic search patterns

---

## 6. Kubernetes Deployment Architecture

**Decision**: Use Helm charts with environment-specific values; HPA for auto-scaling; Kafka and Redis as external managed services

**Rationale**:
- Helm provides templating and environment promotion (dev → staging → production)
- HPA enables automatic scaling based on CPU/memory and custom metrics (queue depth)
- Managed Kafka/Redis reduce operational burden and improve reliability
- Minikube for local development maintains parity with production

**Deployment Components**:

**Frontend Deployment**:
- Replicas: 2-10 (HPA based on CPU > 70%)
- Resources: 256Mi-512Mi memory, 200m-500m CPU
- Liveness/Readiness probes on /health endpoint

**Backend API Deployment**:
- Replicas: 3-20 (HPA based on CPU > 70% or active connections > 1000)
- Resources: 512Mi-1Gi memory, 500m-1000m CPU
- WebSocket sticky sessions via nginx ingress annotations

**Worker Deployments** (separate deployment per worker type):
- AI Inference Worker: 5-50 replicas (HPA based on Kafka consumer lag)
- Ingestion Worker: 2-10 replicas
- Notification Worker: 2-5 replicas
- Analytics Worker: 1-3 replicas
- Resources: 1Gi-2Gi memory (for AI models), 1000m-2000m CPU

**ConfigMaps**:
- Non-sensitive config (API URLs, feature flags)

**Secrets**:
- Supabase credentials
- Groq API key
- Kafka credentials
- Redis password

**Ingress**:
- NGINX ingress controller
- TLS termination with cert-manager
- WebSocket upgrade headers
- Rate limiting annotations

**Best Practices**:
- Use init containers to wait for dependencies (Kafka, Redis)
- Implement graceful shutdown with preStop hooks
- Set resource requests = limits for guaranteed QoS
- Use pod disruption budgets for high availability
- Implement network policies for service isolation
- Use Horizontal Pod Autoscaler with custom metrics (Prometheus adapter for Kafka lag)

**Local Development (Minikube)**:
- Use Docker Compose for Kafka, Redis, Supabase (lighter than K8s equivalents)
- Port-forward services for local testing
- Use Tilt or Skaffold for hot-reload development

**Alternatives Considered**:
- Self-hosted Kafka in K8s: Rejected due to operational complexity
- Serverless (Lambda/Cloud Functions): Rejected due to WebSocket limitations and cost at scale
- Monolithic deployment: Rejected due to independent scaling requirements

**References**: Helm best practices, Kubernetes HPA documentation, NGINX ingress WebSocket configuration

---

## 7. OpenTelemetry Instrumentation

**Decision**: Use auto-instrumentation for FastAPI, manual spans for LangGraph agents, export to Prometheus + Jaeger

**Rationale**:
- Auto-instrumentation minimizes code changes
- Custom spans for agent transitions provide domain-specific observability
- Prometheus for metrics, Jaeger for distributed traces
- Correlation between traces and logs via trace_id injection

**Instrumentation Strategy**:

**Backend API**:
```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.kafka import KafkaInstrumentor

FastAPIInstrumentor.instrument_app(app)
KafkaInstrumentor().instrument()
```

**LangGraph Agents**:
```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def support_agent(state):
    with tracer.start_as_current_span("agent.support") as span:
        span.set_attribute("conversation_id", state["conversation_id"])
        span.set_attribute("confidence", confidence_score)
        # Agent logic
        return result
```

**Custom Metrics**:
- `ai_inference_duration_seconds` (histogram)
- `vector_search_latency_seconds` (histogram)
- `kafka_consumer_lag` (gauge)
- `active_websocket_connections` (gauge)
- `ai_confidence_score` (histogram)
- `escalation_rate` (counter)

**Best Practices**:
- Add trace_id to all log entries for correlation
- Sample traces (10-20% in production) to reduce overhead
- Use semantic conventions for span names
- Add custom attributes for business context (tenant_id, user_id)
- Export to multiple backends (Jaeger for traces, Prometheus for metrics, CloudWatch/Datadog for logs)

**References**: OpenTelemetry Python documentation, FastAPI instrumentation guide

---

## Summary

All research complete. No remaining "NEEDS CLARIFICATION" items. Technology stack validated against constitution. Best practices documented for:
1. LangGraph multi-agent state machine orchestration
2. FastAPI WebSocket + Kafka event-driven architecture
3. Kafka topic and schema design with Avro
4. Supabase pgvector HNSW indexing and hybrid search
5. Multi-language knowledge base with separate indexes per language
6. Kubernetes deployment with Helm charts and HPA
7. OpenTelemetry distributed tracing and custom metrics

**Next Phase**: Design - Create data-model.md and API contracts
