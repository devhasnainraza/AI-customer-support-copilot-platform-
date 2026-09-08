# Quickstart Guide: AI Customer Support Copilot

**Purpose**: Step-by-step guide to set up local development environment and validate the system

**Estimated Time**: 30-45 minutes

**Prerequisites**:
- Docker Desktop installed and running
- Python 3.11+ installed
- Node.js 18+ and npm installed
- Git installed
- 8GB+ RAM available
- Supabase account (free tier)
- Groq API key (free tier available)

---

## Step 1: Clone Repository and Set Up Environment

```bash
# Clone repository
git clone <repository-url>
cd AI_Customer_Support

# Checkout feature branch
git checkout 001-ai-support-copilot

# Create Python virtual environment for backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

---

## Step 2: Configure External Services

### 2.1 Supabase Setup

1. Go to https://supabase.com and create a new project
2. Wait for project provisioning (~2 minutes)
3. Enable pgvector extension:
   - Go to Database → Extensions
   - Search for "vector" and enable it
4. Get credentials:
   - Go to Project Settings → API
   - Copy `Project URL` and `anon/public key`
   - Go to Project Settings → Database
   - Copy `Connection string` (set password)

### 2.2 Groq API Setup

1. Go to https://console.groq.com
2. Sign up and create API key
3. Copy API key

### 2.3 Create `.env` File

Create `.env` file in project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq AI
GROQ_API_KEY=your-groq-api-key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

---

## Step 3: Start Local Infrastructure

Start Kafka, Redis, and other dependencies using Docker Compose:

```bash
# Start infrastructure services
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# kafka         running on 9092
# redis         running on 6379
# zookeeper     running on 2181
```

**Wait 30 seconds** for Kafka to fully initialize.

---

## Step 4: Initialize Database Schema

Run Supabase migrations to create tables, indexes, and RLS policies:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Verify tables created
supabase db diff
```

**Expected tables**: customers, conversations, messages, documents, chunks, tickets, metrics

---

## Step 5: Seed Knowledge Base

Upload sample documents to test RAG functionality:

```bash
# Run seeding script
./scripts/seed-knowledge-base.sh

# This uploads 3 sample documents:
# - FAQ.md (English)
# - User_Guide.pdf (English)
# - Product_Specs.txt (English)
```

**Processing time**: ~2-3 minutes (chunking + embedding generation)

Check processing status:
```bash
curl http://localhost:8000/v1/knowledge/documents | jq '.data[] | {filename, processing_status}'
```

Wait until all show `"processing_status": "completed"`

---

## Step 6: Start Backend Services

### 6.1 Start API Server

```bash
cd backend
source venv/bin/activate
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

Keep this terminal running.

### 6.2 Start AI Inference Worker (New Terminal)

```bash
cd backend
source venv/bin/activate
python src/workers/ai_inference_worker.py
```

**Expected output**:
```
INFO: AI Inference Worker started
INFO: Connected to Kafka broker
INFO: Subscribed to topic: chat-events
INFO: Worker ready to process messages
```

Keep this terminal running.

### 6.3 Start Ingestion Worker (New Terminal)

```bash
cd backend
source venv/bin/activate
python src/workers/ingestion_worker.py
```

**Expected output**:
```
INFO: Ingestion Worker started
INFO: Connected to Kafka broker
INFO: Subscribed to topic: ingestion-events
```

Keep this terminal running.

---

## Step 7: Start Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

**Expected output**:
```
  ▲ Next.js 16.0.0
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

---

## Step 8: Verify System Health

### 8.1 Check API Health

```bash
curl http://localhost:8000/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "services": {
    "supabase": "connected",
    "kafka": "connected",
    "redis": "connected"
  },
  "version": "1.0.0"
}
```

### 8.2 Check Frontend

Open browser: http://localhost:3000

Expected: Landing page loads with "Start Chat" button

---

## Step 9: Test End-to-End Chat Flow

### 9.1 Create Test Account

1. Go to http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Verify email (check Supabase Auth inbox)
5. Log in

### 9.2 Start Chat Conversation

1. Click "Start Chat"
2. Type: "How do I reset my password?"
3. Press Send

**Expected behavior**:
- Message appears in chat immediately
- "AI is typing..." indicator shows
- Within 2 seconds, AI response streams in token-by-token
- Response includes source citations (e.g., "Source: FAQ.md")
- Confidence score displayed (should be >0.8 for FAQ match)

### 9.3 Test Multi-Turn Context

1. Follow up with: "What about if I forgot my email?"
2. Press Send

**Expected behavior**:
- AI maintains context from previous question
- Response relates to password reset topic
- New sources may be cited

### 9.4 Test Escalation

1. Type: "I want to speak to a human"
2. Press Send

**Expected behavior**:
- AI responds: "I'm connecting you to a human agent..."
- Conversation status changes to "escalated"
- Message appears: "No agents available. We'll notify you when someone joins."

---

## Step 10: Test Admin Knowledge Base Upload

### 10.1 Create Admin Account

In Supabase dashboard:
1. Go to Authentication → Users
2. Find your test user
3. Go to Database → Table Editor → customers
4. Update your user's `role` to `admin`

### 10.2 Upload Document

1. Log out and log back in (to refresh role)
2. Go to http://localhost:3000/admin
3. Click "Upload Document"
4. Select a PDF file (max 10MB)
5. Choose language: English
6. Click Upload

**Expected behavior**:
- File uploads successfully
- Shows "Processing..." status
- After 1-2 minutes, status changes to "Completed"
- Document appears in knowledge base list with chunk count

---

## Step 11: Test Analytics Dashboard (Manager Role)

### 11.1 Create Manager Account

In Supabase, update your user's `role` to `manager`

### 11.2 View Analytics

1. Log out and log back in
2. Go to http://localhost:3000/analytics

**Expected metrics**:
- Total conversations
- AI resolution rate
- Average response time
- Escalation rate
- Top topics chart

---

## Step 12: Verify Observability

### 12.1 Check Logs

Backend logs should show:
```
INFO: OpenTelemetry tracing enabled
INFO: Trace ID: 1234567890abcdef
INFO: Conversation created: conv-uuid
INFO: Message processed in 1847ms
INFO: Confidence score: 0.92
```

### 12.2 Check Kafka Topics (Optional)

```bash
# List topics
docker exec -it kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# Expected topics:
# chat-events
# chat-responses
# ticket-events
# ingestion-events

# View messages in topic
docker exec -it kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic chat-events \
  --from-beginning \
  --max-messages 5
```

### 12.3 Check Redis (Optional)

```bash
# Connect to Redis
docker exec -it redis redis-cli

# Check active WebSocket connections
> KEYS connection:*

# Check processed event IDs
> KEYS processed:*
```

---

## Troubleshooting

### Issue: "Kafka connection failed"

**Solution**:
```bash
# Restart Kafka
docker-compose restart kafka
# Wait 30 seconds, then restart workers
```

### Issue: "Supabase connection failed"

**Solution**:
- Verify `.env` has correct `SUPABASE_URL` and keys
- Check Supabase project is active (not paused)
- Verify network connectivity to Supabase

### Issue: "AI response timeout"

**Solution**:
- Check Groq API key is valid
- Verify AI inference worker is running
- Check worker logs for errors
- Ensure Kafka is processing messages: `docker-compose logs kafka`

### Issue: "Document processing stuck"

**Solution**:
- Check ingestion worker logs
- Verify document format is supported (PDF, DOCX, TXT, MD, HTML)
- Ensure pgvector extension is enabled in Supabase
- Check embedding generation isn't rate-limited

### Issue: "Frontend not loading"

**Solution**:
```bash
# Clear Next.js cache
cd frontend
rm -rf .next
npm run dev
```

---

## Next Steps

✅ **Basic system validated!**

Now you can:

1. **Develop new features**: Follow tasks in `tasks.md` (created via `/sp.tasks`)
2. **Add more languages**: Upload documents in Spanish/French and test multi-language support
3. **Deploy to Kubernetes**: Use Helm charts in `infra/helm/`
4. **Set up monitoring**: Configure Prometheus and Grafana dashboards
5. **Run tests**: `pytest backend/tests` and `npm test` in frontend

---

## Clean Up

To stop all services:

```bash
# Stop frontend (Ctrl+C in terminal)
# Stop backend (Ctrl+C in terminals)
# Stop workers (Ctrl+C in terminals)

# Stop Docker services
docker-compose down

# To remove volumes (resets data)
docker-compose down -v
```

---

## Summary

**What You Validated**:
- ✅ End-to-end chat with RAG (retrieval + generation)
- ✅ Real-time WebSocket streaming
- ✅ Event-driven architecture (Kafka message flow)
- ✅ Knowledge base upload and processing
- ✅ Multi-turn conversation context
- ✅ Escalation logic
- ✅ Multi-tenant data isolation (RLS)
- ✅ Analytics dashboard
- ✅ Observability (logs, traces)

**System Components Running**:
- Backend API (FastAPI)
- Frontend (Next.js)
- AI Inference Worker
- Ingestion Worker
- Kafka + Zookeeper
- Redis
- Supabase (PostgreSQL + pgvector + Auth)
- Groq AI (LLM inference)

**Ready for**: Feature development following tasks in `tasks.md`
