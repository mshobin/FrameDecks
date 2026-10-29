import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { SignInChooser } from "@/components/sign-in-form";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Sign in", "/sign-in");

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInChooser />
    </AuthShell>
  );
}
