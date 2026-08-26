import { z } from "zod";

export const jobStatuses = ["queued", "processing", "retrying", "completed", "failed"] as const;

export const jobStatusSchema = z.enum(jobStatuses);

export const contentToneSchema = z.enum([
  "professional",
  "friendly",
  "bold",
  "educational",
  "witty"
]);

export const contentPlatformSchema = z.enum([
  "linkedin",
  "x",
  "instagram",
  "newsletter",
  "blog"
]);

export const createJobRequestSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, "Topic must be at least 5 characters.")
    .max(220, "Topic must be 220 characters or fewer."),
  audience: z
    .string()
    .trim()
    .min(3, "Audience must be at least 3 characters.")
    .max(160, "Audience must be 160 characters or fewer."),
  tone: contentToneSchema,
  platform: contentPlatformSchema
});

export const generatedContentSchema = z.object({
  hook: z.string().trim().min(12).max(280),
  body: z.string().trim().min(80).max(5000),
  alternative_hooks: z.array(z.string().trim().min(8).max(220)).min(2).max(5),
  key_points: z.array(z.string().trim().min(4).max(180)).min(3).max(7),
  cta: z.string().trim().min(8).max(260)
});

export const generatedContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["hook", "body", "alternative_hooks", "key_points", "cta"],
  properties: {
    hook: {
      type: "string",
      description: "A concise opening hook."
    },
    body: {
      type: "string",
      description: "The main generated content formatted for the requested platform."
    },
    alternative_hooks: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "string"
      },
      description: "Alternative opening hooks the user could test."
    },
    key_points: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "string"
      },
      description: "Key ideas covered in the generated content."
    },
    cta: {
      type: "string",
      description: "A clear call to action."
    }
  }
} as const;

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type ContentTone = z.infer<typeof contentToneSchema>;
export type ContentPlatform = z.infer<typeof contentPlatformSchema>;
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;
export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export const activeStatuses = new Set<JobStatus>(["queued", "processing", "retrying"]);

export function isActiveStatus(status: JobStatus) {
  return activeStatuses.has(status);
}
