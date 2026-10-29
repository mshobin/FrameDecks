import type { Metadata } from "next";

import { DocBody, PublicPage } from "@/components/public-page";
import { legalPage } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata(
  "Vulnerability Disclosure",
  "/security/disclosure",
);

// The text is docs/legal/vulnerability-disclosure.md, copied into hosted/content/ by scripts/write-content.mjs and rendered at build time.
export default function Page() {
  const doc = legalPage("vulnerability-disclosure");
  return (
    <PublicPage eyebrow="Security" title={doc.title}>
      <DocBody html={doc.html} />
    </PublicPage>
  );
}
