# FrameDecks as a commercial product: closed source, free, downloaded from framedecks.com (plan, 29 October 2026)

The owner's brief of 29 October: FrameDecks becomes proprietary software, free to use, downloaded only from
framedecks.com, kept in a private GitHub repository, updated automatically from FrameDecks servers, with legal and
security pages in the website footer and room for paid team and cloud features later. Version 7.0 carries the parts
that can be built in the repository; section 7 lists what only the owner can do, in order.

Decisions taken with the owner (29 October): the legal party is **Shobin Mathews** (personal; a company can replace it
later); the governing law is **left as a marked gap** for a lawyer; the contact addresses are **hello@framedecks.com**
and **security@framedecks.com** through Cloudflare Email Routing; Mac and Linux visitors see **"coming later"** on
the download page.

> This plan and the legal pages it adds are drafts written without a lawyer. Have them reviewed before relying on
> them, in particular the governing law, the liability limits and the privacy wording for the places your users live.

## 1. Code changes (what 7.0 builds)

| Area | Change | Where |
| --- | --- | --- |
| Licence | Apache 2.0 replaced by the FrameDecks Proprietary Software License; NOTICE keeps the third-party attributions; "open source" removed from every user-visible place | `LICENSE`, `NOTICE`, `README.md`, `docs/legal/`, website, program |
| Source exposure | No user-visible link to GitHub (footer, Help, About, update check); documentation served on framedecks.com/docs from the user guides only; no browser source maps | website, `app/js/about.js`, `src/server.py` |
| Download | framedecks.com/download: detects Windows / macOS / Linux, shows the latest version, its size, its SHA-256 and its release notes from the update service, with the build's own version as a fallback | `hosted/src/app/download`, `components/download-panel.tsx`, `lib/releases.ts` |
| Release pipeline | A version tag builds the installer, uploads it to Cloudflare R2 (`releases/<version>/`, plus `latest/`), and writes the release manifest; the GitHub Release stays as a private record | `.github/workflows/build-windows.yml`, `tools/make_release_manifest.py` |
| Update service | A Cloudflare Worker at api.framedecks.com: `GET /releases/latest`, `GET /releases`, `GET /releases/<version>`, `GET /health`, read from R2 | `infra/update-api/` |
| Automatic updates | The program asks api.framedecks.com once a day; About shows the new version and its notes; **Update now** downloads from downloads.framedecks.com only, checks size and SHA-256 (and the Authenticode signature once signing is on), installs silently, restarts; a failed install puts the previous version back; **Reinstall the previous version** in About | `src/updater.py`, `src/server.py`, `app/js/about.js` |
| Legal pages | Terms of Service, Privacy Policy (rewritten), Cookie Policy, EULA (with the proprietary licence and copyright notice), a Legal index | `hosted/src/app/{terms,privacy,cookies,eula,legal}` |
| Security | Security page, Vulnerability Disclosure page, `/.well-known/security.txt`, Status page that checks the website, the update service and sign-in live | `hosted/src/app/{security,status}`, `public/.well-known/security.txt` |
| Footer | Product · Resources · Company · Legal · Security columns, copyright line, on every public page | `components/site-footer.tsx` |
| Cookie notice | One quiet banner: essential storage only, no tracking; ready for consent categories if analytics are ever added | `components/cookie-notice.tsx`, `lib/consent.ts` |
| Accounts | Terms and Privacy accepted explicitly (a required tick when creating an account; a one-time acceptance screen for existing accounts and for later versions), stored with the version and time; **Download my data** and **Delete my account** on Your account | migration `0011_accounts_legal.sql`, `components/legal-gate.tsx`, `components/account-data.tsx` |
| Company pages | About, Contact, Roadmap, Documentation | `hosted/src/app/{about,contact,roadmap,docs}` |

## 2. Infrastructure changes (the owner's, step by step in section 7)

```
Private GitHub repository ──tag v7.0──▶ GitHub Actions (Windows build, tests, smoke install, signing when on)
        │                                      │
        │                                      ├─▶ Cloudflare R2 bucket "framedecks-downloads"
        │                                      │      releases/7.0/FrameDecks-7.0-Setup.exe (+ .sha256)
        │                                      │      releases/7.0/manifest.json
        │                                      │      latest/FrameDecks-Setup.exe        (stable "latest" link)
        │                                      │      releases/latest.json, releases/index.json
        │                                      └─▶ private GitHub Release (record only)
        ▼
downloads.framedecks.com  (R2 custom domain, cached by Cloudflare)
api.framedecks.com        (Worker reading the same bucket: /releases/latest …)
framedecks.com            (Cloudflare Pages: /download reads api.framedecks.com; falls back to its own version)
FrameDecks on the PC      (asks api.framedecks.com once a day; downloads only from downloads.framedecks.com)
```

- **R2:** one bucket, public through the `downloads.framedecks.com` custom domain only (no r2.dev URL). An API
  token limited to that bucket (Object Read & Write) becomes the GitHub secrets `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, plus the variables `R2_ACCOUNT_ID` and `R2_BUCKET`. Without them the publish step is
  skipped and the build is as before.
- **Worker:** `infra/update-api/` deployed with `wrangler deploy` (binding `RELEASES` to the bucket), route
  `api.framedecks.com/*`. Free plan: 100,000 requests a day, far above a daily check per PC.
- **Email:** Cloudflare Email Routing on framedecks.com forwards `hello@`, `security@` and `privacy@` to the owner's
  inbox. This replaces the "no mail" records in `docs/deployment/cloudflare-domains.md` (null MX goes; the routing
  MX and SPF records Cloudflare adds come in).
- **GitHub:** make the repository private *after* 7.0 is on R2 (older PCs keep working: they only lose the "new
  version" hint, which pointed at GitHub). Private repositories get 2,000 Actions minutes a month free and Windows
  minutes count double; one release build is about 25 Windows minutes, so roughly 40 builds a month. Turn builds on
  pushes to `main` into manual runs if minutes run short.

## 3. UI and UX changes

- **Footer:** five short columns in the site's quiet grey, gold only on hover, the emblem and "© 2026 Shobin Mathews.
  FrameDecks is proprietary software." beneath. On phones the columns fold to two.
- **Download:** one large gold button for the visitor's system ("Download for Windows · 7.0 · 140 MB"), the date, a
  "What's new" panel, the SHA-256 for those who check, "Requires Windows 10 or 11", and three install steps. A Mac or
  Linux visitor sees "FrameDecks for Mac/Linux is coming later" with the Windows download and "Plan on the website"
  beside it. Every "Download" button on the site goes to /download, never to GitHub.
- **Updates in the program:** a quiet toast once per version; Settings → About shows the version, its notes, **Update
  now** (or "Update when I close FrameDecks"), progress, and a plain message for every failure ("The download was
  interrupted. Try again.", "The file did not match; nothing was installed."). Never during a live service: while a
  Frame is on screen the update waits.
- **Accounts:** a required "I agree to the Terms of Service and the Privacy Policy" tick when creating an account;
  existing users see one acceptance screen once; Your account gains Download my data and Delete my account (with a
  typed confirmation).

## 4. Security recommendations

1. **Code signing** (high): until the installer is signed, SmartScreen warns and the updater can only check SHA-256.
   SignPath Foundation's free signing is for open-source projects only, so it ends with this change. Options: an
   OV/EV certificate or Microsoft **Azure Trusted Signing** (about USD 10 a month, the cheapest real option today).
   The updater already refuses an unsigned installer once the manifest says `signed: true`.
2. **Sign the release manifest** (medium): an Ed25519 signature over `manifest.json`, with the public key in the
   program, protects updates even if the R2 bucket or the update service were compromised. Planned for 7.1.
3. **Supabase:** keep RLS on every table (it is), keep the service-role key out of every client and workflow except
   the backup job, turn on leaked-password protection if passwords are ever added, and move to the Pro plan before
   paying customers depend on it (daily backups and point-in-time recovery).
4. **Website:** add HSTS on framedecks.com (owner, Cloudflare), a full Content-Security-Policy once the pages settle,
   and keep `X-Frame-Options: DENY`.
5. **Program:** the local server listens on 127.0.0.1 only; the phone remote stays off until switched on and uses a
   PIN; the updater accepts downloads from `https://downloads.framedecks.com/` only.
6. **Obfuscation is not security:** the Windows program ships Python bytecode and plain HTML/JS, which can be read.
   If hiding the program's internals matters, compile the Python with Nuitka (and minify `app/js`) in a later
   release; never put secrets in the program.

## 5. Legal recommendations

1. **Have a lawyer review** the Terms, EULA, Privacy and Cookie policies, and fill in the governing law.
2. **Versions up to 6.14 stay Apache 2.0.** That licence cannot be withdrawn from copies already published; anyone may
   keep using and sharing those versions under it. From 7.0 the new code is proprietary. Keep the old tags private but
   do not claim the old versions were never open source.
3. **Contributions:** the history shows only the owner's commits (and automated dependency updates), so relicensing
   needs no one else's consent. Future outside contributors should sign a contributor agreement.
4. **Third-party licences:** all compatible with a proprietary program, with two conditions kept in the EULA: pystray
   (LGPL-3.0) and the FFmpeg inside OpenCV (LGPL-2.1) stay separate, replaceable files, and the EULA allows the
   reverse engineering those licences permit for that purpose. The installer keeps shipping `NOTICE` and the third-party
   notices.
5. **Privacy:** name the processors (Supabase, Cloudflare, Google and Microsoft sign-in), where data is stored, how
   long, and how to export or delete it (done in the new Privacy Policy). If paying users in the EU or UK arrive, add a
   data processing agreement for workspaces.
6. **Trademark:** consider registering "FrameDecks" before marketing widely.

## 6. Risks and gaps

| Risk / gap | Effect | Answer |
| --- | --- | --- |
| R2 and the Worker not set up before the repository goes private | New users cannot download; the download page falls back to `downloads.framedecks.com/latest/` which would not exist | Follow section 7 in order; the download page says plainly when the service cannot be reached |
| Unsigned installer | SmartScreen warnings; weaker update integrity | Code signing (section 4.1) |
| No Mac or Linux build | Those visitors cannot use the program | "Coming later" on /download; website planning works everywhere |
| Python bytecode is readable | "Closed source" protects legally, not technically | Nuitka later (section 4.6) |
| Emails on framedecks.com not set up | security.txt and the legal pages name addresses that bounce | Cloudflare Email Routing first (section 7, step 1) |
| Old Apache versions stay available to those who have them | Someone can fork 6.14 | Accepted; new work is proprietary |
| Account deletion of a sole owner with other members | The workspace would lose its owner | The database refuses and says to make someone else an owner first |
| Free Actions minutes on a private repository | Builds stop for the month | Builds on tags and on demand only (section 2) |

## 7. Order of work

**Owner, before tagging 7.0**
1. Cloudflare Email Routing for framedecks.com: `hello@`, `security@`, `privacy@` to your inbox (removes the null MX).
2. Create the R2 bucket `framedecks-downloads`, connect the custom domain `downloads.framedecks.com`, create the API
   token, and add the GitHub secrets and variables (section 2).
3. Remove the old `api` redirect rule and DNS record, then deploy the update service:
   `cd infra/update-api && npx wrangler deploy` (it asks you to log in once; it creates the `api.framedecks.com`
   custom domain). Steps 1–3 in detail: `docs/deployment/release-pipeline.md`.
4. Run `hosted/supabase/migrations/0010_link_by_url.sql` (if not yet) and `0011_accounts_legal.sql` in the SQL editor.

**Release**
5. Tag `v6.12`, `v6.13`, `v6.14`, then `v7.0`, while the repository is still public (6.x copies look for new
   versions on GitHub, so they still see 7.0). The workflow builds, uploads to R2 and writes the manifest; framedecks.com/download shows 7.0.
6. Check: https://api.framedecks.com/releases/latest answers, the download works, the SHA-256 matches.

**Then**
7. Make the GitHub repository private (Settings → General → Danger zone → Change visibility).
8. Lawyer review of the legal pages; fill in the governing law.
9. Code signing (Azure Trusted Signing or a certificate), then set the repository variable `RELEASE_SIGNED`
   to `true` (the manifest then says `signed: true`).

**Later (7.1 onwards)**
10. Signed manifests (Ed25519) and Nuitka-compiled program.
11. The workspace looks (the 29 October plan's section 4), then team plans: see section 8.

## 8. Ready for paid team and cloud features

The database is already multi-tenant (organizations, memberships with owner/admin/member, row-level security on every
table), which is the base for every item below. What to add, and where:

| Future feature | Foundation in place | Next step |
| --- | --- | --- |
| Team workspaces, organization management | `organizations`, `memberships`, roles, invitations, audit log | An organization settings page (rename, transfer ownership, delete) |
| Subscription plans | One `organizations` row per paying customer | `subscriptions` table (plan, status, period end) written only by a payment webhook (Stripe or Paddle) in a Worker; features check `organization_plan(org)` in SQL and in the website |
| Premium cloud features | Sync records with `kind`, history, live hold | New record kinds behind `organization_plan` checks |
| Theme synchronization | The plan's `look` record (6.15 plan, section 4) | Build it as planned; premium looks can sit behind the plan check |
| Marketplace | The Content Library in the program | A `catalog_items` table of verified templates and looks, downloaded into the library |
| Enterprise sign-in | Supabase Auth with Google and Microsoft | SAML SSO (Supabase Pro add-on) per organization domain |

## 9. Making it feel like a product, not a GitHub project

Already done in 7.0: one download page, no GitHub links, legal and security pages, an update that installs itself,
a footer like a company's, and documentation on framedecks.com. Next, in order of effect: a signed installer (no
SmartScreen warning), a short product video on the front page, real customer quotes once there are some, a
"What's new" page on the website fed from the same release notes, an installer with the FrameDecks look, a status page
with history (a hosted status service), and a support address that answers within a day.
