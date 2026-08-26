import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-3-5-sonnet-latest"),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional()
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
      anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
      anthropicModel: parsed.data.ANTHROPIC_MODEL,
      inngestEventKey: parsed.data.INNGEST_EVENT_KEY,
      inngestSigningKey: parsed.data.INNGEST_SIGNING_KEY
    };
  }

  if (process.env.NODE_ENV === "test" || isE2EMockEnabled()) {
    return {
      supabaseUrl: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: fallbackPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: "missing-service-role-key",
      anthropicApiKey: "missing-anthropic-key",
      anthropicModel: "claude-3-5-sonnet-latest",
      inngestEventKey: undefined,
      inngestSigningKey: undefined
    };
  }

  throw new Error(`Invalid server environment: ${parsed.error.message}`);
}
