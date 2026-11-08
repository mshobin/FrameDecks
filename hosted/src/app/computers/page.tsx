import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { Forward } from "@/components/moved-to-sync";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Devices", "/computers", { private: true });

// 26.11.12 Service PCs is now part of Devices: the old address (bookmarks, the PC's links) goes on there
export default function ComputersPage() {
  return (
    <AuthShell eyebrow="FrameDecks" title="Devices">
      <Forward to="/devices" label="Devices" />
    </AuthShell>
  );
}
