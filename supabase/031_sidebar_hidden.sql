-- Add sidebar_hidden flag to conversations
-- When true, the conversation is hidden from the sidebar but NOT deleted
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sidebar_hidden boolean NOT NULL DEFAULT false;

-- Index for efficient filtering in active-dms query
CREATE INDEX IF NOT EXISTS idx_conversations_sidebar_hidden
  ON conversations (user_id, workspace_id, sidebar_hidden)
  WHERE sidebar_hidden = false;
