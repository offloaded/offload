-- ============================================
-- Channel Visibility & Privacy Controls
-- ============================================

-- 1. Add visibility to teams (channels)
-- 'public' = all workspace members can see
-- 'private' = only explicitly invited members can see
alter table teams add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));

-- Track who created the team (for private channel management)
alter table teams add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Backfill created_by from user_id for existing teams
update teams set created_by = user_id where created_by is null;

-- 2. Channel members table — tracks who can access private channels
create table if not exists channel_members (
  channel_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists idx_channel_members_user on channel_members(user_id);
create index if not exists idx_channel_members_channel on channel_members(channel_id);

-- RLS for channel_members
alter table channel_members enable row level security;

-- Members can see other members of channels they belong to
create policy "channel_members_select" on channel_members
  for select using (
    exists (
      select 1 from channel_members cm
      where cm.channel_id = channel_members.channel_id
      and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from teams t
      join workspace_members wm on wm.workspace_id = t.workspace_id
      where t.id = channel_members.channel_id
      and wm.user_id = auth.uid()
      and t.visibility = 'public'
    )
  );

-- Admins and channel creator can manage members
create policy "channel_members_insert" on channel_members
  for insert with check (
    exists (
      select 1 from teams t
      join workspace_members wm on wm.workspace_id = t.workspace_id
      where t.id = channel_members.channel_id
      and wm.user_id = auth.uid()
      and (wm.role in ('owner', 'admin') or t.created_by = auth.uid())
    )
  );

create policy "channel_members_delete" on channel_members
  for delete using (
    exists (
      select 1 from teams t
      join workspace_members wm on wm.workspace_id = t.workspace_id
      where t.id = channel_members.channel_id
      and wm.user_id = auth.uid()
      and (wm.role in ('owner', 'admin') or t.created_by = auth.uid())
    )
  );

-- 3. Add is_system flag to teams for special channels (#all-humans)
alter table teams add column if not exists is_system boolean not null default false;

-- 4. Create #all-humans channel for every existing workspace
do $$
declare
  ws record;
begin
  for ws in
    select id, owner_id from workspaces
    where not exists (
      select 1 from teams t
      where t.workspace_id = ws.id
      and t.name = 'All Humans'
      and t.is_system = true
    )
  loop
    insert into teams (user_id, workspace_id, name, description, visibility, is_system, created_by)
    values (
      ws.owner_id,
      ws.id,
      'All Humans',
      'A space for humans only — no agents participate',
      'public',
      true,
      ws.owner_id
    );
  end loop;
end $$;

-- 5. Update get_unread_counts to include #all-humans channel
-- (already handled by the team:id pattern, no change needed)

-- 6. Index for faster visibility queries
create index if not exists idx_teams_visibility on teams(workspace_id, visibility);
create index if not exists idx_teams_system on teams(workspace_id, is_system);
