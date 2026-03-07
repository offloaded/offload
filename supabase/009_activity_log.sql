-- Phase 9: Activity log for real-time agent activity feed
-- Run this in the Supabase SQL Editor

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete set null,
  type text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "Users can view own activity"
  on public.activity_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own activity"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- Service role can insert (for cron jobs)
create policy "Service role can insert activity"
  on public.activity_log for insert
  with check (true);

-- Index for efficient feed queries
create index if not exists idx_activity_log_user_created
  on public.activity_log(user_id, created_at desc);
