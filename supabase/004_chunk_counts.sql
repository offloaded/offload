-- Helper function: count chunks per document (for status diagnostics)
create or replace function count_chunks_by_document(doc_ids uuid[])
returns table (document_id uuid, chunk_count bigint)
language sql stable
as $$
  select dc.document_id, count(*) as chunk_count
  from public.document_chunks dc
  where dc.document_id = any(doc_ids)
  group by dc.document_id;
$$;
