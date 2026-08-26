"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutionTimeline } from "@/components/dashboard/execution-timeline";
import { GeneratedContentViewer } from "@/components/dashboard/generated-content-viewer";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobWithRelations } from "@/lib/jobs/types";

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "Pending";
  }

  return durationMs < 1000 ? `${String(durationMs)} ms` : `${(durationMs / 1000).toFixed(1)} s`;
}

export function JobDetailsClient({ job }: { job: JobWithRelations }) {
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry() {
    setError(null);
    setIsRetrying(true);

    const response = await fetch(`/api/jobs/${job.id}/retry`, {
      method: "POST"
    });

    setIsRetrying(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to retry job.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </Button>
        {job.status === "failed" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void handleRetry();
            }}
            disabled={isRetrying}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry failed job
          </Button>
        ) : null}
      </div>

      <section className="surface-panel rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Job observability</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">{job.topic}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {job.platform} - {job.tone} - {job.audience}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {error ? (
          <div className="mt-5 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {job.error_message ? (
          <div className="mt-5 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {job.error_message}
          </div>
        ) : null}

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Queued</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(job.queued_at)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Started</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(job.started_at)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Completed</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(job.completed_at)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Failed</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(job.failed_at)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Duration</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDuration(job.duration_ms)}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Model</dt>
            <dd className="mt-1 text-sm font-semibold">{job.model ?? "Pending"}</dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Attempts</dt>
            <dd className="mt-1 text-sm font-semibold">
              {job.attempts}/{job.max_attempts}
            </dd>
          </div>
          <div className="rounded-md bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(job.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <GeneratedContentViewer content={job.generated_contents[0] ?? null} />

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold">Execution events</h2>
          <p className="text-sm text-muted-foreground">Worker lifecycle, retry metadata, and persisted errors</p>
        </div>
        <ExecutionTimeline events={job.job_execution_events} />
      </section>
    </div>
  );
}
