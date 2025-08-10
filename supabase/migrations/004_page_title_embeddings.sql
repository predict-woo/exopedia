-- Add optional title embedding to pages and remove summary_embeddings

-- 1) Add new column for title embeddings (512 dims) on pages
ALTER TABLE IF EXISTS public.pages
  ADD COLUMN IF NOT EXISTS title_embedding vector(512);

-- 2) Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_pages_title_embedding
  ON public.pages USING hnsw (title_embedding vector_cosine_ops);

-- 3) Create function to match pages by title embedding
CREATE OR REPLACE FUNCTION public.match_page_title_embeddings(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  page_id int,
  slug text,
  title text,
  summary text,
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
    p.summary,
    (1 - (p.title_embedding <=> query_embedding)) as score
  FROM public.pages p
  WHERE p.title_embedding IS NOT NULL
    AND (1 - (p.title_embedding <=> query_embedding)) >= match_threshold
  ORDER BY p.title_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4) Drop old summary embedding function, index, and table
DROP FUNCTION IF EXISTS public.match_summary_embeddings(vector, float, int);
DROP INDEX IF EXISTS public.idx_summary_embeddings_vector;
DROP TABLE IF EXISTS public.summary_embeddings;


