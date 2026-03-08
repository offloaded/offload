-- Fix unread counts to support team channels.
-- Previously, all conversations with agent_id = null were grouped as 'group'.
-- Now: agent_id set → agent DM, team_id set → 'team:<id>', else → 'group' (#all).

create or replace function public.get_unread_counts(p_user_id uuid)
returns table(chat_key text, unread_count bigint) as $$
  select
    case
      when c.agent_id is not null then c.agent_id::text
      when c.team_id is not null then 'team:' || c.team_id::text
      else 'group'
    end as chat_key,
    count(m.id)::bigint as unread_count
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where c.user_id = p_user_id
    and m.role = 'assistant'
    and (c.last_read_at is null or m.created_at > c.last_read_at)
    and c.updated_at > now() - interval '90 days'
  group by case
      when c.agent_id is not null then c.agent_id::text
      when c.team_id is not null then 'team:' || c.team_id::text
      else 'group'
    end
  having count(m.id) > 0;
$$ language sql stable security definer;
