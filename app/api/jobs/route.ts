import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { apiError, formatZodError, readJsonBody } from "@/lib/http/api-response";
import { createMockJob, listMockJobs } from "@/lib/jobs/mock-store";
import {
  addExecutionEvent,
  createQueuedJob,
  fetchJobsForUser
} from "@/lib/jobs/repository";
import { enqueueContentGeneration } from "@/lib/jobs/queue";
import { createJobRequestSchema } from "@/lib/schemas/content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthContext();

  if (!auth) {
    return apiError("Authentication required.", 401);
  }

  if (auth.isMock) {
    return NextResponse.json({ jobs: listMockJobs() });
  }

  const jobs = await fetchJobsForUser(auth.supabase, auth.user.id);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();

  if (!auth) {
    return apiError("Authentication required.", 401);
  }

  const parsed = createJobRequestSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return apiError("Invalid content generation request.", 400, formatZodError(parsed.error));
  }

  if (auth.isMock) {
    const job = createMockJob(parsed.data);
    await enqueueContentGeneration({
      jobId: job.id,
      userId: auth.user.id,
      requestedAt: new Date().toISOString()
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status
      },
      { status: 202 }
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const job = await createQueuedJob(adminSupabase, auth.user.id, parsed.data);

  await addExecutionEvent(adminSupabase, {
    jobId: job.id,
    userId: auth.user.id,
    eventType: "queued",
    message: "Job queued from the dashboard.",
    metadata: {
      source: "api"
    }
  });

  await enqueueContentGeneration({
    jobId: job.id,
    userId: auth.user.id,
    requestedAt: new Date().toISOString()
  });

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status
    },
    { status: 202 }
  );
}
