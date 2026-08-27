# ContentFlow AI

ContentFlow AI is a production-oriented SaaS for authenticated users to queue AI content generation jobs and observe the full asynchronous lifecycle from request to result.

The project is intentionally scoped as a polished portfolio application: it showcases full-stack TypeScript/Next.js engineering, Supabase PostgreSQL architecture, RLS security, background processing, structured LLM output validation, and meaningful automated tests without adding unnecessary product complexity.

## Stack

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS with shadcn/ui-style local primitives
- Supabase PostgreSQL
- Supabase Auth and SSR session handling
- Supabase Row Level Security
- Anthropic Messages API
- Inngest background jobs
- Zod validation
- Vitest
- Playwright
- Vercel-ready deployment shape

## Core Flow

Users submit jobs with:

- topic
- audience
- tone
- platform

`POST /api/jobs` performs only request validation, authentication, database persistence, event creation, and queue dispatch. It does not call Anthropic or any other AI provider.

The route returns `202 Accepted` with the job ID immediately after enqueueing:

```txt
queued -> processing -> completed
processing -> retrying -> failed
```

The background worker owns Anthropic calls, structured output validation, retry state, error persistence, and completion writes.

## Architecture

```txt
Next.js App Router
  app/api/jobs
    validates request with Zod
    inserts content_jobs row as queued
    writes queued execution event
    sends Inngest event

Inngest
  content.generate.requested
    loads job with service-role Supabase client
    conditionally claims queued/retrying jobs
    calls the configured AI provider
    validates structured tool output with Zod
    persists generated_contents
    writes execution events
    retries with exponential backoff when needed

Supabase PostgreSQL
  content_jobs
  generated_contents
  job_execution_events
  RLS policies isolate reads by auth.uid()
  authenticated clients are read-only for job tables
```

The UI is dashboard-first:

- New Generation form
- Active jobs
- Generation history
- Status indicators
- Generated content viewer
- Retry failed job action
- Copy content action
- Job execution details
- Dedicated observability page per job

## Database Design

The migration lives in:

```txt
supabase/migrations/20260826000000_contentflow_schema.sql
```

Tables:

- `content_jobs`: user-owned job request, status, attempts, model, timestamps, duration, and error state.
- `generated_contents`: validated Anthropic output for completed jobs, constrained to one row per job.
- `job_execution_events`: append-only observability timeline for queueing, processing, retrying, completion, and failure.

Indexes are included for common dashboard and detail queries:

- jobs by user/status/created time
- generated content by job
- execution events by job/created time

## RLS And Security

RLS is enabled for all user-owned tables. Read policies enforce:

```sql
auth.uid() = user_id
```

Authenticated Supabase clients receive only `select` grants for the job tables. Mutations are owned by trusted route handlers and workers after authentication, using the service-role client on the server side. This keeps browser code from directly changing status, attempts, generated content, or execution events.

Important boundaries:

- Browser code only receives Supabase public URL and anon key.
- Service role key is used only in trusted server/background code.
- Anthropic credentials are never exposed to the browser.
- Route handlers authenticate the current Supabase user before reads or server-owned writes.
- Retry verifies ownership and only allows failed jobs to be requeued.
- Worker job claims are conditional on `queued` or `retrying` state plus the expected attempt count, so duplicate queue delivery cannot create duplicate Anthropic calls.

## Structured AI Output

AI generation is called from the Inngest worker in:

```txt
src/lib/anthropic/content-generator.ts
```

In `CONTENTFLOW_AI_PROVIDER=anthropic` mode, the worker requests an Anthropic tool call named `create_content_generation` with JSON schema fields:

- `hook`
- `body`
- `alternative_hooks`
- `key_points`
- `cta`

The tool input is validated with `generatedContentSchema` before persistence. Invalid model output is treated as a processing error and enters the retry path.

For local development without an Anthropic key, set:

```env
CONTENTFLOW_AI_PROVIDER=mock
ANTHROPIC_API_KEY=
```

This keeps Supabase, Auth, PostgreSQL, Inngest, status transitions, retries, persistence, and observability real while replacing only the LLM response with deterministic Zod-valid structured content.

## Retry Strategy

Retries are implemented in the worker rather than hidden inside the HTTP request.

- Max attempts: 3
- Backoff: 30s, 60s, 120s, capped at 300s
- Each attempt is persisted on `content_jobs.attempts`
- Errors are stored on `content_jobs.error_message` and `last_error_at`
- Every transition writes a `job_execution_events` row
- Final failure sets `failed_at` and `duration_ms`
- Duplicate or stale queue events are ignored before calling Anthropic

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Apply the Supabase migration with your normal Supabase workflow, for example:

```bash
supabase db push
```

Run the app:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

If you do not have an Anthropic key yet, keep `CONTENTFLOW_AI_PROVIDER=mock` in `.env.local`. You can still connect real Supabase and run real background jobs; only the provider response is mocked.

## Inngest

The Inngest handler is exposed at:

```txt
/api/inngest
```

The job function is:

```txt
src/lib/inngest/functions/generate-content.ts
```

In local development, run the Inngest dev server against the app URL if you want to execute background jobs locally:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

## Testing

Unit and integration tests:

```bash
npm run test
```

Covered areas:

- request and AI output schemas
- retry/backoff helpers
- `/api/jobs` validation, queued persistence, event creation, and enqueue behavior
- Inngest worker idempotency and completion behavior
- migration-level RLS/security invariants

Playwright happy path:

```bash
npm run test:e2e
```

The Playwright config runs the app with `E2E_USE_MOCK_DATA=true`, so the test can verify the dashboard workflow without real Supabase or Anthropic credentials.

## Deployment

For Vercel:

1. Create a Supabase project.
2. Apply `supabase/migrations/20260826000000_contentflow_schema.sql`.
3. Create an Inngest app and connect the Vercel deployment.
4. Add all variables from `.env.example` to Vercel project settings.
5. Deploy the Next.js app.
6. Verify `/api/inngest` is reachable by Inngest.

Required production environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONTENTFLOW_AI_PROVIDER`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

Use `CONTENTFLOW_AI_PROVIDER=anthropic` for production. `CONTENTFLOW_AI_PROVIDER=mock` is for local development when an Anthropic key is unavailable.

Never commit real credentials.

## Architectural Decisions

- Inngest was chosen over synchronous route execution to showcase durable async processing on Vercel.
- Supabase RLS is the primary cross-user read isolation layer, with server-owned writes and route-level ownership checks as defense in depth.
- AI output is persisted only after Zod validation to keep the database contract stable.
- A mock AI provider supports local development without changing the async job architecture.
- Worker processing uses conditional database claims and a unique generated-content constraint to tolerate duplicate event delivery.
- Execution events are stored separately from the job row so observability grows without bloating the primary job record.
- The product keeps teams, billing, quotas, templates, and admin tooling out of scope to stay focused on the requested production architecture.
