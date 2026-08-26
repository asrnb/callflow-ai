import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import type { ContentJob } from "@/lib/jobs/types";
import type { CreateJobRequest } from "@/lib/schemas/content";

const getAuthContextMock = vi.hoisted(() => vi.fn<() => Promise<AuthContext | null>>());
const createQueuedJobMock = vi.hoisted(() => vi.fn());
const addExecutionEventMock = vi.hoisted(() => vi.fn());
const fetchJobsForUserMock = vi.hoisted(() => vi.fn());
const enqueueContentGenerationMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: getAuthContextMock
}));

vi.mock("@/lib/jobs/repository", () => ({
  createQueuedJob: createQueuedJobMock,
  addExecutionEvent: addExecutionEventMock,
  fetchJobsForUser: fetchJobsForUserMock
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueContentGeneration: enqueueContentGenerationMock
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

vi.mock("@/lib/jobs/mock-store", () => ({
  createMockJob: vi.fn(),
  listMockJobs: vi.fn(() => [])
}));

describe("/api/jobs", () => {
  beforeEach(() => {
    getAuthContextMock.mockReset();
    createQueuedJobMock.mockReset();
    addExecutionEventMock.mockReset();
    fetchJobsForUserMock.mockReset();
    enqueueContentGenerationMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("persists a queued job, enqueues background work, and returns immediately", async () => {
    const { POST } = await import("../app/api/jobs/route");
    const input: CreateJobRequest = {
      topic: "AI onboarding for customer success teams",
      audience: "B2B SaaS founders",
      tone: "professional",
      platform: "linkedin"
    };
    const userId = "00000000-0000-4000-8000-000000000001";
    const fakeAuth = {
      isMock: false,
      user: {
        id: userId,
        email: "builder@contentflow.ai"
      },
      supabase: {}
    } as AuthContext;
    const adminSupabase = { role: "service-role" };
    const queuedJob: ContentJob = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: userId,
      topic: input.topic,
      audience: input.audience,
      tone: input.tone,
      platform: input.platform,
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      model: null,
      error_message: null,
      last_error_at: null,
      queued_at: "2026-08-26T00:00:00.000Z",
      started_at: null,
      completed_at: null,
      failed_at: null,
      duration_ms: null,
      created_at: "2026-08-26T00:00:00.000Z",
      updated_at: "2026-08-26T00:00:00.000Z"
    };

    getAuthContextMock.mockResolvedValue(fakeAuth);
    createSupabaseAdminClientMock.mockReturnValue(adminSupabase);
    createQueuedJobMock.mockResolvedValue(queuedJob);
    addExecutionEventMock.mockResolvedValue(undefined);
    enqueueContentGenerationMock.mockResolvedValue({ ids: ["evt_1"] });

    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      })
    );
    const payload = (await response.json()) as { jobId: string; status: string };

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      jobId: queuedJob.id,
      status: "queued"
    });
    expect(createQueuedJobMock).toHaveBeenCalledWith(adminSupabase, userId, input);
    expect(addExecutionEventMock).toHaveBeenCalledWith(
      adminSupabase,
      expect.objectContaining({
        jobId: queuedJob.id,
        userId,
        eventType: "queued"
      })
    );
    expect(enqueueContentGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: queuedJob.id,
        userId
      })
    );
  });

  it("rejects invalid input before persisting", async () => {
    const { POST } = await import("../app/api/jobs/route");
    getAuthContextMock.mockResolvedValue({
      isMock: false,
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "builder@contentflow.ai"
      },
      supabase: {}
    } as AuthContext);

    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: "AI",
          audience: "x",
          tone: "nope",
          platform: "linkedin"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(createQueuedJobMock).not.toHaveBeenCalled();
    expect(enqueueContentGenerationMock).not.toHaveBeenCalled();
  });
});
