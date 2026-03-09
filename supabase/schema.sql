-- Agents table
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  purpose text not null default '',
  color text not null default '#2C5FF6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agents enable row level security;

create policy "Users can view own agents"
  on public.agents for select
  using (auth.uid() = user_id);

create policy "Users can create own agents"
  on public.agents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own agents"
  on public.agents for update
  using (auth.uid() = user_id);

create policy "Users can delete own agents"
  on public.agents for delete
  using (auth.uid() = user_id);

-- Documents table
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

create policy "Users can view documents for own agents"
  on public.documents for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = documents.agent_id
      and agents.user_id = auth.uid()
    )
  );

create policy "Users can create documents for own agents"
  on public.documents for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = documents.agent_id
      and agents.user_id = auth.uid()
    )
  );

create policy "Users can delete documents for own agents"
  on public.documents for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = documents.agent_id
      and agents.user_id = auth.uid()
    )
  );

-- Document chunks (for RAG - Phase 3)
create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null default 0,
  metadata jsonb default '{}'
);

alter table public.document_chunks enable row level security;

create policy "Users can view chunks for own agents"
  on public.document_chunks for select
  using (
    exists (
      select 1 from public.documents
      join public.agents on agents.id = documents.agent_id
      where documents.id = document_chunks.document_id
      and agents.user_id = auth.uid()
    )
  );

-- Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can create own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null,
  content text not null,
  routed_to uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can view messages in own conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can create messages in own conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );
