import type { Metadata } from "next";

import { DocBody, PublicPage } from "@/components/public-page";
import { legalPage } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata(
  "End User License Agreement",
  "/eula",
);

// The text is docs/legal/eula.md, copied into hosted/content/ by scripts/write-content.mjs and rendered at build time.
export default function Page() {
  const doc = legalPage("eula");
  return (
    <PublicPage eyebrow="Legal" title={doc.title}>
      <DocBody html={doc.html} />
    </PublicPage>
  );
}
