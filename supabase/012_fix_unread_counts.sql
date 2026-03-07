-- Fix unread count function to count across ALL conversations per chat key,
-- not just the single most-recently-updated one.
--
-- The original DISTINCT ON approach missed unread messages when:
-- 1. A new conversation was accidentally created (cache cleared → null conversation_id sent)
-- 2. The SQL picked the new empty conversation as "latest", hiding unread messages in the old one
--
-- The fix: sum unread messages across all conversations for each chat key.
-- Per-conversation last_read_at is still respected, so old conversations that were
-- fully read long ago won't contribute false unread counts.
-- We also limit to conversations active in the last 90 days to ignore truly abandoned history.

create or replace function public.get_unread_counts(p_user_id uuid)
returns table(chat_key text, unread_count bigint) as $$
  select
    coalesce(c.agent_id::text, 'group') as chat_key,
    count(m.id)::bigint as unread_count
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where c.user_id = p_user_id
    and m.role = 'assistant'
    and (c.last_read_at is null or m.created_at > c.last_read_at)
    and c.updated_at > now() - interval '90 days'
  group by coalesce(c.agent_id::text, 'group')
  having count(m.id) > 0;
$$ language sql stable security definer;
