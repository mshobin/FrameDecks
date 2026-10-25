# NEXT SESSION HANDOFF

## Completed
Hosted shell live on Vercel; PWA manifest and service worker verified locally; tenant migration with an in-repo RLS test (`hosted/tests/supabase-rls.test.mjs`, PGlite, dev-only); transparent emblem pipeline (approved gold-outline vector logo; master `assets/brand/framedecks-emblem.svg`, derivatives via `tools/make_emblem_assets.py`); continuity files created. Hosted `npm test` (15), lint, typecheck and build pass.

## In Progress
Phase 3 Supabase auth: scaffold only (`hosted/supabase/migrations/0001_tenant_foundation.sql`, `hosted/src/lib/supabase-config.ts`, `hosted/.env.example`).

## Pending
Sign-in UI, provider setup, live RLS tests, device pairing, real-device PWA test.

## Technical Debt
See [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Risks
Vercel Root Directory unverified in dashboard; UI additions (sign-in) must match the existing navy/gold design.

## Assumptions
Hosted app is separate from the LAN remote and online-first.

## Blockers
Owner must create the Supabase project and provide the URL and anon key (never the service_role key or OAuth secrets), and set them in Vercel.

## Recommended Next Task
Blocked on owner credentials. When the Supabase URL and anon key exist: add `@supabase/supabase-js`, a sign-in page reusing the existing hosted styles (`hosted/src/app/globals.css`), env-gated by `readSupabaseConfig()` so the site still works without keys. Read the Next.js docs in `hosted/node_modules/next/dist/docs/` first. Then run the same cases as `hosted/tests/supabase-rls.test.mjs` against the live project.
Without credentials, the best credential-free task is the logo visual QA: light theme, teleprompter, remote and speaker pages (server on port 8750), 16px favicon legibility, then the tray-icon and packaged-Windows emblem check (needs a Windows build). Note: bump the `CACHE` name in `hosted/public/sw.js` whenever hosted emblem files change (now `framedecks-shell-v2`). Emblem files come from `tools/make_emblem_assets.py`; the horizontal/stacked logos (including `hosted/public/framedecks-logo-horizontal.png`) from `tools/generate_brand_assets.py`.

## Files Likely To Change Next
`hosted/package.json`, `hosted/src/app/` (new sign-in route), `hosted/src/lib/`, `hosted/tests/`, `docs/FRAMEDECKS_MODERNIZATION_STATUS.md`, `PROJECT_STATUS.md`.

## Session Handoff
Run `git status`, then the hosted checks (`npm test`, `lint`, `typecheck`, `build` in `hosted/`) and `python tools/check_doc_links.py` before and after any change. Update this file and `PROJECT_STATUS.md` at the end of each session.
