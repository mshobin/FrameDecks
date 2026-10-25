# FRAMEDECKS — AI/maintainer guide

Read this first, then [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).

## Non-negotiable rules
- The desktop UI, branding and functions must NOT change. The work is a stack migration to SaaS + PWA only.
  Owner-approved exceptions: the heavier 16–32 px emblem and one Settings section, "FRAMEDECKS account" (sync, D1 in
  `docs/architecture/metadata-sync.md`).
- The codebase is the source of truth; verify docs against it.
- Do not touch the legacy LAN remote or let the hosted app call the local HTTP server.
- Never commit secrets. `.env*` is ignored except `hosted/.env.example`. Never the Supabase `service_role` key; the
  publishable key goes only in Vercel and `hosted/.env.local`. A PC's sync key lives in Windows Credential Manager
  (`kc-sync.json` and `.kc-sync-key` are git-ignored).
- Sync never sends media or anything live, and never changes the Frame that is on screen (see the design).

## Layout
- `app/`, `server.py`, `packaging/` — the unchanged desktop app (Python server, static UI, port 8750).
- `sync_entities.py` (plan ⇄ sync records) and `cloud_sync.py` (background sync, linking; off until a PC is linked) —
  Phase 4, wired into `server.py` (`SYNC`, `/api/sync`) and Settings (`app/js/account.js`).
- `hosted/` — Next.js 16 online-first companion, deployed to Vercel (`framedecks.vercel.app`, Root Directory `hosted`).
- `hosted/supabase/migrations/` — SQL run in order in the Supabase SQL editor: `0001` workspaces, `0002` invitations,
  `0003` sync. Never edit one that has been run; add the next number.
- `tools/` — generators and checks (`make_emblem_assets.py`, `check_doc_links.py`, `generate_brand_assets.py`).
- `docs/FRAMEDECKS_MODERNIZATION_STATUS.md` — the detailed phase tracker; `docs/architecture/metadata-sync.md` — the
  agreed sync design and its delivery steps; `docs/architecture/remote-control.md` — the Phase 5 proposal (controlling
  a service from the companion), awaiting the owner's decisions R1–R5.
- Continuity: `CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, `.ai/NEXT_SESSION.md`.
- `hosted/src/app/{services,members,computers}` — the synced plan (view only), the member list (owners/admins) and
  linking PCs; `hosted/src/components/app-shell.tsx` is the shared sidebar and top bar.

## Keeping the handoff current (owner's rule)
- Update all four continuity files (`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, `.ai/NEXT_SESSION.md`)
  at the end of **every** step, in the same PR as the work: what is done, what is live, what the owner must do next.
- In long steps, push work in progress with the four files describing the partial state, so a session cut off by a
  usage limit still leaves a correct handoff.

## Commands
- Desktop JS tests: `node tests/run.js`; Python: `python -m unittest discover -s tests -p "test_*.py"`; packaging: `python packaging/check.py`.
- Hosted (run inside `hosted/`, there is no root package.json): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
  `npm test` applies every migration to in-memory Postgres (PGlite) and loads `src/lib/sync-entities.ts` with Node's
  type stripping.
- Sync fixtures: `python tools/make_sync_fixtures.py` rebuilds `tests/fixtures/sync/` (needs Node) after changing
  `store.js` normalize or the record mapping; `tests/sync-fixtures.test.js` says when.
- Docs: `python tools/check_doc_links.py`, `git diff --check`.

## Gotchas
- `hosted/AGENTS.md`: this Next.js version has breaking changes; read `hosted/node_modules/next/dist/docs/` before writing hosted code.
- The emblem `app/img/kc-emblem.webp` and `hosted/public/framedecks-emblem.webp` must stay identical. Regenerate all emblem/icon files with `tools/make_emblem_assets.py` (master: `assets/brand/framedecks-emblem.svg`).
- The repo auto-commits as "Update project files and documentation"; check `git status` before committing.
- Browser code must name each `NEXT_PUBLIC_` variable in full (`publicSupabaseEnv()`), or Next.js does not inline it.
- In SQL permission checks, wrap comparisons that can be null in `coalesce(…, false)`: a null makes an `IF` skip the
  refusal (a test caught this in `computer_revoke`).
- This cloud environment cannot reach `*.supabase.co` or Vercel preview hosts: test hosted features against stand-in
  responses (Playwright `page.route`) and leave live checks to the owner.
