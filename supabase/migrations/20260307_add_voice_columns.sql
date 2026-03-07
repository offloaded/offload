-- Add voice sample, voice profile, and soft skills columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_samples jsonb DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_profile text DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soft_skills jsonb DEFAULT NULL;
