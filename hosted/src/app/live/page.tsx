import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { LivePanel } from "@/components/live-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Live", "/live", { private: true });

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
