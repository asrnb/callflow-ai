import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getAuthContext } from "@/lib/auth/session";
import { listMockJobs } from "@/lib/jobs/mock-store";
import { fetchJobsForUser } from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard"
};

export default async function DashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login?next=/dashboard");
  }

  const jobs = auth.isMock ? listMockJobs() : await fetchJobsForUser(auth.supabase, auth.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Content generation jobs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Queue content, watch background execution, and inspect structured AI output.
        </p>
      </div>
      <DashboardClient initialJobs={jobs} />
    </div>
  );
}
