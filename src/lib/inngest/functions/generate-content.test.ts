import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentJob } from "@/lib/jobs/types";
import type { GeneratedContent } from "@/lib/schemas/content";

const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const fetchJobForWorkerMock = vi.hoisted(() => vi.fn());
const markJobProcessingMock = vi.hoisted(() => vi.fn());
const recordJobCompletionMock = vi.hoisted(() => vi.fn());
const recordJobFailureMock = vi.hoisted(() => vi.fn());
const recordJobRetryMock = vi.hoisted(() => vi.fn());
const generateStructuredContentMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

vi.mock("@/lib/jobs/repository", () => ({
  fetchJobForWorker: fetchJobForWorkerMock,
  markJobProcessing: markJobProcessingMock,
  recordJobCompletion: recordJobCompletionMock,
  recordJobFailure: recordJobFailureMock,
  recordJobRetry: recordJobRetryMock
}));

vi.mock("@/lib/anthropic/content-generator", () => ({
  generateStructuredContent: generateStructuredContentMock
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: vi.fn(
      (
        _config: unknown,
        _trigger: unknown,
        handler: (args: {
          event: { data: unknown };
          step: {
            run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
            sleep: (name: string, duration: string) => Promise<void>;
          };
        }) => Promise<unknown>
      ) => handler
    )
  }
}));

const userId = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000002";
const requestedAt = "2026-08-26T00:00:00.000Z";

function makeJob(overrides: Partial<ContentJob> = {}): ContentJob {
  return {
    id: jobId,
    user_id: userId,
    topic: "AI onboarding for customer success teams",
    audience: "B2B SaaS founders",
    tone: "professional",
    platform: "linkedin",
    status: "queued",
    attempts: 0,
    max_attempts: 3,
    model: null,
    error_message: null,
    last_error_at: null,
    queued_at: requestedAt,
    started_at: null,
    completed_at: null,
    failed_at: null,
    duration_ms: null,
    created_at: requestedAt,
    updated_at: requestedAt,
    ...overrides
  };
}

async function runWorker(data: { jobId?: string; userId?: string } = {}) {
  const { generateContentJob } = await import("./generate-content");
  const step = {
    run: vi.fn(<T>(_name: string, fn: () => Promise<T> | T) => Promise.resolve(fn())),
    sleep: vi.fn(() => Promise.resolve())
  };

  const handler = generateContentJob as unknown as (args: {
    event: {
      data: {
        jobId: string;
        userId: string;
        requestedAt: string;
      };
    };
    step: typeof step;
  }) => Promise<unknown>;

  const result = await handler({
    event: {
      data: {
        jobId,
        userId,
        requestedAt,
        ...data
      }
    },
    step
  });

  return { result, step };
}

describe("generateContentJob", () => {
  beforeEach(() => {
    createSupabaseAdminClientMock.mockReset();
    fetchJobForWorkerMock.mockReset();
    markJobProcessingMock.mockReset();
    recordJobCompletionMock.mockReset();
    recordJobFailureMock.mockReset();
    recordJobRetryMock.mockReset();
    generateStructuredContentMock.mockReset();
    createSupabaseAdminClientMock.mockReturnValue({ role: "service-role" });
  });

  it("ignores stale events for jobs that are no longer claimable", async () => {
    fetchJobForWorkerMock.mockResolvedValue(makeJob({ status: "completed" }));

    const { result } = await runWorker();

    expect(result).toMatchObject({
      status: "ignored",
      reason: "job-not-claimable",
      jobStatus: "completed"
    });
    expect(markJobProcessingMock).not.toHaveBeenCalled();
    expect(generateStructuredContentMock).not.toHaveBeenCalled();
  });

  it("exits without calling Anthropic when another worker already claimed the job", async () => {
    fetchJobForWorkerMock.mockResolvedValue(makeJob());
    markJobProcessingMock.mockResolvedValue(null);

    const { result } = await runWorker();

    expect(result).toMatchObject({
      status: "ignored",
      reason: "job-already-claimed",
      jobId,
      attempt: 1
    });
    expect(generateStructuredContentMock).not.toHaveBeenCalled();
    expect(recordJobCompletionMock).not.toHaveBeenCalled();
  });

  it("claims a queued job, validates generated content, and records completion", async () => {
    const processingJob = makeJob({
      status: "processing",
      attempts: 1,
      started_at: requestedAt,
      model: "claude-3-5-sonnet-latest"
    });
    const content: GeneratedContent = {
      hook: "Customer onboarding is where retention starts.",
      body: "A polished onboarding flow helps customer success teams turn product intent into measurable activation. Use AI to draft role-specific enablement, but keep human review in the loop before anything ships.",
      alternative_hooks: [
        "Retention starts before the first support ticket.",
        "Your onboarding flow is your first retention engine."
      ],
      key_points: [
        "Segment onboarding by role",
        "Use AI for first drafts",
        "Keep review and measurement human-led"
      ],
      cta: "Audit one onboarding email today."
    };

    fetchJobForWorkerMock.mockResolvedValue(makeJob());
    markJobProcessingMock.mockResolvedValue(processingJob);
    generateStructuredContentMock.mockResolvedValue({
      content,
      model: "claude-3-5-sonnet-latest",
      rawResponse: { id: "msg_1" }
    });
    recordJobCompletionMock.mockResolvedValue({
      ...processingJob,
      status: "completed"
    });

    const { result } = await runWorker();

    expect(markJobProcessingMock).toHaveBeenCalledWith(
      { role: "service-role" },
      expect.objectContaining({ id: jobId }),
      1,
      "claude-3-5-sonnet-latest"
    );
    expect(generateStructuredContentMock).toHaveBeenCalledWith({
      topic: "AI onboarding for customer success teams",
      audience: "B2B SaaS founders",
      tone: "professional",
      platform: "linkedin"
    });
    expect(recordJobCompletionMock).toHaveBeenCalledWith(
      { role: "service-role" },
      processingJob,
      expect.objectContaining({ content })
    );
    expect(result).toMatchObject({
      status: "completed",
      jobId,
      attempt: 1
    });
  });
});
