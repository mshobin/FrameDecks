import type { Metadata } from "next";
import Link from "next/link";

import { DocBody, PublicPage } from "@/components/public-page";
import { legalPage } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Legal", "/legal");

const DOCS = [
  {
    href: "/terms",
    title: "Terms of Service",
    text: "Your workspaces and the online services.",
  },
  {
    href: "/privacy",
    title: "Privacy Policy",
    text: "What is kept, why, for how long, and your rights.",
  },
  {
    href: "/cookies",
    title: "Cookie Policy",
    text: "Essential storage only; no tracking.",
  },
  {
    href: "/eula",
    title: "End User License Agreement",
    text: "The licence for the FrameDecks program.",
  },
  {
    href: "/security",
    title: "Security",
    text: "How data is protected, and how to report a problem.",
  },
  {
    href: "/security/disclosure",
    title: "Vulnerability Disclosure",
    text: "Our promise to security researchers.",
  },
];

export default function LegalPage() {
  const notices = legalPage("THIRD_PARTY_NOTICES");
  return (
    <PublicPage
      eyebrow="Legal"
      title="Legal and licences"
      lead="Everything that governs FrameDecks, in one place."
    >
      <ul className="fd-legal-list">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link href={d.href}>{d.title}</Link>
            <span>{d.text}</span>
          </li>
        ))}
      </ul>
      <article className="fd-doc">
        <h2 id="copyright">Copyright and licence</h2>
        <p>
          FrameDecks © 2026 Shobin Mathews. FrameDecks is open-source software
          under the Apache License 2.0: you may use, copy, change and share it
          under that licence. The program offered here also comes with the{" "}
          <Link href="/eula">End User License Agreement</Link>. FrameDecks,
          FrameDecks vCam and the FrameDecks emblem are trademarks of Shobin
          Mathews: a changed version needs its own name and emblem.
        </p>
        <p>
          Versions up to 6.14 were published under the Apache License 2.0;
          versions 7.0 to 26.11.62 under the FrameDecks Proprietary Software
          License, and copies of those versions remain under it.
        </p>
        <h2 id="third-party">{notices.title}</h2>
      </article>
      <DocBody html={notices.html} />
    </PublicPage>
  );
}
