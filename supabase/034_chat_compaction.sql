-- Chat compaction: summarise older messages to prevent long conversation failures
-- The full history stays in the DB for UI display; compaction only affects the API payload.

-- Store the latest compaction summary on the conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS compaction_summary text;

-- Mark individual messages that have been compacted (skipped in API payload)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS compacted_at timestamptz;

-- Index to quickly fetch only non-compacted messages for API payload building
CREATE INDEX IF NOT EXISTS idx_messages_not_compacted
  ON messages (conversation_id, created_at)
  WHERE compacted_at IS NULL;
