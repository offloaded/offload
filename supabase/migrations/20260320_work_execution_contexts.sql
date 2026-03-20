-- Work Execution Contexts table
create table if not exists work_execution_contexts (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Store metadata about what was included in context
  context_summary jsonb default null
);

-- Indexes
create index if not exists idx_work_execution_contexts_work_item
  on work_execution_contexts(work_item_id);
create index if not exists idx_work_execution_contexts_work_item_created
  on work_execution_contexts(work_item_id, created_at desc);

-- RLS
alter table work_execution_contexts enable row level security;

create policy "Users can read execution contexts in their workspace"
  on work_execution_contexts for select
  using (
    work_item_id in (
      select wi.id from work_items wi
      where wi.workspace_id in (
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can insert execution contexts for their own work_items"
  on work_execution_contexts for insert
  with check (
    work_item_id in (
      select id from work_items where user_id = auth.uid()
    )
  );

create policy "Users can update execution contexts for their own work_items"
  on work_execution_contexts for update
  using (
    work_item_id in (
      select id from work_items where user_id = auth.uid()
    )
  );

create policy "Users can delete execution contexts for their own work_items"
  on work_execution_contexts for delete
  using (
    work_item_id in (
      select id from work_items where user_id = auth.uid()
    )
  );
