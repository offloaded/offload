-- Phase 3: Documents, chunks, and storage
-- Run this in the Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- Documents table (may already exist from schema.sql — safe with IF NOT EXISTS)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  file_name text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

-- Drop existing policies if re-running (safe)
drop policy if exists "Users can view documents for own agents" on public.documents;
drop policy if exists "Users can create documents for own agents" on public.documents;
drop policy if exists "Users can delete documents for own agents" on public.documents;

create policy "Users can view documents for own agents"
  on public.documents for select
  using (exists (
    select 1 from public.agents
    where agents.id = documents.agent_id and agents.user_id = auth.uid()
  ));

create policy "Users can create documents for own agents"
  on public.documents for insert
  with check (exists (
    select 1 from public.agents
    where agents.id = documents.agent_id and agents.user_id = auth.uid()
  ));

create policy "Users can delete documents for own agents"
  on public.documents for delete
  using (exists (
    select 1 from public.agents
    where agents.id = documents.agent_id and agents.user_id = auth.uid()
  ));

-- Document chunks table
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null default 0,
  metadata jsonb default '{}'
);

alter table public.document_chunks enable row level security;

drop policy if exists "Users can view chunks for own agents" on public.document_chunks;
drop policy if exists "Users can create chunks for own agents" on public.document_chunks;

create policy "Users can view chunks for own agents"
  on public.document_chunks for select
  using (exists (
    select 1 from public.documents
    join public.agents on agents.id = documents.agent_id
    where documents.id = document_chunks.document_id
    and agents.user_id = auth.uid()
  ));

create policy "Users can create chunks for own agents"
  on public.document_chunks for insert
  with check (exists (
    select 1 from public.documents
    join public.agents on agents.id = documents.agent_id
    where documents.id = document_chunks.document_id
    and agents.user_id = auth.uid()
  ));

-- Index for fast similarity search
create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for filtering chunks by document
create index if not exists idx_document_chunks_document_id
  on public.document_chunks(document_id);

-- Similarity search function
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_agent_id uuid,
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.agent_id = match_agent_id
    and d.status = 'ready'
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Create storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "Users can upload documents" on storage.objects;
drop policy if exists "Users can read own documents" on storage.objects;
drop policy if exists "Users can delete own documents" on storage.objects;

create policy "Users can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

create policy "Users can read own documents"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

create policy "Users can delete own documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );
