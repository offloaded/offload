-- Document template library: stores uploaded .docx templates with {{placeholder}} extraction
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text DEFAULT '',
  file_name text NOT NULL,
  file_size integer DEFAULT 0,
  storage_path text NOT NULL,
  placeholders jsonb DEFAULT '[]'::jsonb,
  sections jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_document_templates_workspace ON document_templates(workspace_id);

-- Document outputs: generated .docx files from template + agent content
CREATE TABLE IF NOT EXISTS document_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL,
  document_template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  placeholder_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_document_outputs_work_item ON document_outputs(work_item_id);
CREATE INDEX idx_document_outputs_workspace ON document_outputs(workspace_id);

-- Add document template assignment to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS default_document_template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL;

-- Add document template to work items (optional per-item override)
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS document_template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL;

-- RLS policies
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document templates in their workspace" ON document_templates
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage document templates in their workspace" ON document_templates
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view document outputs in their workspace" ON document_outputs
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage document outputs in their workspace" ON document_outputs
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Storage buckets (run via Supabase dashboard or supabase CLI if these don't work in SQL)
INSERT INTO storage.buckets (id, name, public) VALUES ('document-templates', 'document-templates', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('document-outputs', 'document-outputs', false) ON CONFLICT DO NOTHING;
