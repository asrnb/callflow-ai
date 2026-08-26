# ContentFlow AI Implementation Plan

## Product Scope

ContentFlow AI is a portfolio-grade SaaS MVP for authenticated users to submit AI content generation jobs and observe asynchronous execution from queue to result. The app demonstrates full-stack TypeScript/Next.js engineering, PostgreSQL design, Supabase Auth/RLS, structured Anthropic output, durable background processing with Inngest, and production-minded testing/deployment.

The MVP intentionally avoids billing, teams, usage quotas, admin dashboards, document collaboration, and complex workflow builders.

## Architecture

- Next.js App Router application with strict TypeScript.
- Supabase Auth for user sessions, using SSR-compatible clients.
- Supabase PostgreSQL as the source of truth.
- Row Level Security on all user-owned data.
- `/api/jobs` validates input, inserts a queued job, emits an Inngest event, and returns immediately with the job ID.
- Inngest background function handles AI execution, retries, status transitions, and event persistence.
- Anthropic Messages API is called only from the background function.
- Zod validates request payloads and AI structured output before persistence.
- Tailwind and shadcn/ui-style components power the dashboard UI.

## Database Schema

### `content_jobs`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `topic text not null`
- `audience text not null`
- `tone text not null`
- `platform text not null`
- `status content_job_status not null default 'queued'`
- `attempts integer not null default 0`
- `max_attempts integer not null default 3`
- `model text`
- `error_message text`
- `last_error_at timestamptz`
- `queued_at timestamptz not null default now()`
- `started_at timestamptz`
- `completed_at timestamptz`
- `failed_at timestamptz`
- `duration_ms integer`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `generated_contents`

- `id uuid primary key default gen_random_uuid()`
- `job_id uuid not null references content_jobs(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `hook text not null`
- `body text not null`
- `alternative_hooks text[] not null`
- `key_points text[] not null`
- `cta text not null`
- `raw_response jsonb not null`
- `created_at timestamptz not null default now()`

### `job_execution_events`

- `id uuid primary key default gen_random_uuid()`
- `job_id uuid not null references content_jobs(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `event_type text not null`
- `message text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### Status Enum

`content_job_status`: `queued`, `processing`, `retrying`, `completed`, `failed`

## Job Lifecycle

1. API receives a valid authenticated request.
2. API inserts `content_jobs.status = queued`.
3. API inserts a `queued` execution event.
4. API emits `content.generate.requested` to Inngest.
5. Worker conditionally claims the job and sets `processing`.
6. Duplicate or stale queue events exit before any Anthropic call.
7. Worker calls Anthropic and validates structured output with Zod.
8. On success, worker persists generated content, inserts events, and sets `completed`.
9. On failure before max attempts, worker records the error, sets `retrying`, inserts an event, sleeps with exponential backoff, then retries.
10. On terminal failure, worker sets `failed` and persists error details.
11. A failed job can be retried by an authenticated user action, which resets it to `queued` and emits a new event.

## Security Model

- Supabase Auth establishes user identity.
- RLS is enabled on all user-owned tables.
- Authenticated clients receive read-only grants, and RLS restricts reads to rows where `user_id = auth.uid()`.
- Job creation, retry, execution events, generated content writes, and status transitions happen through trusted route handlers or workers after authentication.
- Server-side routes and workers use the Supabase service role key only inside trusted server code.
- Browser clients never receive service role credentials or Anthropic credentials.
- Route handlers verify authenticated users before reading or mutating jobs.
- Job retry endpoint verifies ownership before enqueueing.

## Structured AI Output

The worker requests an Anthropic tool call named `create_content_generation` with a JSON schema containing:

- `hook`
- `body`
- `alternative_hooks`
- `key_points`
- `cta`

The returned tool input is parsed through the shared Zod schema before inserting into `generated_contents`.

## Retry Strategy

- Maximum attempts: 3.
- Backoff: `2 ** (attempt - 1) * 30s`, capped at 5 minutes.
- Each attempt increments `content_jobs.attempts`.
- Every status transition and error is recorded in `job_execution_events`.
- Transient and validation errors are visible in the observability view without exposing secrets.
- Duplicate or stale background events are ignored after a conditional database claim.

## UI

- Auth pages for sign in and sign up.
- Dashboard with new generation form, active jobs, history, status indicators, content viewer, retry action, copy action, and execution summary.
- Job details page with timestamps, duration, model, attempts, errors, and execution events.
- Loading, empty, error, and failure states.

## Implementation Phases

1. Scaffold strict Next.js, Tailwind, shadcn-style component foundation, Vitest, and Playwright.
2. Add shared domain schemas, environment validation, Supabase clients, and SQL migrations with RLS.
3. Implement authenticated job API, retry API, and Inngest background worker.
4. Build authenticated dashboard and job details UI.
5. Add unit/integration tests for schemas, API behavior, retry logic, and worker helpers.
6. Add Playwright happy-path test with mocked network dependencies.
7. Write `.env.example` and production README.
8. Run typecheck, lint, unit tests, and Playwright where feasible.

## Acceptance Criteria

- `/api/jobs` never calls Anthropic synchronously.
- `/api/jobs` returns a job ID immediately after persisting and enqueueing.
- Jobs can move through `queued -> processing -> completed`.
- Failed processing can move through `processing -> retrying -> failed`.
- AI output is validated with Zod before persistence.
- Retry attempts, errors, timestamps, and events are persisted.
- RLS prevents cross-user access to jobs, generated content, and execution events.
- Authenticated Supabase clients are read-only for job tables; writes are owned by server routes and workers.
- Duplicate queue delivery does not create duplicate Anthropic calls or generated content rows.
- Dashboard contains the requested job, content, retry, copy, and observability features.
- Tests cover meaningful business logic and at least one happy-path browser flow.
- README explains architecture, async processing, database design, RLS/security, structured output, retries, tests, deployment, and tradeoffs.
- `.env.example` documents required variables without credentials.
