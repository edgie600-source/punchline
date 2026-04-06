-- Run this in the Supabase SQL editor (or via migration) before using the app.

create table if not exists public.job_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  from_number text not null default '',
  job_name text,
  work_completed text,
  blockers text,
  materials_needed text,
  hours_worked numeric,
  raw_message text
);

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
