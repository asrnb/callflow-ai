import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/session";
import { apiError } from "@/lib/http/api-response";
import { retryMockJob } from "@/lib/jobs/mock-store";
import { resetFailedJobForRetry } from "@/lib/jobs/repository";
import { enqueueContentGeneration } from "@/lib/jobs/queue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  jobId: z.string().uuid()
});

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await getAuthContext();

  if (!auth) {
    return apiError("Authentication required.", 401);
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return apiError("Invalid job ID.", 400);
  }

  if (auth.isMock) {
    try {
      const job = retryMockJob(parsedParams.data.jobId);

      if (!job) {
        return apiError("Job not found.", 404);
      }

      await enqueueContentGeneration({
        jobId: job.id,
        userId: auth.user.id,
        requestedAt: new Date().toISOString(),
        manualRetry: true
      });

      return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Unable to retry job.", 409);
    }
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    const job = await resetFailedJobForRetry(
      adminSupabase,
      auth.user.id,
      parsedParams.data.jobId
    );

    if (!job) {
      return apiError("Job not found.", 404);
    }

    await enqueueContentGeneration({
      jobId: job.id,
      userId: auth.user.id,
      requestedAt: new Date().toISOString(),
      manualRetry: true
    });

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to retry job.", 409);
  }
}
