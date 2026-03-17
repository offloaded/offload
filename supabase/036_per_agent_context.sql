-- Per-agent context windowing for team chats
-- Store agent_id on messages so we can build per-agent context windows
-- Cache per-agent summaries on conversations to avoid re-summarising

-- Add agent attribution to messages (nullable — DM messages don't have this)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_name text;

-- Cache per-agent contribution summaries on conversations
-- Format: { "agent-uuid": { "summary": "...", "last_message_id": "..." } }
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_context_cache jsonb DEFAULT '{}'::jsonb;

-- Index for efficient per-agent message queries in team chats
CREATE INDEX IF NOT EXISTS idx_messages_conversation_agent
  ON messages(conversation_id, agent_id)
  WHERE agent_id IS NOT NULL;
