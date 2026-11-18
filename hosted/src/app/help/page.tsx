import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { HelpCenter } from "@/components/help-center";
import { TOPICS } from "@/components/help-topics";
import { helpIndex } from "@/lib/help-index";
import codes from "../../../content/help-codes.json";
import brand from "@/lib/brand.json";
import { pageMetadata } from "@/lib/site";
import { shortVersion } from "@/lib/releases";

export const metadata: Metadata = pageMetadata("Help", "/help");

// The Help Center (8.6): topics on the left, the chosen one on the right (components/help-center.tsx). One page a
// volunteer can open on a phone five minutes before the service: short, in the words of docs/guide/glossary.md and
// true to the product; longer guides live in /docs.
export default function HelpPage() {
  return (
    <PublicPage
      eyebrow={`Help Center · FrameDecks ${shortVersion(brand.version)}`}
      title="How can we help?"
      lead="Choose a topic. New here? Getting Started walks you through it step by step, on the website and on the service PC."
      size="full"
    >
      <HelpCenter
        index={helpIndex()}
        codes={codes}
        topics={TOPICS.map((t) => ({
          id: t.id,
          label: t.label,
          blurb: t.blurb,
          icon: <t.icon aria-hidden="true" size={18} />,
          big: <t.icon size={22} />,
          body: t.body(codes),
        }))}
      />
    </PublicPage>
  );
}
