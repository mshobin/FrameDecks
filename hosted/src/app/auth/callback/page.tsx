import type { Metadata } from "next";

import { AuthCallback } from "@/components/auth-callback";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Signing in" };

export default function AuthCallbackPage() {
  return (
    <AuthShell eyebrow="Sign in to FrameDecks" title="Signing you in">
      <AuthCallback />
    </AuthShell>
  );
}
