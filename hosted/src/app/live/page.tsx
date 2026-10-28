import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { LivePanel } from "@/components/live-panel";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "Live", ...PRIVATE_PAGE };

export default function LivePage() {
  return (
    <AppShell active="live">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Live</h1>
      </section>
      <LivePanel />
    </AppShell>
  );
}
