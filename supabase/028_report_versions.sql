-- Report versions table for edit history
create table if not exists report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  content text not null,
  title text not null,
  author_type text not null check (author_type in ('human', 'agent')),
  author_id uuid, -- user_id or agent_id depending on author_type
  change_type text not null check (change_type in ('human_edit', 'agent_update', 'initial')),
  created_at timestamptz not null default now()
);

create index if not exists idx_report_versions_report on report_versions(report_id);
create index if not exists idx_report_versions_created on report_versions(created_at desc);

-- RLS
alter table report_versions enable row level security;

create policy "Users can read versions of reports in their workspace"
  on report_versions for select
  using (
    report_id in (
      select id from reports where workspace_id in (
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can insert versions for reports in their workspace"
  on report_versions for insert
  with check (
    report_id in (
      select id from reports where workspace_id in (
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );
