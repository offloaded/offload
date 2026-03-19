-- Add Google Calendar columns to agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS google_calendar_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_calendar_ids jsonb DEFAULT null;
