# Data Model: AI Customer Support Copilot

**Phase**: 1 - Design  
**Date**: 2026-06-20  
**Source**: Entities extracted from [spec.md](./spec.md)

---

## Entity Relationship Overview

```
Customer 1───────────* Conversation
Conversation 1───────* Message
Conversation 1───────1 Ticket (optional)
Conversation *───────1 Agent (human, when escalated)

Document 1───────────* Chunk
Chunk *──────────────* Message (via retrieval context)

Conversation *───────1 Language
Document *───────────1 Language
```

---

## Core Entities

### Customer

**Purpose**: Represents users seeking support

**Fields**:
- `id`: UUID, primary key
- `email`: string, unique, indexed
- `name`: string, nullable
- `role`: enum (`customer` | `support_agent` | `admin` | `manager`)
- `tenant_id`: UUID, indexed (multi-tenant isolation)
- `auth_id`: string (Supabase Auth user ID), unique, indexed
- `language_preference`: string (ISO 639-1 code), nullable
- `created_at`: timestamp
- `updated_at`: timestamp

**Relationships**:
- Has many: Conversations, Tickets

**Validation Rules**:
- Email must be valid format
- Role defaults to `customer`
- `tenant_id` required for row-level security
- `auth_id` synced with Supabase Auth

**State Transitions**: None (static profile data)

**Indexes**:
- Primary key: `id`
- Unique: `email`, `auth_id`
- Composite: `(tenant_id, email)`

---

### Conversation

**Purpose**: Chat session between customer and AI/human agent

**Fields**:
- `id`: UUID, primary key
- `customer_id`: UUID, foreign key → Customer.id, indexed
- `tenant_id`: UUID, indexed
- `status`: enum (`active` | `closed` | `escalated` | `abandoned`)
- `language`: string (ISO 639-1 code), indexed
- `started_at`: timestamp
- `ended_at`: timestamp, nullable
- `escalated_at`: timestamp, nullable
- `assigned_agent_id`: UUID, foreign key → Customer.id (where role=support_agent), nullable, indexed
- `satisfaction_score`: integer (1-5), nullable
- `ai_resolution`: boolean (true if resolved without human)
- `metadata`: jsonb (custom fields like `detected_language_confidence`)

**Relationships**:
- Belongs to: Customer
- Has many: Messages
- Has one (optional): Ticket
- Belongs to (optional): Agent (human)

**Validation Rules**:
- `status` defaults to `active`
- `language` must match supported languages
- `ended_at` required when status = `closed`
- `assigned_agent_id` required when status = `escalated`
- `satisfaction_score` range: 1-5

**State Transitions**:
```
active → escalated (when human takeover)
active → closed (when resolved by AI)
active → abandoned (when inactive >24h)
escalated → closed (when agent resolves)
```

**Indexes**:
- Primary key: `id`
- Composite: `(tenant_id, customer_id, status)`, `(tenant_id, language, started_at)`
- Single: `assigned_agent_id`, `status`

---

### Message

**Purpose**: Individual chat message in a conversation

**Fields**:
- `id`: UUID, primary key
- `conversation_id`: UUID, foreign key → Conversation.id, indexed
- `tenant_id`: UUID, indexed
- `sender_type`: enum (`customer` | `ai` | `human_agent`)
- `sender_id`: UUID (customer_id or agent_id)
- `content`: text
- `timestamp`: timestamp, indexed
- `confidence_score`: float (0.0-1.0), nullable (for AI messages)
- `retrieved_chunks`: jsonb array of chunk_ids (for AI messages with RAG context), nullable
- `metadata`: jsonb (e.g., `model_version`, `tokens_used`)

**Relationships**:
- Belongs to: Conversation
- References: Chunks (via `retrieved_chunks` array)

**Validation Rules**:
- `sender_type` = `ai` → `confidence_score` required
- `sender_type` = `ai` with RAG → `retrieved_chunks` required
- `content` max length: 10,000 characters
- `confidence_score` range: 0.0-1.0

**State Transitions**: None (immutable after creation)

**Indexes**:
- Primary key: `id`
- Composite: `(conversation_id, timestamp)`, `(tenant_id, timestamp)`
- GIN index on `retrieved_chunks` for array queries

---

### Document

**Purpose**: Knowledge base content uploaded by admins

**Fields**:
- `id`: UUID, primary key
- `tenant_id`: UUID, indexed
- `filename`: string
- `file_url`: string (Supabase Storage URL)
- `file_type`: enum (`pdf` | `docx` | `txt` | `markdown` | `html`)
- `file_size_bytes`: integer
- `language`: string (ISO 639-1 code), indexed
- `uploaded_by`: UUID, foreign key → Customer.id (where role=admin)
- `uploaded_at`: timestamp
- `processing_status`: enum (`pending` | `processing` | `completed` | `failed`)
- `processing_error`: text, nullable
- `version`: integer (increments on re-upload)
- `metadata`: jsonb (e.g., `title`, `author`, `tags`)

**Relationships**:
- Has many: Chunks
- Belongs to: Customer (uploader)

**Validation Rules**:
- `file_type` must match filename extension
- `language` must be supported language
- `processing_status` defaults to `pending`
- `version` defaults to 1, increments on update

**State Transitions**:
```
pending → processing (worker starts)
processing → completed (chunking/embedding done)
processing → failed (error occurred)
```

**Indexes**:
- Primary key: `id`
- Composite: `(tenant_id, language, processing_status)`, `(tenant_id, uploaded_at)`

---

### Chunk

**Purpose**: Segmented portion of a document with embeddings

**Fields**:
- `id`: UUID, primary key
- `document_id`: UUID, foreign key → Document.id, indexed
- `tenant_id`: UUID, indexed
- `content`: text
- `embedding`: vector(1536) (pgvector type)
- `language`: string (ISO 639-1 code), indexed
- `position`: integer (sequential position in document)
- `char_start`: integer (character offset in original document)
- `char_end`: integer
- `token_count`: integer
- `metadata`: jsonb (e.g., `section_title`, `page_number`)

**Relationships**:
- Belongs to: Document
- Referenced by: Messages (via `retrieved_chunks`)

**Validation Rules**:
- `content` length: 100-2000 characters (target 500-1000 tokens)
- `embedding` dimension: 1536 (OpenAI ada-002 compatible)
- `position` must be sequential within document
- `token_count` matches actual content tokenization

**State Transitions**: None (immutable after creation, deleted if document deleted)

**Indexes**:
- Primary key: `id`
- HNSW vector index: `(embedding)` WHERE `language = 'en'` (separate per language)
- Composite: `(document_id, position)`, `(tenant_id, language)`
- Full-text: GIN index on `to_tsvector('english', content)` per language

---

### Ticket

**Purpose**: Support issue requiring tracking and human attention

**Fields**:
- `id`: UUID, primary key
- `tenant_id`: UUID, indexed
- `conversation_id`: UUID, foreign key → Conversation.id, unique, indexed
- `ticket_number`: string, unique, indexed (e.g., "TICK-20240620-0001")
- `priority`: enum (`low` | `medium` | `high` | `critical`), indexed
- `status`: enum (`open` | `in_progress` | `waiting_customer` | `resolved` | `closed`)
- `category`: string (e.g., "billing", "technical", "account"), indexed, nullable
- `assigned_team`: string (e.g., "billing_team", "tier2_support"), nullable
- `assigned_agent_id`: UUID, foreign key → Customer.id (where role=support_agent), nullable, indexed
- `created_at`: timestamp
- `resolved_at`: timestamp, nullable
- `created_by`: enum (`ai_auto` | `human_manual`)
- `ai_summary`: text, nullable
- `metadata`: jsonb (custom fields, tags)

**Relationships**:
- Belongs to: Conversation (1:1)
- Belongs to (optional): Agent (assigned human)

**Validation Rules**:
- `priority` assigned via ML classification from conversation
- `ticket_number` format: `TICK-YYYYMMDD-NNNN`
- `status` defaults to `open`
- `resolved_at` required when status = `resolved` or `closed`
- `ai_summary` populated by Summarization Agent

**State Transitions**:
```
open → in_progress (agent starts work)
in_progress → waiting_customer (needs customer input)
waiting_customer → in_progress (customer responds)
in_progress → resolved (issue fixed)
resolved → closed (after confirmation/timeout)
```

**Indexes**:
- Primary key: `id`
- Unique: `ticket_number`, `conversation_id`
- Composite: `(tenant_id, status, priority)`, `(tenant_id, assigned_agent_id, status)`, `(tenant_id, created_at)`

---

### Agent (Human)

**Purpose**: Support staff member who can handle escalated conversations

**Note**: Agent data is subset of Customer table (where `role = 'support_agent'`)

**Additional Fields** (extended via metadata or separate table):
- `availability_status`: enum (`available` | `busy` | `away` | `offline`)
- `max_concurrent_chats`: integer (default 5)
- `active_conversation_count`: integer (computed)
- `specializations`: string array (e.g., ["billing", "technical"])
- `performance_metrics`: jsonb (resolution_rate, avg_response_time, satisfaction_score)

**Validation Rules**:
- `max_concurrent_chats` range: 1-10
- `active_conversation_count` updated in real-time via triggers

---

### Event (Kafka)

**Purpose**: Event sourcing for state changes and async processing

**Note**: Not stored in PostgreSQL; ephemeral Kafka messages

**Schema** (Avro):
```json
{
  "event_id": "uuid",
  "event_type": "string",  // e.g., "message.created", "ticket.created"
  "timestamp": "long",     // Unix timestamp
  "correlation_id": "uuid", // For tracing
  "tenant_id": "uuid",
  "payload": {
    // Event-specific data
  },
  "metadata": {
    "source": "string",    // e.g., "api", "worker"
    "version": "string"    // Schema version
  }
}
```

**Event Types**:
- `message.created` → AI inference worker
- `message.ai_response_ready` → WebSocket delivery
- `ticket.created` → Notification worker
- `ticket.updated` → Notification worker
- `document.uploaded` → Ingestion worker
- `document.processing_completed` → Update document status
- `escalation.triggered` → Route to agent dashboard
- `conversation.closed` → Analytics worker

---

### Metric (Analytics)

**Purpose**: Aggregated statistics for dashboard

**Fields**:
- `id`: UUID, primary key
- `tenant_id`: UUID, indexed
- `metric_name`: string, indexed (e.g., "resolution_rate", "avg_response_time")
- `metric_value`: float
- `aggregation_period`: enum (`hourly` | `daily` | `weekly` | `monthly`)
- `period_start`: timestamp, indexed
- `period_end`: timestamp
- `dimensions`: jsonb (e.g., `{"language": "en", "agent_id": "..."}`)

**Validation Rules**:
- `metric_value` must be non-negative
- `period_end` > `period_start`
- Composite unique constraint on `(tenant_id, metric_name, aggregation_period, period_start, dimensions)`

**Indexes**:
- Primary key: `id`
- Composite: `(tenant_id, metric_name, period_start)`

---

## Multi-Tenancy & Security

**Row-Level Security (RLS) Policies**:

```sql
-- Customers can only see their own conversations
CREATE POLICY customer_conversations ON conversations
  FOR SELECT USING (auth.uid() = customer_id AND tenant_id = current_tenant_id());

-- Agents can see conversations assigned to them or in their tenant
CREATE POLICY agent_conversations ON conversations
  FOR SELECT USING (
    (auth.uid() = assigned_agent_id OR is_agent(auth.uid()))
    AND tenant_id = current_tenant_id()
  );

-- Admins can see all tenant data
CREATE POLICY admin_all_access ON conversations
  FOR ALL USING (is_admin(auth.uid()) AND tenant_id = current_tenant_id());
```

**Key Principles**:
- Every table includes `tenant_id`
- RLS policies enforce tenant isolation at database level
- Application code validates tenant membership via JWT claims
- Cross-tenant queries are impossible even with SQL injection

---

## Summary

**Total Entities**: 9 (Customer, Conversation, Message, Document, Chunk, Ticket, Agent metadata, Event, Metric)

**Key Design Decisions**:
- Multi-tenant isolation via `tenant_id` + RLS
- Separate vector indexes per language for performance
- Immutable messages (audit trail)
- State machines for Conversation and Ticket lifecycles
- Kafka events for async processing (not stored in DB)
- JSONB for flexible metadata without schema changes

**Next**: Create API contracts from functional requirements
