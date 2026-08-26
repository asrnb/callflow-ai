import type { Tables } from "@/types/database";

export type ContentJob = Tables<"content_jobs">;
export type GeneratedContentRow = Tables<"generated_contents">;
export type JobExecutionEvent = Tables<"job_execution_events">;

export type JobWithRelations = ContentJob & {
  generated_contents: GeneratedContentRow[];
  job_execution_events: JobExecutionEvent[];
};

export type ContentGenerateRequestedEvent = {
  name: "content.generate.requested";
  data: {
    jobId: string;
    userId: string;
    requestedAt: string;
    manualRetry?: boolean;
  };
};
