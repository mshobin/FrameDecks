import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { ConnectPanel } from "@/components/connect-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Connect a PC", "/connect", { private: true });

export default function ConnectPage() {
  return (
    <AuthShell eyebrow="Workspace Sync" title="Connect a PC">
      <ConnectPanel />
    </AuthShell>
  );
}
