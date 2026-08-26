import { describe, expect, it } from "vitest";
import {
  createJobRequestSchema,
  generatedContentSchema
} from "@/lib/schemas/content";

describe("content schemas", () => {
  it("accepts a valid content generation request", () => {
    const result = createJobRequestSchema.safeParse({
      topic: "AI onboarding for customer success teams",
      audience: "B2B SaaS founders",
      tone: "professional",
      platform: "linkedin"
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported tone and platform values", () => {
    const result = createJobRequestSchema.safeParse({
      topic: "AI onboarding",
      audience: "founders",
      tone: "sarcastic",
      platform: "billboard"
    });

    expect(result.success).toBe(false);
  });

  it("validates the required structured AI output shape", () => {
    const result = generatedContentSchema.safeParse({
      hook: "Most teams are treating onboarding AI like a feature, not a system.",
      body: "A useful AI onboarding workflow starts with the customer moment, not the model. Show the pain, map the handoff, and make the next action obvious enough for a busy customer success team to trust.",
      alternative_hooks: [
        "AI onboarding fails when it feels like extra work.",
        "The best AI onboarding flow starts before the first prompt."
      ],
      key_points: [
        "Start with the customer moment.",
        "Keep the handoff visible.",
        "Close with one action."
      ],
      cta: "Audit one onboarding step this week."
    });

    expect(result.success).toBe(true);
  });
});
