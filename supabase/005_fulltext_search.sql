-- Full-text search support for hybrid RAG retrieval
-- Run this in the Supabase SQL Editor

-- Add GIN index for full-text search on chunk content
create index if not exists idx_document_chunks_content_fts
  on public.document_chunks
  using gin (to_tsvector('english', content));

-- Full-text search function (used alongside vector similarity)
create or replace function search_document_chunks_text(
  search_query text,
  search_agent_id uuid,
  search_count int default 20
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float,
  rank float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    0.0::float as similarity,
    ts_rank_cd(to_tsvector('english', dc.content), to_tsquery('english', search_query)) as rank
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.agent_id = search_agent_id
    and d.status = 'ready'
    and to_tsvector('english', dc.content) @@ to_tsquery('english', search_query)
  order by rank desc
  limit search_count;
$$;
