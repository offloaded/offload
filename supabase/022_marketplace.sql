-- ============================================
-- Agent & Team Marketplace
-- ============================================

-- 1. Marketplace listings table
create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('agent', 'team')),
  source_agent_id uuid references agents(id) on delete set null,
  source_team_id uuid references teams(id) on delete set null,
  publisher_user_id uuid not null references auth.users(id) on delete cascade,
  publisher_workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text not null check (char_length(description) <= 500),
  category text not null default 'Custom',
  adoption_count integer not null default 0,
  status text not null default 'published' check (status in ('published', 'unpublished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_marketplace_status on marketplace_listings(status, type);
create index if not exists idx_marketplace_category on marketplace_listings(category) where status = 'published';
create index if not exists idx_marketplace_source_agent on marketplace_listings(source_agent_id) where source_agent_id is not null;
create index if not exists idx_marketplace_source_team on marketplace_listings(source_team_id) where source_team_id is not null;
create index if not exists idx_marketplace_publisher on marketplace_listings(publisher_user_id);

-- RLS
alter table marketplace_listings enable row level security;

-- Anyone authenticated can read published listings
create policy "marketplace_select_published" on marketplace_listings
  for select using (
    status = 'published' or publisher_user_id = auth.uid()
  );

-- Publisher can insert
create policy "marketplace_insert" on marketplace_listings
  for insert with check (publisher_user_id = auth.uid());

-- Publisher can update their own
create policy "marketplace_update" on marketplace_listings
  for update using (publisher_user_id = auth.uid());

-- Publisher can delete their own
create policy "marketplace_delete" on marketplace_listings
  for delete using (publisher_user_id = auth.uid());
