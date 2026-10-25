# NEXT SESSION HANDOFF

## Completed
Hosted shell live on Vercel; PWA manifest and service worker verified locally; tenant migration with an in-repo RLS test (`hosted/tests/supabase-rls.test.mjs`, PGlite, dev-only); transparent emblem pipeline (approved gold-outline vector logo; master `assets/brand/framedecks-emblem.svg`, derivatives via `tools/make_emblem_assets.py`). On 25 October, local browser QA confirmed the emblem on the light-theme desktop header, light-theme teleprompter/speaker window, and dark remote page. This work started from `ca463f2` on `main`, synchronized with `origin/main`; the working tree now contains the documented, uncommitted changes from this session. Hosted checks pass after the Phase 4 contract addition.
Phase 4 has begun: `hosted/src/lib/sync/contracts.mts` defines a strict v1 metadata-only presentation and operation contract, size limits, opaque media references, idempotent queue primitives, and explicit revision conflict results. Tests in `hosted/tests/sync-contract.test.mjs` reject local-path/raw-media fields and cover serialization, limits, retries, and conflicts. This does not persist an outbox or contact a server.

## In Progress
Phase 3 Supabase auth: scaffold only (`hosted/supabase/migrations/0001_tenant_foundation.sql`, `hosted/src/lib/supabase-config.ts`, `hosted/.env.example`).

## Pending
Phase 4 import/export bridge for 6.9 state, representative lossless round-trip fixtures, durable local outbox, authenticated server synchronization, sign-in UI, provider setup, live RLS tests, device pairing, real-device PWA test, and a packaged Windows run to verify the tray icon. No packaged build exists; PyInstaller and OpenCV are absent in this environment.

## Technical Debt
See [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Risks
Vercel Root Directory unverified in dashboard; UI additions (sign-in) must match the existing navy/gold design. The 16px favicon is faint on light tab backgrounds; do not change the approved emblem without owner approval. The packaged tray icon has not been run; `desktop_app.py` uses `app/icons/remote-192.png`.

## Assumptions
Hosted app is separate from the LAN remote and online-first.

## Blockers
Owner must create the Supabase project and provide the URL and anon key (never the service_role key or OAuth secrets), and set them in Vercel.

## Recommended Next Task
Blocked on owner credentials. When the Supabase URL and anon key exist: add `@supabase/supabase-js`, a sign-in page reusing the existing hosted styles (`hosted/src/app/globals.css`), env-gated by `readSupabaseConfig()` so the site still works without keys. Read the Next.js docs in `hosted/node_modules/next/dist/docs/` first. Then run the same cases as `hosted/tests/supabase-rls.test.mjs` against the live project.
Next: implement and test the Phase 4 6.9 import/export bridge using dry-run validation and representative fixtures, then design durable outbox persistence. Keep network sync disabled until tenant/auth and server authorization are ready. Separately, Phase 3 remains blocked on owner credentials. For remaining branding QA, use an isolated environment for the Windows build: `python -m PyInstaller --version` currently fails because PyInstaller is absent; `python packaging/check.py` passes but reports OpenCV is not installed. The 16px favicon remains faint; retain the approved mark unless the owner approves a size-specific design. Note: bump the `CACHE` name in `hosted/public/sw.js` whenever hosted emblem files change (now `framedecks-shell-v2`). Emblem files come from `tools/make_emblem_assets.py`; the horizontal/stacked logos (including `hosted/public/framedecks-logo-horizontal.png`) from `tools/generate_brand_assets.py`.

## Files Likely To Change Next
`hosted/package.json`, `hosted/src/app/` (new sign-in route), `hosted/src/lib/`, `hosted/tests/`, `docs/FRAMEDECKS_MODERNIZATION_STATUS.md`, `PROJECT_STATUS.md`.

## Session Handoff
Run `git status`, then the hosted checks (`npm test`, `lint`, `typecheck`, `build` in `hosted/`) and `python tools/check_doc_links.py` before and after any change. Update this file and `PROJECT_STATUS.md` at the end of each session.
