import type { Metadata } from "next";

// The website's one address (docs/deployment/cloudflare-domains.md). framedecks.com is canonical: every canonical
// link, the sitemap and robots.txt use it, whichever address served the page (the Pages address, a preview).
// NEXT_PUBLIC_SITE_URL overrides it for a test deployment only.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://framedecks.com").replace(/\/+$/, "");

/** Public pages that search engines may list; everything else needs an account and is marked noindex. */
export const PUBLIC_PATHS = [
  "/",
  "/download",
  "/docs",
  "/help",
  "/roadmap",
  "/about",
  "/contact",
  "/legal",
  "/terms",
  "/privacy",
  "/cookies",
  "/eula",
  "/security",
  "/security/disclosure",
  "/status",
  "/sign-in",
] as const;

/** Each page's own metadata: its tab title, and the title and address a shared link shows (Open Graph). The layout
 *  must not set og:title or og:url, or every page would inherit the home page's (28 October bug). Pages only
 *  signed-in people use are kept out of search results. */
export function pageMetadata(title: string, path: string, opts: { private?: boolean } = {}): Metadata {
  return {
    title,
    openGraph: { title: `${title} | FrameDecks`, url: path },
    ...(opts.private ? { robots: { index: false, follow: false } } : { alternates: { canonical: path } }),
  };
}
