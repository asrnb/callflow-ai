import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/session";
import { apiError } from "@/lib/http/api-response";
import { getMockJob } from "@/lib/jobs/mock-store";
import { fetchJobForUser } from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  jobId: z.string().uuid()
});

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getAuthContext();

  if (!auth) {
    return apiError("Authentication required.", 401);
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return apiError("Invalid job ID.", 400);
  }

  if (auth.isMock) {
    const job = getMockJob(parsedParams.data.jobId);

    if (!job) {
      return apiError("Job not found.", 404);
    }

    return NextResponse.json({ job });
  }

  const job = await fetchJobForUser(auth.supabase, auth.user.id, parsedParams.data.jobId);

  if (!job) {
    return apiError("Job not found.", 404);
  }

  return NextResponse.json({ job });
}
