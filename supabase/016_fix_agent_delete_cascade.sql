-- Fix agent deletion: change conversations.agent_id from ON DELETE SET NULL
-- to ON DELETE CASCADE so that deleting an agent removes its conversations
-- (and their messages, which cascade from conversations).
--
-- Previously, deleting an agent set agent_id to NULL on its conversations,
-- which made them appear as #all channel conversations (agent_id IS NULL).

-- Drop the existing foreign key constraint
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_agent_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;

-- Also fix activity_log: cascade delete instead of orphaning entries
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_agent_id_fkey;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;

-- Clean up any orphaned conversations that already exist from previous agent deletions.
-- These are conversations with agent_id IS NULL that are NOT group chats
-- (group chats legitimately have agent_id = null).
-- Unfortunately we can't distinguish them after the fact without a flag,
-- so we rely on the application-level cleanup going forward.
