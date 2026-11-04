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
        <h2 id="copyright">Copyright and proprietary software notice</h2>
        <p>
          FrameDecks © 2026 Shobin Mathews. All rights reserved. FrameDecks is
          proprietary software: it is licensed, free of charge, under the{" "}
          <Link href="/eula">End User License Agreement</Link>, not sold.
          FrameDecks, FrameDecks vCam and the FrameDecks emblem are trademarks of
          Shobin Mathews. You may not copy, modify, redistribute or reverse
          engineer the program except as the EULA or the law allows.
        </p>
        <p>
          Versions of FrameDecks up to 6.14 were published under the Apache
          License 2.0, and copies of those versions remain under that licence.
          Version 7.0 and later are proprietary.
        </p>
        <h2 id="third-party">{notices.title}</h2>
      </article>
      <DocBody html={notices.html} />
    </PublicPage>
  );
}
