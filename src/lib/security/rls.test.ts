import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260826000000_contentflow_schema.sql"),
  "utf8"
);

describe("Supabase RLS migration", () => {
  it("enables RLS on all user-owned tables", () => {
    expect(migration).toContain("alter table public.content_jobs enable row level security;");
    expect(migration).toContain("alter table public.generated_contents enable row level security;");
    expect(migration).toContain("alter table public.job_execution_events enable row level security;");
  });

  it("keeps authenticated clients read-only for job data", () => {
    expect(migration).toContain("grant select on public.content_jobs to authenticated;");
    expect(migration).toContain("grant select on public.generated_contents to authenticated;");
    expect(migration).toContain("grant select on public.job_execution_events to authenticated;");
    expect(migration).not.toContain("for update");
  });

  it("prevents duplicate generated content rows per job", () => {
    expect(migration).toContain("create unique index if not exists generated_contents_job_unique_idx");
  });
});
