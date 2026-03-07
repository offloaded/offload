-- Add recurring flag to scheduled_tasks (default true for backward compatibility)
alter table public.scheduled_tasks
  add column if not exists recurring boolean not null default true;
