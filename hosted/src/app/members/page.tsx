import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MembersPanel } from "@/components/members-panel";

export const metadata: Metadata = { title: "People" };

export default function MembersPage() {
  return (
    <AppShell active="people">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>People</h1>
      </section>
      <MembersPanel />
    </AppShell>
  );
}
