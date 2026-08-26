import { z } from "zod";
import { generateStructuredContent } from "@/lib/anthropic/content-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import {
  fetchJobForWorker,
  markJobProcessing,
  recordJobCompletion,
  recordJobFailure,
  recordJobRetry
} from "@/lib/jobs/repository";
import { getServerEnv } from "@/lib/env";
import {
  getBackoffDelaySeconds,
  sanitizeError,
  shouldRetryAttempt
} from "@/lib/jobs/retry";
import { createJobRequestSchema } from "@/lib/schemas/content";

const eventDataSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  requestedAt: z.string().datetime(),
  manualRetry: z.boolean().optional()
});

export const generateContentJob = inngest.createFunction(
  {
    id: "generate-content-job",
    name: "Generate content job",
    retries: 0
  },
  {
    event: "content.generate.requested"
  },
  async ({ event, step }) => {
    const eventData = eventDataSchema.parse(event.data as unknown);
    const supabase = createSupabaseAdminClient();

    const initialJob = await step.run("load-job", async () => {
      return fetchJobForWorker(supabase, eventData.jobId);
    });

    if (!initialJob || initialJob.user_id !== eventData.userId) {
      return {
        status: "ignored",
        reason: "job-not-found"
      };
    }

    const input = createJobRequestSchema.parse({
      topic: initialJob.topic,
      audience: initialJob.audience,
      tone: initialJob.tone,
      platform: initialJob.platform
    });

    if (initialJob.status !== "queued" && initialJob.status !== "retrying") {
      return {
        status: "ignored",
        reason: "job-not-claimable",
        jobStatus: initialJob.status
      };
    }

    let currentJob = initialJob;
    const maxAttempts = currentJob.max_attempts;
    const model = getServerEnv().anthropicModel;

    for (
      let attempt = currentJob.attempts + 1;
      attempt <= maxAttempts;
      attempt += 1
    ) {
      const attemptLabel = String(attempt);

      const claimedJob = await step.run(`mark-processing-${attemptLabel}`, async () => {
        return markJobProcessing(supabase, currentJob, attempt, model);
      });

      if (!claimedJob) {
        return {
          status: "ignored",
          reason: "job-already-claimed",
          jobId: currentJob.id,
          attempt
        };
      }

      currentJob = claimedJob;

      try {
        const result = await step.run(`call-anthropic-${attemptLabel}`, async () => {
          return generateStructuredContent(input);
        });

        await step.run(`record-completion-${attemptLabel}`, async () => {
          return recordJobCompletion(supabase, currentJob, result);
        });

        return {
          status: "completed",
          jobId: currentJob.id,
          attempt
        };
      } catch (error) {
        const errorMessage = sanitizeError(error);

        if (shouldRetryAttempt(attempt, maxAttempts)) {
          const delaySeconds = getBackoffDelaySeconds(attempt);
          const delayLabel = String(delaySeconds);

          currentJob = await step.run(`record-retry-${attemptLabel}`, async () => {
            return recordJobRetry(
              supabase,
              currentJob,
              attempt,
              errorMessage,
              delaySeconds
            );
          });

          await step.sleep(`backoff-${attemptLabel}`, `${delayLabel}s`);
          continue;
        }

        await step.run(`record-failure-${attemptLabel}`, async () => {
          return recordJobFailure(supabase, currentJob, attempt, errorMessage);
        });

        return {
          status: "failed",
          jobId: currentJob.id,
          attempt
        };
      }
    }

    return {
      status: "failed",
      jobId: currentJob.id,
      reason: "max-attempts-exhausted"
    };
  }
);
