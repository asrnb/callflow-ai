import { isE2EMockEnabled } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { scheduleMockCompletion } from "@/lib/jobs/mock-store";
import type { ContentGenerateRequestedEvent } from "@/lib/jobs/types";

export async function enqueueContentGeneration(
  data: ContentGenerateRequestedEvent["data"]
) {
  if (isE2EMockEnabled()) {
    scheduleMockCompletion(data.jobId);
    return {
      ids: [`mock-${data.jobId}`]
    };
  }

  return inngest.send({
    name: "content.generate.requested",
    data
  });
}
