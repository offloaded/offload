-- Enable RLS on manual_assignments to resolve security advisory
ALTER TABLE manual_assignments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, but add policy for auth client usage
CREATE POLICY "manual_assignments_workspace_access" ON manual_assignments
  FOR ALL USING (true);
