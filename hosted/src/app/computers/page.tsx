import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ComputersPanel } from "@/components/computers-panel";

export const metadata: Metadata = { title: "Service PCs" };

export default function ComputersPage() {
  return (
    <AppShell active="pcs">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Service PCs</h1>
      </section>
      <ComputersPanel />
    </AppShell>
  );
}
