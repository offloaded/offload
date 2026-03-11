-- Asana integration: store OAuth tokens per workspace
CREATE TABLE IF NOT EXISTS integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'asana',
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  asana_user_gid text,
  asana_user_name text,
  connected_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, provider)
);

-- Store which Asana projects are linked to which agents
CREATE TABLE IF NOT EXISTS agent_asana_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  asana_project_gid text NOT NULL,
  asana_project_name text NOT NULL,
  asana_workspace_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, asana_project_gid)
);

-- Add asana_enabled flag to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS asana_enabled boolean DEFAULT false;

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_asana_projects ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, but add policies for auth client usage
CREATE POLICY "integrations_workspace_access" ON integrations
  FOR ALL USING (true);

CREATE POLICY "agent_asana_projects_access" ON agent_asana_projects
  FOR ALL USING (true);
