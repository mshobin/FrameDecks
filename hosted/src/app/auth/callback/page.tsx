import type { Metadata } from "next";

import { AuthCallback } from "@/components/auth-callback";
import { AuthShell } from "@/components/auth-shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Signing in", "/auth/callback", { private: true });

export default function AuthCallbackPage() {
  return (
    <AuthShell eyebrow="Sign in to FrameDecks" title="Signing you in">
      <AuthCallback />
    </AuthShell>
  );
}
