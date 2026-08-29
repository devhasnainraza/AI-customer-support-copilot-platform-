-- =============================================================================
-- AI Customer Support Copilot - Initial Schema Migration
-- =============================================================================
-- Purpose: Create all core tables, enable pgvector extension, set up RLS policies
-- Migration: 001_initial_schema.sql
-- Date: 2026-06-20
-- =============================================================================

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- T014: Create customers table with RLS policies
-- =============================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'support_agent', 'admin', 'manager')),
    tenant_id UUID NOT NULL,
    auth_id TEXT UNIQUE NOT NULL, -- Supabase Auth user ID
    language_preference TEXT, -- ISO 639-1 code
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for customers
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_auth_id ON customers(auth_id);
CREATE INDEX idx_customers_tenant_email ON customers(tenant_id, email);
CREATE INDEX idx_customers_role ON customers(role);

-- RLS policies for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_own_data ON customers
    FOR ALL
    USING (auth_id = auth.uid()::text);

CREATE POLICY admin_all_customers ON customers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = customers.tenant_id
        )
    );

-- =============================================================================
-- T015: Create conversations table with RLS policies
-- =============================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated', 'abandoned')),
    language TEXT NOT NULL, -- ISO 639-1 code
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    assigned_agent_id UUID REFERENCES customers(id), -- NULL if not escalated
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
    ai_resolution BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for conversations
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_agent ON conversations(assigned_agent_id);
CREATE INDEX idx_conversations_tenant_customer_status ON conversations(tenant_id, customer_id, status);
CREATE INDEX idx_conversations_tenant_language_started ON conversations(tenant_id, language, started_at);

-- RLS policies for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_own_conversations ON conversations
    FOR SELECT
    USING (
        customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()::text)
    );

CREATE POLICY agent_assigned_conversations ON conversations
    FOR SELECT
    USING (
        assigned_agent_id IN (
            SELECT id FROM customers
            WHERE auth_id = auth.uid()::text
            AND role = 'support_agent'
        )
    );

CREATE POLICY admin_all_conversations ON conversations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = conversations.tenant_id
        )
    );

-- =============================================================================
-- T016: Create messages table with RLS policies
-- =============================================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'ai', 'human_agent')),
    sender_id UUID NOT NULL, -- customer_id or agent_id
    content TEXT NOT NULL CHECK (length(content) <= 10000),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    retrieved_chunks JSONB, -- Array of chunk_ids for RAG context
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_conversation_timestamp ON messages(conversation_id, timestamp);
CREATE INDEX idx_messages_tenant_timestamp ON messages(tenant_id, timestamp);
CREATE INDEX idx_messages_retrieved_chunks ON messages USING GIN(retrieved_chunks);

-- RLS policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_via_conversation ON messages
    FOR SELECT
    USING (
        conversation_id IN (SELECT id FROM conversations)
    );

CREATE POLICY admin_all_messages ON messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = messages.tenant_id
        )
    );

-- =============================================================================
-- T017: Create documents table with RLS policies
-- =============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'markdown', 'html')),
    file_size_bytes INTEGER NOT NULL,
    language TEXT NOT NULL, -- ISO 639-1 code
    uploaded_by UUID NOT NULL REFERENCES customers(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for documents
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_language ON documents(language);
CREATE INDEX idx_documents_tenant_language_status ON documents(tenant_id, language, processing_status);
CREATE INDEX idx_documents_tenant_uploaded ON documents(tenant_id, uploaded_at);

-- RLS policies for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_documents ON documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = documents.tenant_id
        )
    );

-- =============================================================================
-- T018: Create chunks table with pgvector extension and HNSW indexes
-- =============================================================================

CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL CHECK (length(content) BETWEEN 100 AND 2000),
    embedding vector(1536), -- OpenAI ada-002 compatible
    language TEXT NOT NULL, -- ISO 639-1 code
    position INTEGER NOT NULL, -- Sequential position in document
    char_start INTEGER NOT NULL,
    char_end INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for chunks
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_tenant ON chunks(tenant_id);
CREATE INDEX idx_chunks_document_position ON chunks(document_id, position);
CREATE INDEX idx_chunks_tenant_language ON chunks(tenant_id, language);

-- HNSW vector indexes per language for optimal semantic search
CREATE INDEX idx_chunks_embedding_en ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE language = 'en';

CREATE INDEX idx_chunks_embedding_es ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE language = 'es';

CREATE INDEX idx_chunks_embedding_fr ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE language = 'fr';

-- Full-text search indexes per language
CREATE INDEX idx_chunks_fts_en ON chunks USING GIN(to_tsvector('english', content))
    WHERE language = 'en';

CREATE INDEX idx_chunks_fts_es ON chunks USING GIN(to_tsvector('spanish', content))
    WHERE language = 'es';

CREATE INDEX idx_chunks_fts_fr ON chunks USING GIN(to_tsvector('french', content))
    WHERE language = 'fr';

-- RLS policies for chunks
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY chunks_via_documents ON chunks
    FOR SELECT
    USING (
        document_id IN (SELECT id FROM documents)
    );

CREATE POLICY admin_manage_chunks ON chunks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = chunks.tenant_id
        )
    );

-- =============================================================================
-- T019: Create tickets table with RLS policies
-- =============================================================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    conversation_id UUID UNIQUE NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL, -- Format: TICK-YYYYMMDD-NNNN
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
    category TEXT, -- e.g., 'billing', 'technical', 'account'
    assigned_team TEXT,
    assigned_agent_id UUID REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_by TEXT NOT NULL CHECK (created_by IN ('ai_auto', 'human_manual')),
    ai_summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for tickets
CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_conversation ON tickets(conversation_id);
CREATE INDEX idx_tickets_tenant_status_priority ON tickets(tenant_id, status, priority);
CREATE INDEX idx_tickets_tenant_agent_status ON tickets(tenant_id, assigned_agent_id, status);
CREATE INDEX idx_tickets_tenant_created ON tickets(tenant_id, created_at);

-- RLS policies for tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_own_tickets ON tickets
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()::text)
        )
    );

CREATE POLICY agent_assigned_tickets ON tickets
    FOR SELECT
    USING (
        assigned_agent_id IN (
            SELECT id FROM customers
            WHERE auth_id = auth.uid()::text
            AND role = 'support_agent'
        )
    );

CREATE POLICY admin_all_tickets ON tickets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('admin', 'manager')
            AND c.tenant_id = tickets.tenant_id
        )
    );

-- =============================================================================
-- T020: Create metrics table
-- =============================================================================

CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value FLOAT NOT NULL CHECK (metric_value >= 0),
    aggregation_period TEXT NOT NULL CHECK (aggregation_period IN ('hourly', 'daily', 'weekly', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL CHECK (period_end > period_start),
    dimensions JSONB DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, metric_name, aggregation_period, period_start, dimensions)
);

-- Indexes for metrics
CREATE INDEX idx_metrics_tenant ON metrics(tenant_id);
CREATE INDEX idx_metrics_tenant_name_period ON metrics(tenant_id, metric_name, period_start);

-- RLS policies for metrics
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY manager_view_metrics ON metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            WHERE c.auth_id = auth.uid()::text
            AND c.role IN ('manager', 'admin')
            AND c.tenant_id = metrics.tenant_id
        )
    );

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get current tenant_id from JWT claims
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt()->>'tenant_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_auth_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM customers
        WHERE auth_id = user_auth_id
        AND role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is agent
CREATE OR REPLACE FUNCTION is_agent(user_auth_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM customers
        WHERE auth_id = user_auth_id
        AND role = 'support_agent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update updated_at timestamp on customers table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Vector Search Functions
-- =============================================================================

-- Function for semantic vector search
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding vector(1536),
    query_language text,
    query_tenant_id uuid,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    tenant_id uuid,
    content text,
    language text,
    "position" int,
    char_start int,
    char_end int,
    token_count int,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.tenant_id,
        c.content,
        c.language,
        c.position,
        c.char_start,
        c.char_end,
        c.token_count,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE c.language = query_language
        AND c.tenant_id = query_tenant_id
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function for hybrid search (vector + full-text)
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    query_embedding vector(1536),
    query_text text,
    query_language text,
    query_tenant_id uuid,
    match_count int DEFAULT 5,
    vector_weight float DEFAULT 0.7,
    text_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    tenant_id uuid,
    content text,
    language text,
    "position" int,
    char_start int,
    char_end int,
    token_count int,
    metadata jsonb,
    combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.tenant_id,
        c.content,
        c.language,
        c.position,
        c.char_start,
        c.char_end,
        c.token_count,
        c.metadata,
        (
            (vector_weight * (1 - (c.embedding <=> query_embedding))) +
            (text_weight * ts_rank(
                to_tsvector(
                    CASE query_language
                        WHEN 'en' THEN 'english'
                        WHEN 'es' THEN 'spanish'
                        WHEN 'fr' THEN 'french'
                        ELSE 'english'
                    END,
                    c.content
                ),
                plainto_tsquery(
                    CASE query_language
                        WHEN 'en' THEN 'english'
                        WHEN 'es' THEN 'spanish'
                        WHEN 'fr' THEN 'french'
                        ELSE 'english'
                    END,
                    query_text
                )
            ))
        ) AS combined_score
    FROM chunks c
    WHERE c.language = query_language
        AND c.tenant_id = query_tenant_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- Auto-create customer profile on signup trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.customers (id, email, name, role, tenant_id, auth_id, language_preference)
    VALUES (
        new.id, 
        new.email, 
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
        coalesce(new.raw_user_meta_data->>'role', 'customer'),
        coalesce((new.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
        new.id::text,
        coalesce(new.raw_user_meta_data->>'language_preference', 'en')
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_id = EXCLUDED.auth_id,
        name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE public.customers.name END,
        updated_at = NOW();
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users from auth.users to public.customers
INSERT INTO public.customers (id, email, name, role, tenant_id, auth_id, language_preference)
SELECT 
    id, 
    email, 
    coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''), 
    coalesce(raw_user_meta_data->>'role', 'customer'),
    coalesce((raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
    id::text,
    coalesce(raw_user_meta_data->>'language_preference', 'en')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Migration Complete
-- =============================================================================

-- Insert migration record (optional - for tracking)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');
