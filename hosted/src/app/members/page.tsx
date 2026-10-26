import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MembersPanel } from "@/components/members-panel";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <AppShell active="members">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Members</h1>
      </section>
      <MembersPanel />
    </AppShell>
  );
}
