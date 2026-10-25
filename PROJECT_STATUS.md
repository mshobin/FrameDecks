# PROJECT STATUS

Last verified: 25 October 2026 against `main` at `ca463f2`, merged into `claude/peaceful-albattani-6m445e` (PR #7, the
6.10 Quit fix): desktop JS 3/3, Python OK, `packaging/check.py` (6.10), doc links 0 problems, hosted test 15/15,
lint, typecheck and build pass. Detail lives in
[docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md).

## Completed
- Desktop app preserved unchanged; branding migrated; approved gold-outline transparent emblem (reproducible via `tools/make_emblem_assets.py`; horizontal/stacked logos via `tools/generate_brand_assets.py`, README header via `tools/make_readme_header.py`).
- Hosted Next.js shell in `hosted/` with the desktop navy/gold theme; CI (`.github/workflows/hosted.yml`); live at `https://framedecks.vercel.app/` (HTTP 200, verified).
- PWA manifest, safe shell service worker, production-only registrar; verified locally (registers, caches, loads offline).
- Supabase tenant migration `0001_tenant_foundation.sql`; row-level-security behaviour is now an in-repo test (`hosted/tests/supabase-rls.test.mjs`, in-memory Postgres via dev-only `@electric-sql/pglite`): 8 test groups covering 16 checks pass.

## In Progress
- Phase 3 (auth): the owner created the Supabase project (`slrsykiknlqlivlnpvrb`) and ran the tenant migration in the
  SQL editor (25 October; its result not yet confirmed in writing). The sign-in UI is built (`/sign-in`, `/auth/callback`,
  top-bar account chip; emailed link, Google/Microsoft when enabled), merged (PR #18) and deployed with the Vercel
  variables. **The owner signed in on the live site with an emailed link (25 October 2026).** Workspace UI built: display name, create a
  workspace (creator becomes owner), list own workspaces with role. Not yet: Google/Microsoft providers, live RLS
  tests, inviting members.

## Pending
- Google/Microsoft providers (owner, optional); live RLS tests; inviting members to a workspace (needs a server-side
  lookup by email, so a Supabase function or a Next.js route with a secret held only in Vercel).
- Real-device PWA install and offline acceptance on the deployed URL.
- Secure device pairing (QR / 6-digit challenge) and runtime channel.
- A person looks at the real tray icon on an installed Windows PC (the icons themselves are checked; see below).

## Technical Debt
- RLS tests run on PGlite with a stubbed `auth.uid()`, not real Supabase; live-database tests are still needed.
- `npm audit`: high findings in the dev-only ESLint tree (not applied: fix would downgrade `eslint-config-next`).
- Emblem is now a vector master (`assets/brand/framedecks-emblem.svg`); the wordmark in the horizontal/stacked logos is still cropped from the legacy raster `framedecks-logo-source.png`, so it is the only raster-limited part of the brand set.
- Older audit docs still reference version 6.6.

## Risks
- Vercel Root Directory `hosted` is assumed from the working deployment, not read from the dashboard.
- Logo checked on 25 October 2026 ([logo visual QA](docs/qa/2026-10-25-logo-visual-qa.md)): clear in both themes, the
  Speaker/Teleprompter header and the remote. The faint 16 px favicon and 16–20 px tray icon on light backgrounds are fixed by a
  heavier small-size emblem (owner-approved; used only at 16–32 px). The program icon (.ico) carries the new emblem. Unchecked: the real tray
  on an installed PC.
- **Repository drift: parallel work outside `main` contradicts its decisions** (see "Drift" below).
- Service worker caching must never cover `/api/` or `/auth/` once auth exists (guarded and tested).

## Drift (found and resolved 25 October 2026)
Pull requests from an earlier workstream predated `main`'s choices and conflicted with them. Decision (owner asked for
the recommended course): `main`'s plan stands. #7 was brought up to date and merged; #8–#16 were closed with a note.
Their branches are kept, so any of them can be reopened or mined:

| PR | What | Outcome |
|---|---|---|
| #7 | 6.10: Quit really quits (desktop fix) | Merged after `main` was merged in and every check passed. |
| #8 | Flutter port of the Studio and phone remote | Closed: outside `main`'s plan. Branch `claude/flutter-platform`. |
| #9, #10 | Windows 11 and Mac virtual cameras | Closed: desktop function change. Branches `claude/windows11-camera`, `claude/mac-camera`. |
| #11 | SaaS + PWA architecture (Cloudflare) | Closed: `main` uses Vercel + Supabase. Branch `claude/saas-pwa-architecture`. |
| #12 | Alternative rename, logo and Decks model | Closed: `main` has its own approved emblem; desktop UI frozen. Branch `claude/framedecks-branding`. |
| #13–#16 | SaaS Phases 1–4 on Cloudflare | Closed: different backend. Branches `claude/saas-phase1` … `claude/saas-phase4`; unfinished `claude/saas-phase5`. |

**Worth reusing when `main` reaches these steps** (designs and tests, not the Cloudflare code):
- Secure device pairing (`main` Phase 5): `docs/architecture/pairing-protocol.md` on `claude/saas-phase4`: 5-minute
  QR / 6-digit code, approval at the PC, X25519 key agreement bound to the QR or six check digits, AES-GCM sealed
  messages with replay counters, roles enforced by the runtime, revoke in under a second; phone and PC crypto checked
  against one shared test vector (`tests/pair-crypto.test.js`, `tools/make_pairing_vector.py`).
- Runtime channel: `docs/architecture/relay-protocol.md` (same branch): the PC connects outward; relayed requests are
  replayed on a listener that treats them as a phone, never as the PC, so the remote's allow-list and roles hold.
- Metadata sync (`main` Phase 4): `docs/architecture/cloud-api.md` and `app/js/entities.js` on `claude/saas-phase2`:
  per-record revisions, a workspace sequence, conflict rules ("never lose a Frame"), members end-to-end encrypted with
  a recovery key, and a two-computer test harness.

## Assumptions
- Hosted companion is online-first and separate from the LAN remote.

## Blockers
- Supabase project URL and anon key, and OAuth client credentials, must come from the owner.

## Recommended Next Task
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).
