-- Add display_name and timezone columns to user_profiles
alter table user_profiles add column if not exists display_name text;
alter table user_profiles add column if not exists timezone text not null default 'UTC';
