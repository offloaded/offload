-- Add personality trait columns to agents table.
-- Each trait is an integer 1–5 with a default of 3 (neutral).
alter table public.agents
  add column if not exists verbosity           integer not null default 3 check (verbosity           between 1 and 5),
  add column if not exists initiative          integer not null default 3 check (initiative          between 1 and 5),
  add column if not exists reactivity          integer not null default 3 check (reactivity          between 1 and 5),
  add column if not exists repetition_tolerance integer not null default 3 check (repetition_tolerance between 1 and 5),
  add column if not exists warmth              integer not null default 3 check (warmth              between 1 and 5);
