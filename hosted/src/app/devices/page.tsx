import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { DevicesPanel } from "@/components/devices-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Devices", "/devices", { private: true });

// 26.11.12 one Devices page per team: phones, browsers and church PCs (Service PCs merged in), Add a device, Invite
// someone, the owner's recovery code and emergency email, and recent activity
export default function DevicesPage() {
  return (
    <AppShell active="devices">
      <section className="page-head">
        <h1>Devices</h1>
        <p className="page-note">Every phone, computer and church PC in your team. Add one by scanning a code; remove one and it’s out at once.</p>
      </section>
      <DevicesPanel />
    </AppShell>
  );
}
