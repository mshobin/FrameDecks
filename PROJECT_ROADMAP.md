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
| Control a service from the companion (Phase 5) | Design agreed ([remote-control.md](docs/architecture/remote-control.md), R1–R5 as recommended); steps 1–3 built (database `0004`/`0005`, PC side `cloud_remote.py` and window bridge, Settings switch, companion Live page, "Can run services"); step 4 (live test by the owner) next |
| Edit services in the companion (D3 "next step") | Design agreed ([companion-editing.md](docs/architecture/companion-editing.md), E1–E4 as recommended); steps 1–2 built (editing helpers, Services page editing) plus Frame history and restore (30 days); step 3 (live test by the owner) next |
| Owner's live tests (sync, phone control, editing, history) | Written up as one pass: [live-test-guide.md](docs/qa/live-test-guide.md); waiting for the owner |
| Architecture audit follow-up ([audit](docs/project/2026-10-25-architecture-audit.md) §9) | Phase 1 built on PR #32: P1–P4 (per-press I/O and sync, image and screen-capture memory), C2 crash watchdog. Code signing: free via SignPath Foundation once open source (M-D1) |
| Stream Deck plugin (owner's choice) | Built on PR #32 (`streamdeck/`, CI artifact); owner tests it on a PC with a Stream Deck |
| Target architecture migration ([review](docs/architecture-review.md), [plan](docs/migration-plan.md)) | Review and plan written; steps 1–3 built ([report](docs/post-migration-report.md): audit log `0006`, owner runs it; ESV key in Credential Manager; missing-media check); steps 4–8 wait for owner decisions M-D1–M-D6 |
| Real-device PWA acceptance, operations | Later |
| Packaged Windows run, tray icon check | Installer builds pass on GitHub; a person still checks the tray icon and sync's key storage on an installed PC |
| Logo visual QA (light theme, teleprompter, remote, speaker, 16px favicon) | Done 25 Oct ([report](docs/qa/2026-10-25-logo-visual-qa.md)); heavier small-size emblem added for 16–32 px |
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Done 25 Oct: `main`'s plan stands; #8–#16 closed, branches kept |
