-- Add voice sample and voice profile columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_samples jsonb DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_profile text DEFAULT NULL;
