import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, mockAiModel } from "@/lib/env";

function stubRequiredServerEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("INNGEST_EVENT_KEY", "");
  vi.stubEnv("INNGEST_SIGNING_KEY", "");
}

describe("server environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the mock AI provider without an Anthropic API key", () => {
    stubRequiredServerEnv();
    vi.stubEnv("CONTENTFLOW_AI_PROVIDER", "mock");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const env = getServerEnv();

    expect(env.contentflowAiProvider).toBe("mock");
    expect(env.anthropicApiKey).toBeUndefined();
    expect(env.generationModel).toBe(mockAiModel);
  });

  it("requires an Anthropic API key when Anthropic mode is selected", () => {
    stubRequiredServerEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTENTFLOW_AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(() => getServerEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
