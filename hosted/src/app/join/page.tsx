import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { JoinPanel } from "@/components/join-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Join a team", "/join", { private: true });

// 26.11.12 Scan to join: a QR code from the church PC or a device already in opens /join#c=CODE (or the code is typed)
export default function JoinPage() {
  return (
    <AuthShell eyebrow="Scan to join" task>
      <JoinPanel />
    </AuthShell>
  );
}
