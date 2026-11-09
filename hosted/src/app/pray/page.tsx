import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { PrayerPanel } from "@/components/join-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Send a prayer request", "/pray", { private: true });

// 26.11.23 Prayer requests wall: the church PC shows a QR to /pray#c=CODE (or the code is typed). No account needed.
export default function PrayPage() {
  return (
    <AuthShell eyebrow="Prayer requests" task>
      <PrayerPanel />
    </AuthShell>
  );
}
