import type { Metadata } from "next";

import { AllowPanel } from "@/components/allow-panel";
import { AuthShell } from "@/components/auth-shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Allow a device", "/allow", { private: true });

// 26.11.12 Scan to join, the other way round: a new browser shows its code (/allow#c=CODE); a device that is in allows it
export default function AllowPage() {
  return (
    <AuthShell eyebrow="Scan to join" task>
      <AllowPanel />
    </AuthShell>
  );
}
