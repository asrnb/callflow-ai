import type { AuthenticatedUser } from "@/lib/auth/session";
import type { CreateJobRequest } from "@/lib/schemas/content";
import type { JobWithRelations } from "@/lib/jobs/types";
import type { Tables } from "@/types/database";

type MockStore = {
  jobs: JobWithRelations[];
};

const mockUser: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@contentflow.ai"
};

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __contentflowMockStore?: MockStore;
  };

  globalStore.__contentflowMockStore ??= {
    jobs: []
  };

  return globalStore.__contentflowMockStore;
}

function nowIso() {
  return new Date().toISOString();
}

function createEvent(
  jobId: string,
  eventType: string,
  message: string,
  metadata: Tables<"job_execution_events">["metadata"] = {}
): Tables<"job_execution_events"> {
  return {
    id: crypto.randomUUID(),
    job_id: jobId,
    user_id: mockUser.id,
    event_type: eventType,
    message,
    metadata,
    created_at: nowIso()
  };
}

function completeMockJob(job: JobWithRelations) {
  if (job.status === "completed") {
    return;
  }

  const startedAt = nowIso();
  job.status = "processing";
  job.attempts = 1;
  job.model = "mock-claude";
  job.started_at = startedAt;
  job.updated_at = startedAt;
  job.job_execution_events.push(
    createEvent(job.id, "processing", "Attempt 1 started.", {
      attempt: 1,
      model: "mock-claude"
    })
  );

  const completedAt = nowIso();
  job.status = "completed";
  job.completed_at = completedAt;
  job.duration_ms = Math.max(1, new Date(completedAt).getTime() - new Date(startedAt).getTime());
  job.updated_at = completedAt;
  job.generated_contents = [
    {
      id: crypto.randomUUID(),
      job_id: job.id,
      user_id: mockUser.id,
      hook: `What if ${job.topic} became your next unfair content advantage?`,
      body: `For ${job.audience}, ${job.topic} is more than a talking point. It is a chance to explain the problem clearly, show a useful path forward, and make the next step feel obvious. A ${job.tone} ${job.platform} post should lead with tension, earn attention with practical detail, and close with a specific action.`,
      alternative_hooks: [
        `Most ${job.audience} are missing this angle on ${job.topic}.`,
        `${job.topic} is changing faster than your content calendar thinks.`
      ],
      key_points: [
        "Lead with the audience pain before the product idea.",
        "Use concrete examples instead of broad claims.",
        "End with one specific action."
      ],
      cta: "Turn this into your next published post.",
      raw_response: {
        source: "e2e-mock"
      },
      created_at: completedAt
    }
  ];
  job.job_execution_events.push(
    createEvent(job.id, "completed", "Structured content generated and persisted.", {
      model: "mock-claude",
      durationMs: job.duration_ms
    })
  );
}

function advanceMockJobs() {
  const now = Date.now();

  getStore().jobs.forEach((job) => {
    const ageMs = now - new Date(job.queued_at).getTime();

    if ((job.status === "queued" || job.status === "retrying") && ageMs >= 120) {
      completeMockJob(job);
    }
  });
}

export function getMockUser() {
  return mockUser;
}

export function listMockJobs() {
  advanceMockJobs();
  return [...getStore().jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMockJob(jobId: string) {
  advanceMockJobs();
  return getStore().jobs.find((job) => job.id === jobId) ?? null;
}

export function createMockJob(input: CreateJobRequest) {
  const timestamp = nowIso();
  const jobId = crypto.randomUUID();
  const job: JobWithRelations = {
    id: jobId,
    user_id: mockUser.id,
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
    queued_at: timestamp,
    started_at: null,
    completed_at: null,
    failed_at: null,
    duration_ms: null,
    created_at: timestamp,
    updated_at: timestamp,
    generated_contents: [],
    job_execution_events: [
      createEvent(jobId, "queued", "Job queued from the dashboard.", {
        source: "e2e"
      })
    ]
  };

  getStore().jobs.unshift(job);
  return job;
}

export function retryMockJob(jobId: string) {
  const job = getMockJob(jobId);

  if (!job) {
    return null;
  }

  if (job.status !== "failed") {
    throw new Error("Only failed jobs can be retried.");
  }

  const timestamp = nowIso();
  job.status = "queued";
  job.attempts = 0;
  job.error_message = null;
  job.last_error_at = null;
  job.queued_at = timestamp;
  job.started_at = null;
  job.failed_at = null;
  job.duration_ms = null;
  job.updated_at = timestamp;
  job.job_execution_events.push(
    createEvent(jobId, "queued", "Failed job was manually queued for retry.", {
      manualRetry: true
    })
  );

  return job;
}

export function scheduleMockCompletion(jobId: string) {
  const timer = setTimeout(() => {
    const job = getMockJob(jobId);

    if (!job) {
      return;
    }

    completeMockJob(job);
  }, 120);

  timer.unref();
}
