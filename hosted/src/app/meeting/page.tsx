import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MeetingFormPanel } from "@/components/meeting-form-panel";

export const metadata: Metadata = { title: "Meeting Form" };

export default function MeetingPage() {
  return (
    <AppShell active="meeting">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Meeting Form</h1>
      </section>
      <MeetingFormPanel />
    </AppShell>
  );
}
