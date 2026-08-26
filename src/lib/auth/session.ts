import type { User } from "@supabase/supabase-js";
import { isE2EMockEnabled } from "@/lib/env";
import { getMockUser } from "@/lib/jobs/mock-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = Pick<User, "id" | "email">;
type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AuthContext =
  | {
      isMock: true;
      user: AuthenticatedUser;
      supabase: null;
    }
  | {
      isMock: false;
      user: AuthenticatedUser;
      supabase: ServerSupabaseClient;
    };

export async function getAuthContext(): Promise<AuthContext | null> {
  if (isE2EMockEnabled()) {
    return {
      isMock: true,
      user: getMockUser(),
      supabase: null
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    isMock: false,
    user: {
      id: user.id,
      email: user.email
    },
    supabase
  };
}
