import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import { StatusBoard } from "@/components/status-board";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Status", "/status");

export default function StatusPage() {
  return (
    <PublicPage
      eyebrow="Security"
      title="Status"
      lead="Whether FrameDecks' online services answer right now."
    >
      <StatusBoard />
      <p className="fd-public-note">
        FrameDecks presents from your PC, so a gathering carries on even if a
        service here is down; plans sync again when it returns. Something wrong
        for longer than a few minutes? <Link href="/contact">Tell us</Link>.
      </p>
    </PublicPage>
  );
}
