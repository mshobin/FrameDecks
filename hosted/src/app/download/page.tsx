import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import { DownloadPanel } from "@/components/download-panel";
import { PublicPage } from "@/components/public-page";
import brand from "@/lib/brand.json";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Download", "/download");

export default function DownloadPage() {
  // This version's notes, for when the update service cannot be reached (scripts/write-content.mjs copies them)
  const notes = readFileSync(
    path.join(process.cwd(), "content", "release-notes.md"),
    "utf8",
  );
  return (
    <PublicPage
      eyebrow="Download"
      title="Download FrameDecks"
      lead="Prepare with purpose. Present with excellence. Free to download and use."
      wide
    >
      <DownloadPanel fallback={{ version: brand.version, notes }} />
    </PublicPage>
  );
}
