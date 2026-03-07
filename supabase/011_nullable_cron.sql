-- Allow cron to be null for one-off tasks (they use run_at directly)
alter table public.scheduled_tasks
  alter column cron drop not null;
