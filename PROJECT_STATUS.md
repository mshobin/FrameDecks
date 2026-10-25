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
- Phase 3 (auth): scaffold only; no Supabase project, providers or sign-in UI.

## Pending
- Create Supabase project, apply migration, enable Email/Google/Microsoft, sign-in UI, live RLS tests.
- Real-device PWA install and offline acceptance on the deployed URL.
- Secure device pairing (QR / 6-digit challenge) and runtime channel.
- Check the emblem in the tray icon and a packaged Windows build.
- Owner decision on the 16 px favicon (faint on light tabs; see the logo QA below).

## Technical Debt
- RLS tests run on PGlite with a stubbed `auth.uid()`, not real Supabase; live-database tests are still needed.
- `npm audit`: high findings in the dev-only ESLint tree (not applied: fix would downgrade `eslint-config-next`).
- Emblem is now a vector master (`assets/brand/framedecks-emblem.svg`); the wordmark in the horizontal/stacked logos is still cropped from the legacy raster `framedecks-logo-source.png`, so it is the only raster-limited part of the brand set.
- Older audit docs still reference version 6.6.

## Risks
- Vercel Root Directory `hosted` is assumed from the working deployment, not read from the dashboard.
- Logo checked on 25 October 2026 ([logo visual QA](docs/qa/2026-10-25-logo-visual-qa.md)): clear in both themes, the
  Speaker/Teleprompter header and the remote. Still faint: the 16 px favicon on light tabs (needs owner approval for a
  heavier small-size variant). Unchecked: tray icon, packaged Windows run.
- **Repository drift: parallel work outside `main` contradicts its decisions** (see "Drift" below).
- Service worker caching must never cover `/api/` or `/auth/` once auth exists (guarded and tested).

## Drift (found 25 October 2026)
Open pull requests from an earlier workstream predate `main`'s choices and conflict with them. None is merged; each
needs an owner decision (keep, rework onto `main`'s stack, or close):

| PR | What | Conflict with `main` |
|---|---|---|
| #7 | 6.10: Quit really quits (desktop fix) | None now: `main` merged in, conflicts resolved, checks pass. Ready to review. |
| #8 | Flutter port of the Studio and phone remote | Old name `kingdom_connect_app`; not part of `main`'s plan. |
| #9, #10 | Windows 11 and Mac virtual cameras | Old camera name; desktop function change. |
| #11 | SaaS + PWA architecture (Cloudflare Workers + D1) | `main` chose Next.js on Vercel + Supabase. |
| #12 | FrameDecks rename, its own logo, Decks (Frame → Deck → Content), FrameCast | Different logo from `main`'s approved emblem; changes desktop UI. |
| #13–#16 | SaaS Phases 1–4 on Cloudflare: sync, members E2E, relay remote, pairing (sealed X25519/AES-GCM) | Different backend; adds desktop Settings and touches `server.py`/`remote.html` (remote pixel-identical by test). Their pairing and relay designs may still be reusable for `main`'s "secure device pairing" step. |
| branch `claude/saas-phase5` | Unfinished Mac runtime (WIP, no PR) | Paused pending the decision above. |

## Assumptions
- Hosted companion is online-first and separate from the LAN remote.

## Blockers
- Supabase project URL and anon key, and OAuth client credentials, must come from the owner.

## Recommended Next Task
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).
