"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedContentViewer } from "@/components/dashboard/generated-content-viewer";
import { NewGenerationForm } from "@/components/dashboard/new-generation-form";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ExecutionTimeline } from "@/components/dashboard/execution-timeline";
import { isActiveStatus } from "@/lib/schemas/content";
import type { JobWithRelations } from "@/lib/jobs/types";
import { cn } from "@/lib/utils";

type DashboardClientProps = {
  initialJobs: JobWithRelations[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "Pending";
  }

  if (durationMs < 1000) {
    return `${String(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function firstJobOrNull(jobs: JobWithRelations[]) {
  return jobs.length > 0 ? jobs[0] : null;
}

function firstGeneratedContent(job: JobWithRelations | null) {
  if (!job || job.generated_contents.length === 0) {
    return null;
  }

  return job.generated_contents[0];
}

function JobRow({
  job,
  selected,
  onSelect,
  onRetry
}: {
  job: JobWithRelations;
  selected: boolean;
  onSelect: (job: JobWithRelations) => void;
  onRetry: (job: JobWithRelations) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4 transition hover:border-primary/40",
        selected ? "border-primary shadow-panel" : "border-border"
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => {
          onSelect(job);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-6">{job.topic}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.platform} - {job.tone} - {job.audience}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span>Attempts {job.attempts}/{job.max_attempts}</span>
          <span>{formatDuration(job.duration_ms)}</span>
          <span>{formatDate(job.created_at)}</span>
        </div>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/jobs/${job.id}`}>
            <ArrowUpRight className="size-4" aria-hidden="true" />
            Details
          </Link>
        </Button>
        {job.status === "failed" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              onRetry(job);
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function DashboardClient({ initialJobs }: DashboardClientProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? firstJobOrNull(jobs);
  const activeJobs = useMemo(() => jobs.filter((job) => isActiveStatus(job.status)), [jobs]);
  const historyJobs = useMemo(() => jobs.filter((job) => !isActiveStatus(job.status)), [jobs]);

  async function refreshJobs() {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      const payload = (await response.json()) as { jobs?: JobWithRelations[]; error?: string };

      if (!response.ok || !payload.jobs) {
        throw new Error(payload.error ?? "Unable to refresh jobs.");
      }

      setJobs(payload.jobs);
      const firstJobId = payload.jobs.length > 0 ? payload.jobs[0].id : null;
      setSelectedJobId((current) => current ?? firstJobId);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh jobs.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function retryJob(job: JobWithRelations) {
    setError(null);
    const response = await fetch(`/api/jobs/${job.id}/retry`, {
      method: "POST"
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to retry job.");
      return;
    }

    await refreshJobs();
  }

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (activeJobs.length === 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeJobs.length]);

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-6">
        <NewGenerationForm />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Active jobs</h2>
              <p className="text-sm text-muted-foreground">Queued, processing, and retrying</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                void refreshJobs();
              }}
              disabled={isRefreshing}
              aria-label="Refresh jobs"
            >
              <RefreshCw className={cn("size-4", isRefreshing ? "animate-spin" : undefined)} aria-hidden="true" />
            </Button>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          {activeJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              No active jobs. Queue a generation to watch the lifecycle.
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  selected={selectedJob ? selectedJob.id === job.id : false}
                  onSelect={(selected) => {
                    setSelectedJobId(selected.id);
                  }}
                  onRetry={(retryTarget) => {
                    void retryJob(retryTarget);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Generation history</h2>
            <p className="text-sm text-muted-foreground">Completed and failed jobs</p>
          </div>

          {historyJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              Finished jobs will appear here after processing.
            </div>
          ) : (
            <div className="space-y-3">
              {historyJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  selected={selectedJob ? selectedJob.id === job.id : false}
                  onSelect={(selected) => {
                    setSelectedJobId(selected.id);
                  }}
                  onRetry={(retryTarget) => {
                    void retryJob(retryTarget);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        {selectedJob ? (
          <section className="surface-panel rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected job</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{selectedJob.topic}</h2>
              </div>
              <StatusBadge status={selectedJob.status} />
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Attempts</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {selectedJob.attempts}/{selectedJob.max_attempts}
                </dd>
              </div>
              <div className="rounded-md bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="mt-1 text-sm font-semibold">{formatDuration(selectedJob.duration_ms)}</dd>
              </div>
              <div className="rounded-md bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Model</dt>
                <dd className="mt-1 text-sm font-semibold">{selectedJob.model ?? "Pending"}</dd>
              </div>
              <div className="rounded-md bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Queued</dt>
                <dd className="mt-1 text-sm font-semibold">{formatDate(selectedJob.queued_at)}</dd>
              </div>
            </dl>

            {selectedJob.error_message ? (
              <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                {selectedJob.error_message}
              </div>
            ) : null}
          </section>
        ) : null}

        <GeneratedContentViewer content={firstGeneratedContent(selectedJob)} />

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Execution details</h2>
              <p className="text-sm text-muted-foreground">Status transitions and worker metadata</p>
            </div>
            {selectedJob ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/jobs/${selectedJob.id}`}>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  Open
                </Link>
              </Button>
            ) : null}
          </div>
          <ExecutionTimeline events={selectedJob ? selectedJob.job_execution_events : []} />
        </section>
      </div>
    </div>
  );
}
