import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ComputersPanel } from "@/components/computers-panel";

export const metadata: Metadata = { title: "Computers" };

export default function ComputersPage() {
  return (
    <AppShell active="computers">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Computers</h1>
      </section>
      <ComputersPanel />
    </AppShell>
  );
}
