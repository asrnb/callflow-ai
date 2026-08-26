import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig, isE2EMockEnabled } from "@/lib/env";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  if (isE2EMockEnabled()) {
    return response;
  }

  const { url, anonKey } = getSupabasePublicConfig();
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({
        request
      });
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    }
  };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: cookieMethods
  });

  await supabase.auth.getUser();

  return response;
}
