import type { Metadata } from "next";

import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MeetingFormPanel } from "@/components/meeting-form-panel";

export const metadata: Metadata = { title: "Meeting Form" };

export default function MeetingPage() {
  return (
    <AppShell active="meeting">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Meeting Form</h1>
        <p className="page-note">
          Plan the meeting: its Frames, questions, scripture and the presenter&apos;s script. To put Frames in order or
          see their history, open the <Link href="/services">Running order</Link>.
        </p>
      </section>
      <MeetingFormPanel />
    </AppShell>
  );
}
