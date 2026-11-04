import type { Metadata } from "next";

import { AuthCallback } from "@/components/auth-callback";
import { AuthShell } from "@/components/auth-shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Opening your workspace", "/auth/callback", { private: true });

export default function AuthCallbackPage() {
  return (
    <AuthShell eyebrow="Sync Workspace" title="Opening your workspace">
      <AuthCallback />
    </AuthShell>
  );
}
