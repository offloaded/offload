-- Assign report templates to specific agents
-- Templates assigned to an agent are injected into its system prompt at runtime
alter table public.agents
  add column if not exists assigned_templates jsonb default null;

comment on column public.agents.assigned_templates is 'Array of report template IDs assigned to this agent';
