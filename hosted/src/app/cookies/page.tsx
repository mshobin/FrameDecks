import type { Metadata } from "next";

import { DocBody, PublicPage } from "@/components/public-page";
import { legalPage } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Cookie Policy", "/cookies");

// The text is docs/legal/cookies.md, copied into hosted/content/ by scripts/write-content.mjs and rendered at build time.
export default function Page() {
  const doc = legalPage("cookies");
  return (
    <PublicPage eyebrow="Legal" title={doc.title}>
      <DocBody html={doc.html} />
    </PublicPage>
  );
}
