-- ============================================
-- Multi-user Workspaces
-- ============================================

-- 1. Workspaces table
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2. Workspace members
create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- 3. Workspace invites
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- 4. Add workspace_id to existing tables
alter table agents add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table conversations add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table teams add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table documents add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table scheduled_tasks add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- 5. Indexes
create index if not exists idx_workspace_members_user on workspace_members(user_id);
create index if not exists idx_workspace_invites_email on workspace_invites(email, status);
create index if not exists idx_agents_workspace on agents(workspace_id);
create index if not exists idx_conversations_workspace on conversations(workspace_id);
create index if not exists idx_teams_workspace on teams(workspace_id);
create index if not exists idx_scheduled_tasks_workspace on scheduled_tasks(workspace_id);

-- 6. Add sender_id to messages for multi-user channels
-- This tracks which human user sent a message (null for agent messages, or legacy user messages)
alter table messages add column if not exists sender_id uuid references auth.users(id) on delete set null;
alter table messages add column if not exists sender_name text;

-- 7. Migration: Create a default workspace for every existing user
-- and assign all their data to it.
-- This is idempotent — it checks for existing workspace_id before migrating.
do $$
declare
  u record;
  ws_id uuid;
begin
  for u in
    select distinct a.user_id
    from agents a
    where a.workspace_id is null
  loop
    -- Create workspace
    insert into workspaces (name, owner_id)
    values ('My Workspace', u.user_id)
    returning id into ws_id;

    -- Add owner as member
    insert into workspace_members (workspace_id, user_id, role, invited_by)
    values (ws_id, u.user_id, 'owner', u.user_id)
    on conflict do nothing;

    -- Migrate agents
    update agents set workspace_id = ws_id where user_id = u.user_id and workspace_id is null;

    -- Migrate conversations
    update conversations set workspace_id = ws_id where user_id = u.user_id and workspace_id is null;

    -- Migrate teams
    update teams set workspace_id = ws_id where user_id = u.user_id and workspace_id is null;

    -- Migrate scheduled_tasks
    update scheduled_tasks set workspace_id = ws_id where user_id = u.user_id and workspace_id is null;

    -- Migrate documents (through agents)
    update documents d set workspace_id = ws_id
    from agents a
    where d.agent_id = a.id and a.user_id = u.user_id and d.workspace_id is null;
  end loop;
end $$;

-- 8. Also create workspaces for users who have conversations but no agents
do $$
declare
  u record;
  ws_id uuid;
begin
  for u in
    select distinct c.user_id
    from conversations c
    where c.workspace_id is null
    and not exists (select 1 from workspace_members wm where wm.user_id = c.user_id)
  loop
    insert into workspaces (name, owner_id)
    values ('My Workspace', u.user_id)
    returning id into ws_id;

    insert into workspace_members (workspace_id, user_id, role, invited_by)
    values (ws_id, u.user_id, 'owner', u.user_id)
    on conflict do nothing;

    update conversations set workspace_id = ws_id where user_id = u.user_id and workspace_id is null;
  end loop;
end $$;

-- 9. RLS policies for workspaces
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;

-- Users can see workspaces they're a member of
create policy "workspace_member_select" on workspaces
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid())
  );

-- Only owner can update workspace
create policy "workspace_owner_update" on workspaces
  for update using (owner_id = auth.uid());

-- Any authenticated user can create a workspace
create policy "workspace_insert" on workspaces
  for insert with check (owner_id = auth.uid());

-- Owner can delete workspace
create policy "workspace_owner_delete" on workspaces
  for delete using (owner_id = auth.uid());

-- Members can see other members of their workspaces
create policy "workspace_members_select" on workspace_members
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid())
  );

-- Owner/admin can manage members
create policy "workspace_members_insert" on workspace_members
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

create policy "workspace_members_delete" on workspace_members
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

create policy "workspace_members_update" on workspace_members
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

-- Invites: owner/admin can manage, invited user can see their own
create policy "workspace_invites_select" on workspace_invites
  for select using (
    email = (select email from auth.users where id = auth.uid())
    or exists (select 1 from workspace_members wm where wm.workspace_id = workspace_invites.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

create policy "workspace_invites_insert" on workspace_invites
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_invites.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

create policy "workspace_invites_delete" on workspace_invites
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspace_invites.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
  );

-- 10. Update existing RLS policies on agents, teams, etc. to be workspace-aware
-- Instead of .eq("user_id", user.id) we'll use the service client + workspace helper
-- in the application layer. The existing RLS policies still work because
-- workspace members include the original owner, and we use service role for
-- cross-user workspace access.

-- 11. Updated unread counts function to support workspace context
-- The existing get_unread_counts function works per-user and will continue to work
-- since conversations.user_id tracks who "owns" the conversation record.
-- For shared channels, each user has their own conversation record with last_read_at.
