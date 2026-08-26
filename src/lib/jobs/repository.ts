import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateJobRequest, GeneratedContent } from "@/lib/schemas/content";
import { getDurationMs } from "@/lib/jobs/retry";
import type { ContentJob, JobWithRelations } from "@/lib/jobs/types";
import type { Database, Json } from "@/types/database";

export type JobRepositoryClient = SupabaseClient<Database>;

export class JobRepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "JobRepositoryError";
  }
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function assertSingle<T>(data: T | null, error: unknown, message: string): T {
  if (error || !data) {
    throw new JobRepositoryError(message, error);
  }

  return data;
}

function assertNoError(error: unknown, message: string) {
  if (error) {
    throw new JobRepositoryError(message, error);
  }
}

export async function createQueuedJob(
  supabase: JobRepositoryClient,
  userId: string,
  input: CreateJobRequest
) {
  const { data, error } = await supabase
    .from("content_jobs")
    .insert({
      user_id: userId,
      topic: input.topic,
      audience: input.audience,
      tone: input.tone,
      platform: input.platform,
      status: "queued",
      max_attempts: 3
    })
    .select()
    .single();

  return assertSingle(data, error, "Unable to create content generation job.");
}

export async function fetchJobsForUser(supabase: JobRepositoryClient, userId: string) {
  const { data, error } = await supabase
    .from("content_jobs")
    .select("*, generated_contents(*), job_execution_events(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("created_at", {
      referencedTable: "job_execution_events",
      ascending: true
    })
    .overrideTypes<JobWithRelations[], { merge: false }>();

  if (error) {
    throw new JobRepositoryError("Unable to fetch jobs.", error);
  }

  return data;
}

export async function fetchJobForUser(
  supabase: JobRepositoryClient,
  userId: string,
  jobId: string
) {
  const { data, error } = await supabase
    .from("content_jobs")
    .select("*, generated_contents(*), job_execution_events(*)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .order("created_at", {
      referencedTable: "job_execution_events",
      ascending: true
    })
    .maybeSingle()
    .overrideTypes<JobWithRelations | null, { merge: false }>();

  if (error) {
    throw new JobRepositoryError("Unable to fetch job details.", error);
  }

  return data;
}

export async function fetchJobForWorker(supabase: JobRepositoryClient, jobId: string) {
  const { data, error } = await supabase
    .from("content_jobs")
    .select()
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new JobRepositoryError("Unable to load queued job.", error);
  }

  return data;
}

export async function addExecutionEvent(
  supabase: JobRepositoryClient,
  event: {
    jobId: string;
    userId: string;
    eventType: string;
    message: string;
    metadata?: Json;
  }
) {
  const { error } = await supabase.from("job_execution_events").insert({
    job_id: event.jobId,
    user_id: event.userId,
    event_type: event.eventType,
    message: event.message,
    metadata: event.metadata ?? {}
  });

  assertNoError(error, "Unable to write job execution event.");
}

export async function markJobProcessing(
  supabase: JobRepositoryClient,
  job: ContentJob,
  attempt: number,
  model: string
) {
  const startedAt = job.started_at ?? new Date().toISOString();
  const previousAttempts = Math.max(0, attempt - 1);

  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "processing",
      attempts: attempt,
      started_at: startedAt,
      model,
      error_message: null,
      last_error_at: null,
      failed_at: null
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .eq("attempts", previousAttempts)
    .in("status", ["queued", "retrying"])
    .select()
    .maybeSingle();

  if (error) {
    throw new JobRepositoryError("Unable to mark job as processing.", error);
  }

  if (!data) {
    return null;
  }

  const updatedJob = data;

  await addExecutionEvent(supabase, {
    jobId: job.id,
    userId: job.user_id,
    eventType: "processing",
    message: `Attempt ${String(attempt)} started.`,
    metadata: {
      attempt,
      model
    }
  });

  return updatedJob;
}

export async function recordJobRetry(
  supabase: JobRepositoryClient,
  job: ContentJob,
  attempt: number,
  errorMessage: string,
  delaySeconds: number
) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "retrying",
      attempts: attempt,
      error_message: errorMessage,
      last_error_at: now
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .select()
    .single();

  const updatedJob = assertSingle(data, error, "Unable to record retry state.");

  await addExecutionEvent(supabase, {
    jobId: job.id,
    userId: job.user_id,
    eventType: "retrying",
    message: `Attempt ${String(attempt)} failed. Retrying in ${String(delaySeconds)} seconds.`,
    metadata: {
      attempt,
      delaySeconds,
      error: errorMessage
    }
  });

  return updatedJob;
}

export async function recordJobFailure(
  supabase: JobRepositoryClient,
  job: ContentJob,
  attempt: number,
  errorMessage: string
) {
  const failedAt = new Date().toISOString();
  const durationMs = job.started_at ? getDurationMs(job.started_at, failedAt) : null;

  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "failed",
      attempts: attempt,
      error_message: errorMessage,
      last_error_at: failedAt,
      failed_at: failedAt,
      duration_ms: durationMs
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .select()
    .single();

  const updatedJob = assertSingle(data, error, "Unable to record failure state.");

  await addExecutionEvent(supabase, {
    jobId: job.id,
    userId: job.user_id,
    eventType: "failed",
    message: `Job failed after ${String(attempt)} attempts.`,
    metadata: {
      attempt,
      error: errorMessage
    }
  });

  return updatedJob;
}

export async function recordJobCompletion(
  supabase: JobRepositoryClient,
  job: ContentJob,
  result: {
    content: GeneratedContent;
    rawResponse: unknown;
    model: string;
  }
) {
  const completedAt = new Date().toISOString();
  const durationMs = job.started_at ? getDurationMs(job.started_at, completedAt) : null;

  const { error: insertError } = await supabase.from("generated_contents").upsert(
    {
      job_id: job.id,
      user_id: job.user_id,
      hook: result.content.hook,
      body: result.content.body,
      alternative_hooks: result.content.alternative_hooks,
      key_points: result.content.key_points,
      cta: result.content.cta,
      raw_response: toJson(result.rawResponse)
    },
    {
      onConflict: "job_id"
    }
  );

  assertNoError(insertError, "Unable to persist generated content.");

  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "completed",
      model: result.model,
      completed_at: completedAt,
      duration_ms: durationMs,
      error_message: null,
      last_error_at: null
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .select()
    .single();

  const updatedJob = assertSingle(data, error, "Unable to mark job as completed.");

  await addExecutionEvent(supabase, {
    jobId: job.id,
    userId: job.user_id,
    eventType: "completed",
    message: "Structured content generated and persisted.",
    metadata: {
      model: result.model,
      durationMs
    }
  });

  return updatedJob;
}

export async function resetFailedJobForRetry(
  supabase: JobRepositoryClient,
  userId: string,
  jobId: string
) {
  const existing = await fetchJobForUser(supabase, userId, jobId);

  if (!existing) {
    return null;
  }

  if (existing.status !== "failed") {
    throw new JobRepositoryError("Only failed jobs can be retried.");
  }

  const queuedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "queued",
      attempts: 0,
      error_message: null,
      last_error_at: null,
      queued_at: queuedAt,
      started_at: null,
      completed_at: null,
      failed_at: null,
      duration_ms: null
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .select()
    .single();

  const updatedJob = assertSingle(data, error, "Unable to retry failed job.");

  await addExecutionEvent(supabase, {
    jobId,
    userId,
    eventType: "queued",
    message: "Failed job was manually queued for retry.",
    metadata: {
      manualRetry: true
    }
  });

  return updatedJob;
}
