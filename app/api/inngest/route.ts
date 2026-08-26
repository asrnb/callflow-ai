import { serve } from "inngest/next";
import { generateContentJob } from "@/lib/inngest/functions/generate-content";
import { inngest } from "@/lib/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateContentJob]
});
