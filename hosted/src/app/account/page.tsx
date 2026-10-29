import type { Metadata } from "next";

import { AccountData } from "@/components/account-data";
import { AppShell } from "@/components/app-shell";
import { WorkspacePanel } from "@/components/workspace-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Your account", "/account", { private: true });

// Profile, teams and invitations, moved off Home so it stays about the next service (owner-approved, 27 October)
export default function AccountPage() {
  return (
    <AppShell active="account">
      <section className="page-head">
        <h1>Your account</h1>
        <p className="page-note">Your name, the teams you belong to, invitations to join one, and your data.</p>
      </section>
      <WorkspacePanel />
      <AccountData />
    </AppShell>
  );
}
