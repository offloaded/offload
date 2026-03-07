-- Phase 8: Unread message tracking
-- Run this in the Supabase SQL Editor

-- Add last_read_at to conversations (null = never read)
alter table public.conversations
  add column if not exists last_read_at timestamptz;

-- Function to count unread messages per chat for a user.
-- Returns one row per "chat" (group chat + each agent DM) with unread_count.
create or replace function public.get_unread_counts(p_user_id uuid)
returns table(chat_key text, unread_count bigint) as $$
  -- For each agent (or group), find the most recent conversation,
  -- then count messages after last_read_at with role = 'assistant'.
  with latest_convs as (
    select distinct on (coalesce(agent_id::text, 'group'))
      id,
      coalesce(agent_id::text, 'group') as chat_key,
      last_read_at
    from public.conversations
    where user_id = p_user_id
    order by coalesce(agent_id::text, 'group'), updated_at desc
  )
  select
    lc.chat_key,
    count(m.id)::bigint as unread_count
  from latest_convs lc
  join public.messages m on m.conversation_id = lc.id
  where m.role = 'assistant'
    and (lc.last_read_at is null or m.created_at > lc.last_read_at)
  group by lc.chat_key
  having count(m.id) > 0;
$$ language sql stable security definer;
