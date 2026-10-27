import type { Metadata } from "next";

import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ServicesPanel } from "@/components/services-panel";

export const metadata: Metadata = { title: "Running order" };

export default function ServicesPage() {
  return (
    <AppShell active="services">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Running order</h1>
        <p className="page-note">
          The Frames in the order they go on screen: change their words and order, see who changed what, and restore
          anything from the last 30 days. To plan a new meeting, use the <Link href="/meeting">Meeting Form</Link>.
        </p>
      </section>
      <ServicesPanel />
    </AppShell>
  );
}
