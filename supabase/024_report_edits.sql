-- Add original_content column to track agent's original output vs user edits
alter table reports add column if not exists original_content text;

-- When a report is edited, original_content preserves the agent's first version
-- so agents can learn from the diff between original and edited content
