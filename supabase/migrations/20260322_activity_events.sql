-- Activity events table for the dashboard activity feed
-- Source-agnostic event log for all workspace activity
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  work_item_id uuid references work_items(id) on delete set null,
  event_type text not null check (event_type in (
    'email_received',
    'work_started',
    'work_completed',
    'document_generated',
    'schedule_missed'
  )),
  description text not null,
  created_at timestamptz not null default now()
);

-- Index for dashboard queries (recent events per workspace)
create index if not exists idx_activity_events_workspace_created
  on activity_events (workspace_id, created_at desc);

-- RLS
alter table activity_events enable row level security;

create policy "Users can view activity in their workspace"
  on activity_events for select
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can insert activity events"
  on activity_events for insert
  with check (true);
