import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ServicesPanel } from "@/components/services-panel";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <AppShell active="services">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Services</h1>
      </section>
      <ServicesPanel />
    </AppShell>
  );
}
