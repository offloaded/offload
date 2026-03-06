-- Scheduled tasks table
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete cascade not null,
  instruction text not null,
  cron text not null,           -- cron expression (e.g. "0 9 * * 1-5")
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.scheduled_tasks enable row level security;

create policy "Users can view own scheduled tasks"
  on public.scheduled_tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own scheduled tasks"
  on public.scheduled_tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scheduled tasks"
  on public.scheduled_tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own scheduled tasks"
  on public.scheduled_tasks for delete
  using (auth.uid() = user_id);

-- Index for the task runner query (find tasks due to run)
create index if not exists idx_scheduled_tasks_next_run
  on public.scheduled_tasks(next_run_at)
  where enabled = true;

-- Add web_search_enabled to agents
alter table public.agents add column if not exists web_search_enabled boolean not null default false;
