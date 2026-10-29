# Domains on Cloudflare: framedecks.com

**framedecks.com is the one authoritative address.** Every canonical link, the sitemap, robots.txt, Open Graph
tags and the Windows program use it. Everything else either redirects to it or is kept out of search results.

| Address | What it does | Status |
| --- | --- | --- |
| `framedecks.com` | The website: front page, sign-in and the signed-in app (Cloudflare Pages project `framedecks`) | Serves |
| `www.framedecks.com` | 301 to `https://framedecks.com` + same path and query | Redirect |
| `framedecks.app`, `www.framedecks.app` | 301 to `https://framedecks.com` + same path and query | Redirect |
| `app.framedecks.com` | 302 to `https://framedecks.com` + same path (reserved for the app if it ever gets its own address) | Reserved |
| `api.framedecks.com` | The update service: release manifests for the program and the download page (Worker `framedecks-update-api`, `release-pipeline.md`) | Serves (7.0) |
| `downloads.framedecks.com` | The installers (R2 bucket `framedecks-downloads`, custom domain; `release-pipeline.md`) | Serves (7.0) |
| `docs.framedecks.com` | 302 to `https://framedecks.com/help` | Reserved |
| `framedecks.pages.dev` | Pages' own address: answers with `X-Robots-Tag: noindex`; 301 to framedecks.com once step 7 is done | Fallback |

Why the reserved addresses use **302**, not 301: browsers remember a 301 for a long time. A 302 lets
`app.` and `docs.` serve real content later without anyone being stuck on an old redirect.

Why the app stays on `framedecks.com` for now: the sign-in session is kept per address. If the front page were on
`framedecks.com` and the app on `app.framedecks.com`, signing in on one would not sign you in on the other, and the
Supabase redirect URLs, the PWA and the program's link flow would all need a second address. Moving the app later is a
planned change (see "Later" below), not a DNS switch.

The backend is not behind these addresses: Supabase stays at `https://<project>.supabase.co`. The website and the
program call it directly, and Supabase's own row-level security protects the data.

## What the repository already does

- `hosted/src/lib/site.ts`: `SITE_URL = "https://framedecks.com"` (only `NEXT_PUBLIC_SITE_URL` overrides it, for a
  test deployment). `layout.tsx` sets `metadataBase` and Open Graph from it.
- Canonical links: `/`, `/help`, `/privacy` and `/sign-in` point to their framedecks.com address; every signed-in
  page and `/auth/callback` is `noindex, nofollow`.
- `hosted/src/app/robots.ts` and `sitemap.ts` build `robots.txt` and `sitemap.xml` on framedecks.com.
- `hosted/public/_headers`: `X-Robots-Tag: noindex` on `*.pages.dev`; build files cached for a year (`immutable`);
  the existing security headers on every page.
- The Windows program (`src/cloud_sync.py`) asks `https://framedecks.com/api/sync-config` first and
  `https://framedecks.pages.dev` second, so it links before, during and after the move. It identifies itself as
  `FrameDecks (Windows; +https://framedecks.com)`; the WAF rules below rely on that.

## Order of work (owner, about one hour)

1. **Domains.** Both `framedecks.com` and `framedecks.app` registered at Cloudflare Registrar (each is its own zone).
   Turn on **DNSSEC** for both (DNS → Settings → DNSSEC; with Cloudflare Registrar it is one click).
2. **Pages custom domain.** Workers & Pages → `framedecks` → Custom domains → add `framedecks.com`. Cloudflare creates
   the record and the certificate. Wait until it says **Active**.
3. **DNS records** for the redirect-only names (below).
4. **Redirect rules** (below), then **SSL/TLS**, **cache**, **security** and **WAF** settings.
5. **Supabase** (Authentication → URL Configuration):
   - **Site URL:** `https://framedecks.com`;
   - **Redirect URLs:** add `https://framedecks.com/auth/callback`; keep `https://framedecks.pages.dev/auth/callback`
     until step 7 is done, and `http://localhost:3000/auth/callback` for development.
6. **Sign-in providers and email.**
   - Google (Google Cloud → OAuth consent screen): home page `https://framedecks.com`, privacy policy
     `https://framedecks.com/privacy`, authorised domain `framedecks.com`. The provider's redirect URI stays the
     Supabase one (`https://<project>.supabase.co/auth/v1/callback`), so nothing else changes.
   - Microsoft: the same; its redirect URI is also the Supabase one.
   - Email: sign-in emails still come from Supabase's built-in mail, not from framedecks.com. Receiving mail at
     framedecks.com is step 6a.
6a. **Email Routing (7.0: hello@, security@, privacy@).** The website, the legal pages, `security.txt` and the
   installer name these addresses, so they must reach you. Free, receive-only:
   - framedecks.com zone → **Email** → Email Routing → Get started. Delete the null MX and the `v=spf1 -all` record
     first (DNS table below); Cloudflare then adds its own MX records and SPF (`v=spf1 include:_spf.mx.cloudflare.net ~all`).
   - Destination addresses → add your personal inbox and confirm the email Cloudflare sends.
   - Routing rules → custom addresses `hello`, `security` and `privacy` → *Send to an email* → your inbox. Leave the
     catch-all **off** (it only attracts spam).
   - Keep the `_dmarc` record but relax it to `v=DMARC1; p=quarantine;` so forwarded mail is not rejected.
   - Replies go from your personal address. If replies should come from hello@framedecks.com later, add a sending
     service (any SMTP provider) and the SPF and DKIM records it gives.
7. **Retire the Pages address in search and links**, after framedecks.com has worked for a few days: Account → Bulk
   Redirects → a list with source `framedecks.pages.dev`, target `https://framedecks.com`, **301**, *preserve query
   string*, *subpath matching*, *preserve path suffix* → a Bulk Redirect rule using the list. The program follows the
   redirect, so older PCs (6.12 and earlier ask `framedecks.pages.dev`) keep linking. Then remove the pages.dev
   redirect URL from Supabase.
8. **Check** with the commands at the end.

## DNS

`framedecks.com` zone:

| Type | Name | Content | Proxy | Note |
| --- | --- | --- | --- | --- |
| CNAME | `framedecks.com` (`@`) | `framedecks.pages.dev` | Proxied | Created by step 2 (CNAME flattening at the apex) |
| AAAA | `www` | `100::` | Proxied | No server: the redirect rule answers |
| AAAA | `app` | `100::` | Proxied | Reserved, redirect rule |
| (Worker) | `api` | created by `npx wrangler deploy` (custom domain) | Proxied | Update service, 7.0 |
| (R2) | `downloads` | created by R2 → Custom Domains | Proxied | Installers, 7.0 |
| AAAA | `docs` | `100::` | Proxied | Reserved, redirect rule |
| MX, TXT | `@` | added by Email Routing (step 6a) | DNS only | Replaces the null MX and `v=spf1 -all` used before 7.0 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine;` | DNS only | Receivers distrust forged framedecks.com mail |

`framedecks.app` zone (it never sends mail either):

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| AAAA | `framedecks.app` (`@`) | `100::` | Proxied |
| AAAA | `www` | `100::` | Proxied |
| MX | `@` | `.` priority 0 (null MX: no mail) | DNS only |
| TXT | `@` | `v=spf1 -all` | DNS only |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` | DNS only |

No CAA records: Cloudflare adds what its certificates need. If a policy ever requires CAA, allow every authority
Cloudflare uses (`letsencrypt.org`, `pki.goog`, `ssl.com`), or certificates stop renewing.

## Redirect rules

Rules → **Redirect Rules** (Single Redirects), status and query string as listed. All use a *dynamic* target.

`framedecks.com` zone:

| Rule | When incoming requests match (expression) | Target URL (expression) | Status | Keep query |
| --- | --- | --- | --- | --- |
| www to apex | `http.host eq "www.framedecks.com"` | `concat("https://framedecks.com", http.request.uri.path)` | 301 | Yes |
| app (reserved) | `http.host eq "app.framedecks.com"` | `concat("https://framedecks.com", http.request.uri.path)` | 302 | Yes |
| docs (reserved) | `http.host eq "docs.framedecks.com"` | `"https://framedecks.com/help"` (static) | 302 | No |

`framedecks.app` zone:

| Rule | When incoming requests match (expression) | Target URL (expression) | Status | Keep query |
| --- | --- | --- | --- | --- |
| .app to .com | `http.host in {"framedecks.app" "www.framedecks.app"}` | `concat("https://framedecks.com", http.request.uri.path)` | 301 | Yes |

Plus the Bulk Redirect for `framedecks.pages.dev` (step 7). Pages' own `_redirects` file cannot match on the host
name, so these live in Cloudflare, not in the repository.

## SSL/TLS (both zones)

- **Encryption mode: Full (strict).** Pages and the redirect-only names are served by Cloudflare itself, so this is safe.
- **Edge Certificates:** Always Use HTTPS **on**; Automatic HTTPS Rewrites **on**; Minimum TLS **1.2**; TLS 1.3 **on**.
  Universal SSL covers the apex and one level of subdomains (`www`, `app`, `api`, `downloads`, `docs`).
- **HSTS** (Edge Certificates → HSTS): enable with `max-age` 6 months, *include subdomains* **on** (every name above
  is HTTPS through Cloudflare), *preload* **off**, *no-sniff* **on**. After a month without problems, raise `max-age`
  to 12 months; turn preload on and submit to hstspreload.org only when you are sure no subdomain will ever need plain
  HTTP (preload is very hard to undo).
- HTTP/2, HTTP/3 (QUIC) and 0-RTT: on (Speed → Optimization / Network).

## Cache rules (framedecks.com)

Pages already caches the site at the edge and clears it on every deploy, so keep this small:

| Rule | Expression | Setting |
| --- | --- | --- |
| Build files | `starts_with(http.request.uri.path, "/_next/static/")` | Eligible for cache; Edge TTL 1 year; Browser TTL: respect origin (`_headers` says `immutable`) |
| Pictures and fonts | `starts_with(http.request.uri.path, "/fonts/") or starts_with(http.request.uri.path, "/product/") or http.request.uri.path.extension in {"webp" "png" "woff2" "ico"}` | Eligible; Edge TTL 30 days; Browser TTL 7 days |
| Service worker | `http.request.uri.path eq "/sw.js"` | Bypass cache |
| Cloud settings | `http.request.uri.path eq "/api/sync-config"` | Eligible; respect origin (5 minutes) |

Do **not** "Cache Everything" the HTML: pages must update on each deploy. Leave **Rocket Loader off** (it breaks the
website's scripts); Brotli and Early Hints on.

## Security settings

- **Security Level:** Medium. **Challenge Passage:** 30 minutes. **Browser Integrity Check:** on (the program's
  request is skipped by the first WAF rule).
- **Bot Fight Mode: off.** On the free plan it cannot be skipped for one path, and it blocks the Windows program's
  request for `/api/sync-config` (in October Cloudflare already answered "Forbidden" to the program until it named
  itself; see `src/cloud_sync.py`).
- Email Address Obfuscation and Hotlink Protection: not needed (the site shows no email addresses in HTML and its
  pictures are meant to be shared).
- **Pages project:** Settings → Access policy for preview deployments, so branch previews are not public.

## WAF (framedecks.com; the free plan allows 5 custom rules and 1 rate-limiting rule)

Managed rules: the **Cloudflare Free Managed Ruleset** is on by default; leave it on.

Custom rules, in this order:

| # | Name | Expression | Action |
| --- | --- | --- | --- |
| 1 | Program fetches cloud settings | `http.request.uri.path eq "/api/sync-config" and starts_with(http.user_agent, "FrameDecks")` | Skip: Browser Integrity Check, Security Level, remaining custom rules |
| 2 | Static site: read-only methods | `not http.request.method in {"GET" "HEAD" "OPTIONS"}` | Block |
| 3 | Common probes | `http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git" or http.request.uri.path.extension in {"php" "asp" "aspx" "cgi"}` | Block |
| 4 | Known bad bots | `cf.client.bot eq false and http.user_agent eq ""` | Managed Challenge |

Rule 2 is safe because the website never receives form posts: sign-in, sync and every write go straight to Supabase.

Rate limiting (one rule): `http.request.uri.path eq "/api/sync-config"`, **30 requests per 10 seconds per IP**,
action Block for 10 seconds. A PC asks once when linking.

The `framedecks.app` zone only redirects; Always Use HTTPS and the free managed ruleset are enough there.

## Checks after the move

```bash
curl -sI https://framedecks.com | head -n 1                         # HTTP/2 200
curl -sI https://www.framedecks.com/help?x=1 | grep -i location     # https://framedecks.com/help?x=1 (301)
curl -sI https://framedecks.app/sign-in | grep -iE "^HTTP|location"  # 301 → https://framedecks.com/sign-in
curl -sI https://www.framedecks.app | grep -iE "^HTTP|location"      # 301 → https://framedecks.com/
curl -sI https://app.framedecks.com/plan | grep -iE "^HTTP|location" # 302 → https://framedecks.com/plan
curl -s  https://api.framedecks.com/health                           # {"ok":true,…} (release-pipeline.md)
dig +short MX framedecks.com                                        # Cloudflare's route*.mx.cloudflare.net
curl -s  https://framedecks.com/robots.txt                          # Sitemap: https://framedecks.com/sitemap.xml
curl -s  -A "FrameDecks (Windows; +https://framedecks.com)" https://framedecks.com/api/sync-config   # {"url":…}
curl -sI https://framedecks.pages.dev | grep -i x-robots-tag        # noindex (or a 301 after step 7)
curl -sI https://framedecks.com | grep -i strict-transport          # HSTS once enabled
```

Then sign in on `https://framedecks.com` with each provider, and link a PC from Settings → FrameDecks account (the
page shows `framedecks.com` as the website).

## Rollback

Each step undoes on its own: delete the redirect rule; remove the custom domain from the Pages project (the site stays
on `framedecks.pages.dev`); put the Supabase Site URL back. The program falls back to `framedecks.pages.dev` by itself
as long as the Bulk Redirect of step 7 is not in place.

## Later

- **app.framedecks.com as the app's own address:** move the signed-in pages there, keep the front page on
  framedecks.com, add `https://app.framedecks.com/auth/callback` to Supabase, point "Sign in" links at it, and change
  the reserved 302 into a Pages custom domain. Sessions do not carry across, so people sign in once more.
- **api.framedecks.com** serves the update service since 7.0. More routes (team or licence checks) belong in the same
  Worker; Supabase's custom-domain add-on (paid) would need a different name, such as `db.framedecks.com`.
- **docs.framedecks.com:** a docs site built from `docs/guide/` (for example a second Pages project); until then it
  points to the Help page.
