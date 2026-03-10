-- Reports table
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  title text not null,
  content text not null,
  source text not null default 'manual' check (source in ('manual', 'agent')),
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_workspace on reports(workspace_id);
create index if not exists idx_reports_user on reports(user_id);
create index if not exists idx_reports_agent on reports(agent_id);
create index if not exists idx_reports_created on reports(created_at desc);

-- RLS
alter table reports enable row level security;

create policy "Users can read reports in their workspace"
  on reports for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can insert reports in their workspace"
  on reports for insert
  with check (
    user_id = auth.uid()
    and workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can update their own reports"
  on reports for update
  using (user_id = auth.uid());

create policy "Users can delete their own reports"
  on reports for delete
  using (user_id = auth.uid());
