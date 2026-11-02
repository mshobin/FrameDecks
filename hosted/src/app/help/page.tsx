import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { HelpCenter } from "@/components/help-center";
import brand from "@/lib/brand.json";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Help", "/help");

// The Help Center (8.6): topics on the left, the chosen one on the right (components/help-center.tsx). One page a
// volunteer can open on a phone five minutes before the service: short, in the words of docs/guide/glossary.md and
// true to the product; longer guides live in /docs.
export default function HelpPage() {
  return (
    <PublicPage
      eyebrow={`Help Center · FrameDecks ${brand.version}`}
      title="How can we help?"
      lead="Choose a topic. New here? Getting Started walks you through it step by step, on the website and on the service PC."
      size="full"
    >
      <HelpCenter />
    </PublicPage>
  );
}
