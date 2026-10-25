# PROJECT ROADMAP

Phases follow [docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md), which is authoritative for detail.

| Step | State |
|---|---|
| Audit, branding, architecture decisions | Done |
| Hosted Next.js shell + CI + Vercel | Done |
| PWA manifest + safe service worker | Done (device acceptance pending) |
| Tenant schema + RLS | Done; tested in-repo on PGlite; live Supabase DB pending |
| Supabase project, providers, sign-in UI | Done for emailed links (live sign-in confirmed 25 Oct); Google/Microsoft need owner setup |
| Workspaces, members, invitations | Built; workspaces confirmed live; invitations to be tested live with Google/Microsoft later |
| Live RLS tests against Supabase | Needs `*.supabase.co` allowed in the cloud environment |
| Sync service plans (metadata only) | Design agreed ([metadata-sync.md](docs/architecture/metadata-sync.md)); steps 1–4 built (database, record mapping, PC sync + Settings section, companion Services / Members / Computers); step 5 (live test by the owner) next |
| Control a service from the companion (Phase 5) | Design agreed ([remote-control.md](docs/architecture/remote-control.md), R1–R5 as recommended); step 1 (database `0004_remote.sql`) and step 2 (PC side: `cloud_remote.py`, window bridge) built; step 3 (Settings switch, companion Live page) next |
| Real-device PWA acceptance, operations | Later |
| Packaged Windows run, tray icon check | Installer builds pass on GitHub; a person still checks the tray icon and sync's key storage on an installed PC |
| Logo visual QA (light theme, teleprompter, remote, speaker, 16px favicon) | Done 25 Oct ([report](docs/qa/2026-10-25-logo-visual-qa.md)); heavier small-size emblem added for 16–32 px |
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Done 25 Oct: `main`'s plan stands; #8–#16 closed, branches kept |
