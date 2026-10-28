// The website's one address (docs/deployment/cloudflare-domains.md). framedecks.com is canonical: every canonical
// link, the sitemap and robots.txt use it, whichever address served the page (the Pages address, a preview).
// NEXT_PUBLIC_SITE_URL overrides it for a test deployment only.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://framedecks.com").replace(/\/+$/, "");

/** Public pages that search engines may list; everything else needs an account and is marked noindex. */
export const PUBLIC_PATHS = ["/", "/help", "/privacy", "/sign-in"] as const;

/** Metadata for a page only signed-in people use: keep it out of search results. */
export const PRIVATE_PAGE = { robots: { index: false, follow: false } } as const;
