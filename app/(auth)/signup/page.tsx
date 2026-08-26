import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Sign Up"
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
