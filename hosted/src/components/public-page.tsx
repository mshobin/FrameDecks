import { LandingNav } from "@/components/landing/nav";
import { SiteFooter } from "@/components/site-footer";

/** The frame of framedecks.com's public pages (download, legal, security, docs, about): the front page's bar, one
 * reading column, and the site footer. */
export function PublicPage({
  eyebrow,
  title,
  lead,
  wide = false,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  lead?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className="fd-landing fd-lp fd-public">
      <LandingNav />
      <main
        id="main"
        tabIndex={-1}
        className={wide ? "fd-public-main is-wide" : "fd-public-main"}
      >
        <header className="fd-public-head">
          {eyebrow && <p className="lp-eyebrow">{eyebrow}</p>}
          <h1 className="fd-public-title">{title}</h1>
          {lead && <p className="fd-public-lead">{lead}</p>}
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** A legal or security text rendered from the repository's Markdown (lib/markdown.ts). */
export function DocBody({ html }: Readonly<{ html: string }>) {
  return (
    <article className="fd-doc" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
