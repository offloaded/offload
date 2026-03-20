-- Email Ingestion migration

-- 1. Add inbound_email column to workspaces
alter table workspaces add column if not exists inbound_email text unique;

-- 2. Inbound Emails table
create table if not exists inbound_emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  from_address text not null,
  from_name text,
  to_address text not null,
  subject text,
  body_plain text,
  body_html text,
  attachments jsonb default '[]',
  routed_agent_id uuid references agents(id) on delete set null,
  work_item_id uuid references work_items(id) on delete set null,
  routing_reason text,
  status text not null default 'pending' check (status in ('pending', 'routed', 'failed')),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_inbound_emails_workspace
  on inbound_emails(workspace_id);
create index if not exists idx_inbound_emails_workspace_status
  on inbound_emails(workspace_id, status);

-- RLS
alter table inbound_emails enable row level security;

create policy "Users can read inbound_emails in their workspace"
  on inbound_emails for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- 3. Work Notifications table
create table if not exists work_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_item_id uuid references work_items(id) on delete cascade,
  inbound_email_id uuid references inbound_emails(id) on delete set null,
  type text not null check (type in ('email_received', 'status_change', 'review_ready')),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_work_notifications_user_unread
  on work_notifications(user_id, read) where read = false;

-- RLS
alter table work_notifications enable row level security;

create policy "Users can read their own notifications"
  on work_notifications for select
  using (user_id = auth.uid());

create policy "Users can update their own notifications"
  on work_notifications for update
  using (user_id = auth.uid());

-- 4. Add columns to work_items
alter table work_items add column if not exists source text not null default 'manual';
alter table work_items add column if not exists inbound_email_id uuid references inbound_emails(id) on delete set null;
