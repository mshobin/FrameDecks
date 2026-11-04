import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { DevicesPanel } from "@/components/devices-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Manage Devices", "/devices", { private: true });

// 9.8 Trusted Devices, removing one, recent security activity, and Continue on Another Device
export default function DevicesPage() {
  return (
    <AppShell active="devices">
      <section className="page-head">
        <h1>Manage Devices</h1>
        <p className="page-note">The devices that open your workspace without a new link, and what happened recently.</p>
      </section>
      <DevicesPanel />
    </AppShell>
  );
}
