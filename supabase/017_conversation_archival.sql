-- Conversation auto-archival: when a conversation nears the context window limit,
-- archive it with a summary and seamlessly start a new context.

-- Summaries table: stores the AI-generated summary when a conversation is archived
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  summary text NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation summaries"
  ON public.conversation_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_summaries.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert conversation summaries"
  ON public.conversation_summaries FOR INSERT
  WITH CHECK (true);

-- Add archival fields to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS summary text;

-- Chain: when a conversation is archived, the new conversation references the old one
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS previous_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Index for quickly finding the latest non-archived conversation
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON public.conversations(user_id, agent_id, archived, updated_at DESC)
  WHERE archived = false;
