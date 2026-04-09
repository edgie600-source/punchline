-- Run this in the Supabase SQL editor (or via migration) before using the app.

create table if not exists public.job_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  from_number text not null default '',
  sender_name text,
  job_name text,
  work_completed text,
  work_completed_en text,
  work_completed_es text,
  blockers text,
  blockers_en text,
  blockers_es text,
  materials_needed text,
  materials_needed_en text,
  materials_needed_es text,
  hours_worked numeric,
  raw_message text
);

-- If you already created the table, run this safely:
alter table public.job_updates
  add column if not exists sender_name text;
alter table public.job_updates
  add column if not exists work_completed_en text;
alter table public.job_updates
  add column if not exists work_completed_es text;
alter table public.job_updates
  add column if not exists blockers_en text;
alter table public.job_updates
  add column if not exists blockers_es text;
alter table public.job_updates
  add column if not exists materials_needed_en text;
alter table public.job_updates
  add column if not exists materials_needed_es text;

alter table public.job_updates enable row level security;

-- Anon key is used by the Next.js API route and server-rendered dashboard.
-- Tighten these policies in production (e.g. restrict INSERT to a service role only).
create policy "Allow anon insert job_updates"
  on public.job_updates
  for insert
  to anon
  with check (true);

create policy "Allow anon select job_updates"
  on public.job_updates
  for select
  to anon
  using (true);

alter table public.job_updates
  add column if not exists blocker_resolved boolean not null default false;

create policy "Allow anon update job_updates"
  on public.job_updates
  for update
  to anon
  using (true)
  with check (true);

-- Jobs (one row per job site). SMS webhook links each update via job_id.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'blocked', 'complete'))
);

alter table public.job_updates
  add column if not exists job_id uuid references public.jobs (id) on delete set null;

create index if not exists job_updates_job_id_created_at_idx
  on public.job_updates (job_id, created_at desc);

alter table public.jobs enable row level security;

create policy "Allow anon select jobs"
  on public.jobs
  for select
  to anon
  using (true);

create policy "Allow anon insert jobs"
  on public.jobs
  for insert
  to anon
  with check (true);

create policy "Allow anon update jobs"
  on public.jobs
  for update
  to anon
  using (true);

-- One-time backfill for existing rows (run in SQL editor after deploying the above):
-- insert into public.jobs (name)
-- select distinct coalesce(nullif(trim(job_name), ''), 'Unspecified job')
-- from public.job_updates
-- where job_id is null
--   and not exists (
--     select 1 from public.jobs j
--     where j.name = coalesce(nullif(trim(job_updates.job_name), ''), 'Unspecified job')
--   );
-- update public.job_updates ju
-- set job_id = j.id
-- from public.jobs j
-- where ju.job_id is null
--   and j.name = coalesce(nullif(trim(ju.job_name), ''), 'Unspecified job');
