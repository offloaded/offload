-- Full-text search on messages for conversation history search
-- Run this in the Supabase SQL Editor

-- GIN index for full-text search on message content
create index if not exists idx_messages_content_fts
  on public.messages
  using gin (to_tsvector('english', content));

-- Index for listing conversations by user, sorted by updated_at
create index if not exists idx_conversations_user_updated
  on public.conversations(user_id, updated_at desc);

-- Allow users to delete their own conversations
create policy "Users can delete own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);
