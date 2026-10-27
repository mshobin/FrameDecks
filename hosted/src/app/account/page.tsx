import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { WorkspacePanel } from "@/components/workspace-panel";

export const metadata: Metadata = { title: "Your account" };

// Profile, churches and invitations, moved off Home so it stays about the next service (owner-approved, 27 October)
export default function AccountPage() {
  return (
    <AppShell active="account">
      <section className="page-head">
        <h1>Your account</h1>
        <p className="page-note">Your name, the churches and groups you belong to, and invitations to join one.</p>
      </section>
      <WorkspacePanel />
    </AppShell>
  );
}
