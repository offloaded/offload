-- GitHub integration: add github_enabled and github_repositories columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS github_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS github_repositories JSONB DEFAULT NULL;
-- Format: [{"full_name": "owner/repo", "name": "repo"}]
