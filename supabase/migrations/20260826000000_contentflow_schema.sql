create extension if not exists pgcrypto;

do $$
begin
  create type public.content_job_status as enum (
    'queued',
    'processing',
    'retrying',
    'completed',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.content_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 5 and 220),
  audience text not null check (char_length(audience) between 3 and 160),
  tone text not null check (char_length(tone) between 2 and 40),
  platform text not null check (char_length(platform) between 1 and 40),
  status public.content_job_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  model text,
  error_message text,
  last_error_at timestamptz,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_contents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.content_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hook text not null,
  body text not null,
  alternative_hooks text[] not null check (array_length(alternative_hooks, 1) between 2 and 5),
  key_points text[] not null check (array_length(key_points, 1) between 3 and 7),
  cta text not null,
  raw_response jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.job_execution_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.content_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_jobs_user_status_created_idx
  on public.content_jobs(user_id, status, created_at desc);

create index if not exists generated_contents_job_idx
  on public.generated_contents(job_id);

create unique index if not exists generated_contents_job_unique_idx
  on public.generated_contents(job_id);

create index if not exists job_execution_events_job_created_idx
  on public.job_execution_events(job_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_jobs_set_updated_at on public.content_jobs;
create trigger content_jobs_set_updated_at
  before update on public.content_jobs
  for each row
  execute function public.set_updated_at();

alter table public.content_jobs enable row level security;
alter table public.generated_contents enable row level security;
alter table public.job_execution_events enable row level security;

revoke all on public.content_jobs from anon, authenticated;
revoke all on public.generated_contents from anon, authenticated;
revoke all on public.job_execution_events from anon, authenticated;

grant select on public.content_jobs to authenticated;
grant select on public.generated_contents to authenticated;
grant select on public.job_execution_events to authenticated;

drop policy if exists "Users can read their jobs" on public.content_jobs;
create policy "Users can read their jobs"
  on public.content_jobs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their jobs" on public.content_jobs;
drop policy if exists "Users can update their jobs" on public.content_jobs;

drop policy if exists "Users can read their generated content" on public.generated_contents;
create policy "Users can read their generated content"
  on public.generated_contents
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their generated content" on public.generated_contents;
drop policy if exists "Users can create generated content for their jobs" on public.generated_contents;
create policy "Users can create generated content for their jobs"
  on public.generated_contents
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.content_jobs
      where content_jobs.id = generated_contents.job_id
        and content_jobs.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read their job events" on public.job_execution_events;
create policy "Users can read their job events"
  on public.job_execution_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their job events" on public.job_execution_events;
drop policy if exists "Users can create events for their jobs" on public.job_execution_events;
create policy "Users can create events for their jobs"
  on public.job_execution_events
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.content_jobs
      where content_jobs.id = job_execution_events.job_id
        and content_jobs.user_id = auth.uid()
    )
  );
