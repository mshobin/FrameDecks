# NEXT SESSION HANDOFF

## Completed
25 October 2026 (this session): `main` merged into the 6.10 branch (PR #7) with conflicts resolved and all checks
passing; the installer's 6.10 "close a running copy" step fixed to end `FRAMEDECKS.exe`; logo visual QA done
([docs/qa/2026-10-25-logo-visual-qa.md](../docs/qa/2026-10-25-logo-visual-qa.md)); repository drift recorded in
[PROJECT_STATUS.md](../PROJECT_STATUS.md) ("Drift").
Earlier: Hosted shell live on Vercel; PWA manifest and service worker verified locally; tenant migration with an in-repo RLS test (`hosted/tests/supabase-rls.test.mjs`, PGlite, dev-only); transparent emblem pipeline (approved gold-outline vector logo; master `assets/brand/framedecks-emblem.svg`, derivatives via `tools/make_emblem_assets.py`); continuity files created. Hosted `npm test` (15), lint, typecheck and build pass.

## In Progress
Phase 3 Supabase auth: project `slrsykiknlqlivlnpvrb` exists and the owner ran the migration. Sign-in UI built (`hosted/src/app/sign-in/`, `hosted/src/app/auth/callback/`, `hosted/src/components/{sign-in-form,auth-callback,account-status,auth-shell}.tsx`, `hosted/src/lib/supabase-browser.ts`); merged (PR #18), deployed, and confirmed by the owner: emailed-link sign-in works on the live site (25 October 2026). This cloud environment's network policy blocks `*.supabase.co` and the Vercel preview hosts, so live checks are the owner's until that is allowed.

## Pending
Provider setup (Google/Microsoft, owner), live RLS tests (needs `*.supabase.co` allowed in this environment's network settings), organizations/profile UI, device pairing, real-device PWA test.

## Technical Debt
See [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Risks
Closed PRs #8–#16 (Cloudflare SaaS, Flutter, cameras, alternative branding) are not `main`'s plan; reuse only the
designs listed in PROJECT_STATUS.md "Worth reusing".
Vercel Root Directory unverified in dashboard; UI additions (sign-in) must match the existing navy/gold design.

## Assumptions
Hosted app is separate from the LAN remote and online-first.

## Blockers
Owner must create the Supabase project and provide the URL and anon key (never the service_role key or OAuth secrets), and set them in Vercel.

## Recommended Next Task
Sign-in works live, and the workspace panel (display name, create workspace, list with role: `hosted/src/components/workspace-panel.tsx`, session hook `hosted/src/lib/use-session.ts`) is merged (PR #19) and confirmed live by the owner: name saved, workspace "BSF Study" created as Owner. Next: inviting members (needs a server-side email lookup) and the same cases as `hosted/tests/supabase-rls.test.mjs` against the live project (allow `*.supabase.co` in the environment's network settings first). The public values are URL `https://slrsykiknlqlivlnpvrb.supabase.co` and the publishable key the owner gave (public by design; keep it out of the repo all the same, in `.env.local`). Read the Next.js docs in `hosted/node_modules/next/dist/docs/` before writing hosted code.
Without credentials: the logo QA is done, PR #7 (6.10) is merged, and the heavier small-size emblem (`assets/brand/framedecks-emblem-small.svg`, 16–32 px only: favicons, `app/icons/tray-64.png`, small .ico images) is in. Remaining credential-free step: a person checks the real tray icon on an installed PC. Note: bump the `CACHE` name in `hosted/public/sw.js` whenever hosted emblem files change (now `framedecks-shell-v2`). Emblem files come from `tools/make_emblem_assets.py`; the horizontal/stacked logos (including `hosted/public/framedecks-logo-horizontal.png`) from `tools/generate_brand_assets.py`.

## Files Likely To Change Next
`hosted/package.json`, `hosted/src/app/` (new sign-in route), `hosted/src/lib/`, `hosted/tests/`, `docs/FRAMEDECKS_MODERNIZATION_STATUS.md`, `PROJECT_STATUS.md`.

## Session Handoff
Run `git status`, then the hosted checks (`npm test`, `lint`, `typecheck`, `build` in `hosted/`) and `python tools/check_doc_links.py` before and after any change. Update this file and `PROJECT_STATUS.md` at the end of each session.
