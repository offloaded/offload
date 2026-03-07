-- Add new columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role text DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS working_style jsonb DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS communication_style jsonb DEFAULT NULL;

-- Remove old personality trait columns
ALTER TABLE agents DROP COLUMN IF EXISTS verbosity;
ALTER TABLE agents DROP COLUMN IF EXISTS initiative;
ALTER TABLE agents DROP COLUMN IF EXISTS reactivity;
ALTER TABLE agents DROP COLUMN IF EXISTS repetition_tolerance;
ALTER TABLE agents DROP COLUMN IF EXISTS warmth;
