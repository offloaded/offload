-- Store Asana project assignments directly on the agent record as jsonb
-- Format: [{"gid": "...", "name": "...", "workspace": "..."}]
ALTER TABLE agents ADD COLUMN IF NOT EXISTS asana_projects jsonb DEFAULT NULL;
