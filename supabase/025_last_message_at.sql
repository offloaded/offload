-- Add last_message_at to agents and teams for sidebar sort order
alter table agents add column if not exists last_message_at timestamptz;
alter table teams add column if not exists last_message_at timestamptz;

create index if not exists idx_agents_last_message on agents(last_message_at desc nulls last);
create index if not exists idx_teams_last_message on teams(last_message_at desc nulls last);

-- Backfill from existing messages
update agents set last_message_at = sub.latest
from (
  select c.agent_id, max(m.created_at) as latest
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.agent_id is not null
  group by c.agent_id
) sub
where agents.id = sub.agent_id;

update teams set last_message_at = sub.latest
from (
  select c.team_id, max(m.created_at) as latest
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.team_id is not null
  group by c.team_id
) sub
where teams.id = sub.team_id;

-- Also backfill group chat (team_id is null, agent_id is null) — no table to update,
-- but we need the "All" channel timestamp. We'll handle that in the API.

-- Trigger function: on message insert, update the parent agent or team
create or replace function update_last_message_at()
returns trigger as $$
declare
  conv record;
begin
  select agent_id, team_id into conv
  from conversations
  where id = NEW.conversation_id;

  if conv.agent_id is not null then
    update agents set last_message_at = NEW.created_at
    where id = conv.agent_id and (last_message_at is null or last_message_at < NEW.created_at);
  end if;

  if conv.team_id is not null then
    update teams set last_message_at = NEW.created_at
    where id = conv.team_id and (last_message_at is null or last_message_at < NEW.created_at);
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_last_message_at on messages;
create trigger trg_update_last_message_at
  after insert on messages
  for each row
  execute function update_last_message_at();
