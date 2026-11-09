import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { FollowPanel } from "@/components/join-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Follow the meeting", "/follow", { private: true });

// 26.11.24 Members' phones: the church PC shows a QR to /follow#c=CODE (or the code is typed). No account needed.
export default function FollowPage() {
  return (
    <AuthShell eyebrow="Members’ phones" task>
      <FollowPanel />
    </AuthShell>
  );
}
