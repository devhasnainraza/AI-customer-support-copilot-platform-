# Kafka Event Schemas

**Purpose**: Define event structures for asynchronous processing across the AI Customer Support Copilot system

**Schema Format**: Avro (with JSON representation for documentation)

**Common Fields**: All events include these base fields:
- `event_id`: UUID, unique event identifier
- `event_type`: string, event type identifier
- `timestamp`: long, Unix timestamp (milliseconds)
- `correlation_id`: UUID, for distributed tracing
- `tenant_id`: UUID, multi-tenant isolation
- `metadata`: object, source and version info

---

## Topics

### 1. chat-events

**Purpose**: Customer messages and AI inference requests

**Partitioning**: By `conversation_id` for ordered processing

**Retention**: 7 days

**Events**:

#### message.created

Triggered when customer sends a message

```json
{
  "event_id": "uuid",
  "event_type": "message.created",
  "timestamp": 1718885400000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "message_id": "uuid",
    "conversation_id": "uuid",
    "customer_id": "uuid",
    "content": "How do I reset my password?",
    "language": "en",
    "detected_language_confidence": 0.95
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: AI inference worker

---

### 2. chat-responses

**Purpose**: AI-generated responses ready for delivery to customers

**Partitioning**: By `conversation_id`

**Retention**: 7 days

**Events**:

#### message.ai_response_ready

Triggered when AI completes response generation

```json
{
  "event_id": "uuid",
  "event_type": "message.ai_response_ready",
  "timestamp": 1718885403000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "message_id": "uuid",
    "conversation_id": "uuid",
    "content": "To reset your password, follow these steps: 1. Go to...",
    "confidence_score": 0.92,
    "retrieved_chunks": [
      {
        "chunk_id": "uuid",
        "document_id": "uuid",
        "document_name": "User Guide.pdf",
        "relevance_score": 0.87,
        "content_preview": "Password reset procedure..."
      }
    ],
    "agent_decisions": {
      "planner": "intent:password_reset",
      "retrieval": "chunks_found:3",
      "support": "generated_response",
      "escalation": "confidence_acceptable:true"
    }
  },
  "metadata": {
    "source": "ai_worker",
    "version": "1.0",
    "model": "groq:llama-3-70b",
    "processing_time_ms": 1847
  }
}
```

**Consumers**: WebSocket delivery service (via Redis pub/sub)

---

### 3. ticket-events

**Purpose**: Ticket lifecycle events

**Partitioning**: By `ticket_id`

**Retention**: 90 days (compliance)

**Events**:

#### ticket.created

```json
{
  "event_id": "uuid",
  "event_type": "ticket.created",
  "timestamp": 1718885500000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "ticket_id": "uuid",
    "ticket_number": "TICK-20260620-0001",
    "conversation_id": "uuid",
    "customer_id": "uuid",
    "priority": "high",
    "category": "billing",
    "created_by": "ai_auto",
    "ai_summary": "Customer experiencing billing discrepancy for subscription renewal.",
    "assigned_team": "billing_team"
  },
  "metadata": {
    "source": "ai_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Notification worker, analytics worker

#### ticket.status_changed

```json
{
  "event_id": "uuid",
  "event_type": "ticket.status_changed",
  "timestamp": 1718885600000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "ticket_id": "uuid",
    "from_status": "open",
    "to_status": "in_progress",
    "assigned_agent_id": "uuid",
    "assigned_agent_name": "Sarah Chen",
    "changed_by": "uuid"
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: Notification worker, analytics worker

#### ticket.assigned

```json
{
  "event_id": "uuid",
  "event_type": "ticket.assigned",
  "timestamp": 1718885550000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "ticket_id": "uuid",
    "ticket_number": "TICK-20260620-0001",
    "assigned_agent_id": "uuid",
    "assigned_agent_name": "Sarah Chen",
    "assigned_team": "billing_team",
    "assigned_by": "uuid"
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: Notification worker

---

### 4. ingestion-events

**Purpose**: Document upload and processing pipeline

**Partitioning**: By `document_id`

**Retention**: 30 days

**Events**:

#### document.uploaded

```json
{
  "event_id": "uuid",
  "event_type": "document.uploaded",
  "timestamp": 1718885700000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "document_id": "uuid",
    "filename": "Product_Manual_v2.pdf",
    "file_url": "s3://bucket/path/to/file.pdf",
    "file_type": "pdf",
    "file_size_bytes": 1048576,
    "language": "en",
    "uploaded_by": "uuid",
    "version": 1
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: Ingestion worker (chunking + embedding)

#### document.processing_started

```json
{
  "event_id": "uuid",
  "event_type": "document.processing_started",
  "timestamp": 1718885705000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "document_id": "uuid",
    "processing_job_id": "uuid"
  },
  "metadata": {
    "source": "ingestion_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Status update service

#### document.processing_completed

```json
{
  "event_id": "uuid",
  "event_type": "document.processing_completed",
  "timestamp": 1718885750000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "document_id": "uuid",
    "processing_job_id": "uuid",
    "chunks_created": 47,
    "total_tokens": 23450,
    "processing_time_ms": 45000
  },
  "metadata": {
    "source": "ingestion_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Status update service, analytics worker

#### document.processing_failed

```json
{
  "event_id": "uuid",
  "event_type": "document.processing_failed",
  "timestamp": 1718885730000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "document_id": "uuid",
    "processing_job_id": "uuid",
    "error_code": "UNSUPPORTED_FORMAT",
    "error_message": "Document contains scanned images without OCR",
    "processing_time_ms": 5000
  },
  "metadata": {
    "source": "ingestion_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Status update service, notification worker (alert admin)

---

### 5. notification-events

**Purpose**: Trigger external notifications (email, Slack, etc.)

**Partitioning**: By `recipient_id`

**Retention**: 7 days

**Events**:

#### notification.send_email

```json
{
  "event_id": "uuid",
  "event_type": "notification.send_email",
  "timestamp": 1718885800000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "recipient_email": "customer@example.com",
    "recipient_id": "uuid",
    "template": "ticket_created",
    "template_vars": {
      "ticket_number": "TICK-20260620-0001",
      "customer_name": "John Doe",
      "priority": "high"
    },
    "priority": "normal"
  },
  "metadata": {
    "source": "notification_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Email service worker

#### notification.send_slack

```json
{
  "event_id": "uuid",
  "event_type": "notification.send_slack",
  "timestamp": 1718885805000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "channel": "#support-team",
    "message": "🔴 High priority ticket created: TICK-20260620-0001\nCustomer: John Doe\nIssue: Billing discrepancy",
    "ticket_id": "uuid",
    "priority": "high"
  },
  "metadata": {
    "source": "notification_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Slack integration worker

---

### 6. audit-events

**Purpose**: Security and compliance audit trail

**Partitioning**: By `tenant_id`

**Retention**: 365 days (compliance requirement)

**Events**:

#### auth.login

```json
{
  "event_id": "uuid",
  "event_type": "auth.login",
  "timestamp": 1718885900000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "user_id": "uuid",
    "user_email": "admin@example.com",
    "role": "admin",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "auth_method": "password"
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: Security monitoring, audit log aggregator

#### data.access

```json
{
  "event_id": "uuid",
  "event_type": "data.access",
  "timestamp": 1718885950000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "user_id": "uuid",
    "resource_type": "conversation",
    "resource_id": "uuid",
    "action": "read",
    "customer_id": "uuid",
    "ip_address": "192.168.1.1"
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

**Consumers**: Audit log aggregator, compliance reporting

#### conversation.escalated

```json
{
  "event_id": "uuid",
  "event_type": "conversation.escalated",
  "timestamp": 1718886000000,
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "payload": {
    "conversation_id": "uuid",
    "customer_id": "uuid",
    "escalated_by": "ai",
    "escalation_reason": "confidence_below_threshold",
    "confidence_score": 0.65,
    "assigned_agent_id": "uuid",
    "message_count_at_escalation": 5
  },
  "metadata": {
    "source": "ai_worker",
    "version": "1.0"
  }
}
```

**Consumers**: Analytics worker, audit log aggregator

---

## Event Processing Patterns

### Idempotency

All consumers MUST implement idempotency using `event_id`:

```python
def process_event(event):
    if redis.exists(f"processed:{event['event_id']}"):
        logger.info(f"Event {event['event_id']} already processed, skipping")
        return
    
    # Process event
    handle_event(event)
    
    # Mark as processed (TTL = 7 days)
    redis.setex(f"processed:{event['event_id']}", 604800, "1")
```

### Dead Letter Queue (DLQ)

Failed events after 3 retries move to `{topic}.dlq` for manual investigation.

### Monitoring

Key metrics to track:
- Consumer lag per topic/partition
- Processing time per event type
- Error rate per consumer
- DLQ message count

---

## Summary

**6 Topics**:
- `chat-events` (customer messages)
- `chat-responses` (AI responses)
- `ticket-events` (ticket lifecycle)
- `ingestion-events` (document processing)
- `notification-events` (external notifications)
- `audit-events` (compliance audit trail)

**14 Event Types** defined with full schemas

**Event Sourcing**: All state changes captured as events for auditability and replay capability
