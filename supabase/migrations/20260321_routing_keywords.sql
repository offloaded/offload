-- Add routing keywords and tracking columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS routing_keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS keywords_updated_at TIMESTAMPTZ;

-- Track manual work item assignments for keyword learning
-- previous_agent_id captures reassignments (negative signal: routing got it wrong)
CREATE TABLE IF NOT EXISTS manual_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  previous_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  work_item_title TEXT,
  work_item_instructions TEXT,
  assigned_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_assignments_agent ON manual_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_manual_assignments_workspace ON manual_assignments(workspace_id);
