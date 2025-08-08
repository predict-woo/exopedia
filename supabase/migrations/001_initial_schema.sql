-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create the Pages table
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT UNIQUE NOT NULL,
    storage_object_path TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the PageViews table
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create the Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('부적절함', '논리적 오류', '기타')),
    reason_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create the Content Embeddings table (for RAG)
CREATE TABLE IF NOT EXISTS content_embeddings (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(page_id, chunk_index)
);

-- Create the Summary Embeddings table (for link validation)
CREATE TABLE IF NOT EXISTS summary_embeddings (
    id SERIAL PRIMARY KEY,
    page_id INTEGER UNIQUE NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_content_embeddings_vector ON content_embeddings 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_summary_embeddings_vector ON summary_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- Create indexes for regular queries
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page_id ON page_views(page_id);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at DESC);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(ip_address, endpoint, window_start)
);

-- Create index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip_address, endpoint, window_start DESC);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_ip_address INET,
    p_endpoint TEXT,
    p_max_requests INTEGER DEFAULT 10,
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_window TIMESTAMPTZ;
    v_request_count INTEGER;
BEGIN
    v_current_window := date_trunc('minute', NOW());
    
    -- Count requests in current window
    SELECT COALESCE(SUM(request_count), 0) INTO v_request_count
    FROM rate_limits
    WHERE ip_address = p_ip_address
        AND endpoint = p_endpoint
        AND window_start >= v_current_window - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Check if limit exceeded
    IF v_request_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;
    
    -- Log this request
    INSERT INTO rate_limits (ip_address, endpoint, window_start)
    VALUES (p_ip_address, p_endpoint, v_current_window)
    ON CONFLICT (ip_address, endpoint, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Storage bucket policy (run this in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('pages', 'pages', true)
-- ON CONFLICT (id) DO NOTHING;
