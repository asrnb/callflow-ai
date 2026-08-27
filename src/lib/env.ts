import { z } from "zod";

export const mockAiModel = "contentflow-mock-v1";

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CONTENTFLOW_AI_PROVIDER: z.enum(["anthropic", "mock"]).default("anthropic"),
  ANTHROPIC_API_KEY: optionalEnvString,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-3-5-sonnet-latest"),
  INNGEST_EVENT_KEY: optionalEnvString,
  INNGEST_SIGNING_KEY: optionalEnvString
}).superRefine((env, context) => {
  if (env.CONTENTFLOW_AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ANTHROPIC_API_KEY"],
      message: "ANTHROPIC_API_KEY is required when CONTENTFLOW_AI_PROVIDER=anthropic."
    });
  }
});

const fallbackPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "missing-supabase-anon-key"
};

export function isE2EMockEnabled() {
  return process.env.E2E_USE_MOCK_DATA === "true";
}

export function getSupabasePublicConfig() {
  const parsed = publicEnvSchema.safeParse(process.env);

  if (parsed.success) {
    return {
      url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };
  }

  if (process.env.NODE_ENV !== "production" || isE2EMockEnabled()) {
    return {
      url: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };
  }

  throw new Error(`Invalid public environment: ${parsed.error.message}`);
}

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (parsed.success) {
    return {
      supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
      contentflowAiProvider: parsed.data.CONTENTFLOW_AI_PROVIDER,
      anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
      anthropicModel: parsed.data.ANTHROPIC_MODEL,
      generationModel:
        parsed.data.CONTENTFLOW_AI_PROVIDER === "mock"
          ? mockAiModel
          : parsed.data.ANTHROPIC_MODEL,
      inngestEventKey: parsed.data.INNGEST_EVENT_KEY,
      inngestSigningKey: parsed.data.INNGEST_SIGNING_KEY
    };
  }

  if (process.env.NODE_ENV === "test" || isE2EMockEnabled()) {
    return {
      supabaseUrl: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: "missing-service-role-key",
      contentflowAiProvider: "anthropic" as const,
      anthropicApiKey: "missing-anthropic-key",
      anthropicModel: "claude-3-5-sonnet-latest",
      generationModel: "claude-3-5-sonnet-latest",
      inngestEventKey: undefined,
      inngestSigningKey: undefined
    };
  }

  throw new Error(`Invalid server environment: ${parsed.error.message}`);
}
