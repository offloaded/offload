-- ============================================
-- Marketplace Agent Templates (curated catalogue)
-- ============================================

-- Template catalogue — stores pre-built agent definitions
create table if not exists marketplace_templates (
  id text primary key,                       -- slug e.g. "weekly-metrics-analyst"
  name text not null,
  icon text not null default '🤖',
  category text not null default 'Custom',
  tagline text not null default '',
  description text not null default '',
  target_persona jsonb not null default '[]'::jsonb,   -- ["EOS Implementers", "Agency Founders"]
  system_prompt text not null default '',
  voice jsonb not null default '{}'::jsonb,             -- {tone, style, avoids}
  tools jsonb not null default '[]'::jsonb,             -- ["web_search", "asana"]
  report_templates jsonb not null default '[]'::jsonb,  -- [{name, description, structure}]
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_templates_active on marketplace_templates(is_active, sort_order);
create index if not exists idx_marketplace_templates_category on marketplace_templates(category) where is_active = true;

-- RLS — readable by all authenticated users
alter table marketplace_templates enable row level security;

create policy "marketplace_templates_select" on marketplace_templates
  for select using (auth.role() = 'authenticated');

-- Provenance: track which template an agent was installed from
alter table agents add column if not exists source_template_id text references marketplace_templates(id) on delete set null;

-- Custom system prompt: used by template-sourced agents (overrides built prompt)
alter table agents add column if not exists custom_system_prompt text;

-- Voice object from template: {tone, style, avoids}
alter table agents add column if not exists voice_config jsonb;
