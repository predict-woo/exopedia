-- Function to search summary embeddings
CREATE OR REPLACE FUNCTION match_summary_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    page_id int,
    slug text,
    title text,
    score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as page_id,
        p.slug,
        p.title,
        (1 - (se.embedding <=> query_embedding)) as score
    FROM summary_embeddings se
    JOIN pages p ON p.id = se.page_id
    WHERE (1 - (se.embedding <=> query_embedding)) >= match_threshold
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to search content embeddings
CREATE OR REPLACE FUNCTION match_content_embeddings(
    query_embedding vector(1536),
    match_count int DEFAULT 10
)
RETURNS TABLE (
    page_id int,
    slug text,
    title text,
    text text,
    score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as page_id,
        p.slug,
        p.title,
        ce.content as text,
        (1 - (ce.embedding <=> query_embedding)) as score
    FROM content_embeddings ce
    JOIN pages p ON p.id = ce.page_id
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
