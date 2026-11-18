import Image from "next/image";
import Link from "next/link";

import brand from "@/lib/brand.json";
import { shortVersion } from "@/lib/releases";

// The public pages' footer (7.0): five short columns, quiet grey with gold on hover, and the copyright line. Every
// link stays on framedecks.com; nothing points to the source repository.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/download", label: "Download" },
      { href: "/#features", label: "Features" },
      { href: "/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/help", label: "Help Center" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/eula", label: "EULA" },
    ],
  },
  {
    title: "Security",
    links: [
      { href: "/security", label: "Security" },
      { href: "/security/disclosure", label: "Vulnerability Disclosure" },
      { href: "/status", label: "Status" },
    ],
  },
] as const;

export const FOOTER_LINKS = COLUMNS.flatMap((c) => c.links.map((l) => l.href));

export function SiteFooter() {
  return (
    <footer className="fd-site-foot">
      <div className="fd-site-foot-in">
        <div className="fd-site-foot-brand">
          <Link className="fd-brand" href="/" aria-label="FrameDecks home">
            <span className="fd-brand-mark">
              <Image
                src="/framedecks-emblem.webp"
                alt=""
                width={28}
                height={28}
                loading="lazy"
                unoptimized
              />
            </span>
            <span className="fd-brand-copy">
              <strong>FrameDecks</strong>
            </span>
          </Link>
          <p>Prepare with purpose. Present with excellence.</p>
        </div>
        <nav className="fd-site-foot-cols" aria-label="Site">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h2>{c.title}</h2>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <p className="fd-site-foot-legal">
        © 2026 Shobin Mathews. FrameDecks is open-source software under the
        Apache License 2.0; the official program also comes with the{" "}
        <Link href="/eula">EULA</Link>. FrameDecks{" "}
        {shortVersion(brand.version)}, Stable Release (build {brand.version}).
      </p>
    </footer>
  );
}
