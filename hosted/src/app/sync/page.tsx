import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { WorkspaceSyncChooser } from "@/components/workspace-sync-form";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Open Workspace", "/sync");

// 9.8 the one way into a workspace: Open my workspace, Start a new one or Continue on Another Device (an emailed one-time link)
export default function SyncPage() {
  return (
    <AuthShell>
      <WorkspaceSyncChooser />
    </AuthShell>
  );
}
