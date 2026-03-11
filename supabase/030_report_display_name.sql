-- Add display_name column for user-renamable reports
-- display_name is the user-facing name; title preserves the agent-generated name
alter table reports add column if not exists display_name text;
