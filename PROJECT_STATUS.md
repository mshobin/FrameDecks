# PROJECT STATUS

Last verified: 25 October 2026 against commit `ab38a40` on `main` (pushed; Vercel serves the new emblem and `framedecks-shell-v2` cache). Detail lives in
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
- Check emblem in tray icon and a packaged Windows build; visual QA of the new logo in light theme, teleprompter, remote and speaker pages.

## Technical Debt
- RLS tests run on PGlite with a stubbed `auth.uid()`, not real Supabase; live-database tests are still needed.
- `npm audit`: high findings in the dev-only ESLint tree (not applied: fix would downgrade `eslint-config-next`).
- Emblem is now a vector master (`assets/brand/framedecks-emblem.svg`); the wordmark in the horizontal/stacked logos is still cropped from the legacy raster `framedecks-logo-source.png`, so it is the only raster-limited part of the brand set.
- Older audit docs still reference version 6.6.

## Risks
- Vercel Root Directory `hosted` is assumed from the working deployment, not read from the dashboard.
- Logo rebuild unverified in: light theme, teleprompter, remote and speaker pages, tray icon. Checked: the 16px favicon is faint on light tab backgrounds because the outline is thin (32px is fine); a heavier-stroke small-size variant would fix it but changes the approved mark, so it needs owner approval.
- Service worker caching must never cover `/api/` or `/auth/` once auth exists (guarded and tested).

## Assumptions
- Hosted companion is online-first and separate from the LAN remote.

## Blockers
- Supabase project URL and anon key, and OAuth client credentials, must come from the owner.

## Recommended Next Task
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).
