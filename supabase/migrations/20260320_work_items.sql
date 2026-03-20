-- Work Items table
create table if not exists work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'review', 'complete')),
  instructions text,
  report_id uuid references reports(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_work_items_workspace on work_items(workspace_id);
create index if not exists idx_work_items_user on work_items(user_id);
create index if not exists idx_work_items_workspace_status on work_items(workspace_id, status);

-- RLS
alter table work_items enable row level security;

create policy "Users can read work_items in their workspace"
  on work_items for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can insert their own work_items"
  on work_items for insert
  with check (
    user_id = auth.uid()
    and workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can update their own work_items"
  on work_items for update
  using (user_id = auth.uid());

create policy "Users can delete their own work_items"
  on work_items for delete
  using (user_id = auth.uid());

-- Migrate existing reports into work_items with status 'complete'
insert into work_items (workspace_id, user_id, agent_id, title, status, report_id, conversation_id, created_at, updated_at)
select
  r.workspace_id,
  r.user_id,
  r.agent_id,
  r.title,
  'complete',
  r.id,
  r.conversation_id,
  r.created_at,
  r.updated_at
from reports r;
