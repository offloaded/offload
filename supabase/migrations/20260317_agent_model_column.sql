-- Add model column to agents table for per-agent model selection
-- NULL means use the default model (currently claude-sonnet-4-5-20250929)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT NULL;

COMMENT ON COLUMN agents.model IS 'Override Claude model for this agent. NULL = default (Sonnet). Example: claude-opus-4-0-20250514';
