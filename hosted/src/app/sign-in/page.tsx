import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { SignInChooser } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/sign-in" } };

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInChooser />
    </AuthShell>
  );
}
