# FRAMEDECKS — AI/maintainer guide

Read this first, then [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).

## Non-negotiable rules
- The desktop UI, branding and functions must NOT change. The work is a stack migration to SaaS + PWA only.
- The codebase is the source of truth; verify docs against it.
- Do not touch the legacy LAN remote or let the hosted app call the local HTTP server.
- Never commit secrets. `.env*` is ignored except `hosted/.env.example`.

## Layout
- `app/`, `server.py`, `packaging/` — the unchanged desktop app (Python server, static UI, port 8750).
- `hosted/` — Next.js 16 online-first companion, deployed to Vercel (`framedecks.vercel.app`, Root Directory `hosted`).
- `hosted/supabase/migrations/` — SQL for the tenant foundation.
- `tools/` — generators and checks (`make_emblem_assets.py`, `check_doc_links.py`, `generate_brand_assets.py`).
- `docs/FRAMEDECKS_MODERNIZATION_STATUS.md` — the detailed phase tracker.

## Commands
- Desktop JS tests: `node tests/run.js`; Python: `python -m unittest discover -s tests -p "test_*.py"`; packaging: `python packaging/check.py`.
- Hosted (run inside `hosted/`, there is no root package.json): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Docs: `python tools/check_doc_links.py`, `git diff --check`.

## Gotchas
- `hosted/AGENTS.md`: this Next.js version has breaking changes; read `hosted/node_modules/next/dist/docs/` before writing hosted code.
- The emblem `app/img/kc-emblem.webp` and `hosted/public/framedecks-emblem.webp` must stay identical. Regenerate all emblem/icon files with `tools/make_emblem_assets.py` (master: `assets/brand/framedecks-emblem.svg`).
- The repo auto-commits as "Update project files and documentation"; check `git status` before committing.
