-- Report templates table
create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  -- Parsed structure: array of {heading, description} objects
  structure jsonb not null default '[]'::jsonb,
  -- Original file metadata
  file_name text,
  file_size integer,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_templates_workspace on report_templates(workspace_id);

-- RLS
alter table report_templates enable row level security;

create policy "Users can read templates in their workspace"
  on report_templates for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can insert templates in their workspace"
  on report_templates for insert
  with check (
    user_id = auth.uid()
    and workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can update templates in their workspace"
  on report_templates for update
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Users can delete their own templates"
  on report_templates for delete
  using (user_id = auth.uid());
