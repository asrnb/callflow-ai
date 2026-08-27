import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAiModel } from "@/lib/env";
import { generateStructuredContent } from "@/lib/anthropic/content-generator";
import { generatedContentSchema } from "@/lib/schemas/content";

function stubMockProviderEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("CONTENTFLOW_AI_PROVIDER", "mock");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

describe("generateStructuredContent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns Zod-valid structured content in mock provider mode", async () => {
    stubMockProviderEnv();

    const result = await generateStructuredContent({
      topic: "AI onboarding for customer success teams",
      audience: "B2B SaaS founders",
      tone: "professional",
      platform: "linkedin"
    });

    expect(result.model).toBe(mockAiModel);
    expect(generatedContentSchema.safeParse(result.content).success).toBe(true);
    expect(result.rawResponse).toEqual(
      expect.objectContaining({
        provider: "mock",
        model: mockAiModel
      })
    );
  });
});
