import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MembersPanel } from "@/components/members-panel";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "People", ...PRIVATE_PAGE };

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
