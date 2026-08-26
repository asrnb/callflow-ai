import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAuthContext } from "@/lib/auth/session";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login?next=/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              ContentFlow AI
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{auth.user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
    </main>
  );
}
