import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { MovedToSync } from "@/components/moved-to-sync";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Sync Workspace", "/sign-in", { private: true });

// 9.8 the old address (bookmarks, earlier emails, the PC's links) goes on to Sync Workspace, keeping what it asked for
export default function OldEntryPage() {
  return (
    <AuthShell eyebrow="FrameDecks" title="Sync Workspace">
      <MovedToSync />
    </AuthShell>
  );
}
