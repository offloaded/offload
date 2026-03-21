-- Performance indexes for common query patterns

-- Messages: filtered by conversation, ordered by created_at
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_not_cleared
  ON messages(conversation_id, created_at DESC)
  WHERE cleared_at IS NULL;

-- Conversations: workspace lookups, agent DMs, ordering
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_agent
  ON conversations(workspace_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_updated
  ON conversations(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_not_hidden
  ON conversations(workspace_id, updated_at DESC)
  WHERE sidebar_hidden = false AND archived = false;

-- Agents: workspace lookups
CREATE INDEX IF NOT EXISTS idx_agents_workspace_active
  ON agents(workspace_id)
  WHERE deleted_at IS NULL;

-- Work items: workspace + status queries
CREATE INDEX IF NOT EXISTS idx_work_items_workspace_updated
  ON work_items(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_items_workspace_status
  ON work_items(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_conversation
  ON work_items(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- Reports: workspace lookups
CREATE INDEX IF NOT EXISTS idx_reports_workspace_created
  ON reports(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_conversation
  ON reports(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- Work execution contexts: work item lookups
CREATE INDEX IF NOT EXISTS idx_work_exec_ctx_work_item
  ON work_execution_contexts(work_item_id, created_at DESC);

-- Unread tracking: conversation-based lookups
CREATE INDEX IF NOT EXISTS idx_conversation_reads_user_conv
  ON conversation_reads(user_id, conversation_id);

-- Activity events: workspace + time ordering
CREATE INDEX IF NOT EXISTS idx_activity_events_workspace_created
  ON activity_events(workspace_id, created_at DESC);

-- Notifications: workspace + unread
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_unread
  ON notifications(workspace_id, created_at DESC)
  WHERE read_at IS NULL;

-- Scheduled tasks: workspace lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_workspace
  ON scheduled_tasks(workspace_id);
