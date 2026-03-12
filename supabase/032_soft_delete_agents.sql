-- Soft delete for agents: add deleted_at column
-- When set, the agent is considered deleted but data is retained
-- for message history rendering, report authorship, etc.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
