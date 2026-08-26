import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { JobDetailsClient } from "@/components/dashboard/job-details-client";
import { getAuthContext } from "@/lib/auth/session";
import { getMockJob } from "@/lib/jobs/mock-store";
import { fetchJobForUser } from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  jobId: z.string().uuid()
});

type JobDetailsPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login?next=/dashboard");
  }

  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const job = auth.isMock
    ? getMockJob(parsedParams.data.jobId)
    : await fetchJobForUser(auth.supabase, auth.user.id, parsedParams.data.jobId);

  if (!job) {
    notFound();
  }

  return <JobDetailsClient job={job} />;
}
