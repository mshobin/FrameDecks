import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import { guides } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Documentation", "/docs");

// The user guides (docs/guide/), published on framedecks.com so nobody needs the source repository to read them.
export default function DocsIndex() {
  const all = guides();
  const roles = all.filter((g) => g.file.startsWith("roles/"));
  const main = all.filter((g) => !g.file.startsWith("roles/"));
  return (
    <PublicPage
      eyebrow="Resources"
      title="Documentation"
      lead="Guides for everyone who prepares, presents and serves with FrameDecks."
      wide
    >
      <ul className="fd-doc-cards">
        {main.map((g) => (
          <li key={g.slug}>
            <Link href={`/docs/${g.slug}`}>
              <strong>{g.title}</strong>
              <span>{g.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="fd-doc-group">For each role in your team</h2>
      <ul className="fd-doc-cards">
        {roles.map((g) => (
          <li key={g.slug}>
            <Link href={`/docs/${g.slug}`}>
              <strong>{g.title}</strong>
              <span>{g.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}
