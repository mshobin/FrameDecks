import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell eyebrow="FRAMEDECKS ACCOUNT" title="Sign in to your companion">
      <SignInForm />
    </AuthShell>
  );
}
