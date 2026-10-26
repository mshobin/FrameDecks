# PROJECT ROADMAP

Phases follow [docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md), which is authoritative for detail.
Updated 26 October 2026. PR #32 is merged; the live Supabase database has every script (`0001`–`0008`, run by the owner 26 Oct).

| Step | State |
|---|---|
| Audit, branding, architecture decisions | Done |
| Hosted Next.js shell + CI + Vercel | Done |
| PWA manifest + safe service worker | Done (device acceptance pending) |
| Tenant schema + RLS | Done; tested in-repo on PGlite; all scripts `0001`–`0008` run in live Supabase (26 Oct); live RLS tests pending |
| Supabase project, providers, sign-in UI | Done for emailed links (live sign-in confirmed 25 Oct); Google/Microsoft need owner setup |
| Workspaces, members, invitations | Built; workspaces confirmed live; invitations to be tested live with Google/Microsoft later |
| Live RLS tests against Supabase | Needs `*.supabase.co` allowed in the cloud environment |
| Sync service plans (metadata only) | Design agreed ([metadata-sync.md](docs/architecture/metadata-sync.md)); steps 1–4 built (database, record mapping, PC sync + Settings section, companion Services / Members / Computers); step 5 (live test by the owner) next |
| Control a service from the companion (Phase 5) | Design agreed ([remote-control.md](docs/architecture/remote-control.md), R1–R5 as recommended); steps 1–3 built (database `0004`/`0005`, PC side `cloud_remote.py` and window bridge, Settings switch, companion Live page, "Can run services"); step 4 (live test by the owner) next |
| Edit services in the companion (D3 "next step") | Design agreed ([companion-editing.md](docs/architecture/companion-editing.md), E1–E4 as recommended); steps 1–2 built (editing helpers, Services page editing) plus Frame history and restore (30 days); step 3 (live test by the owner) next |
| Owner's live tests (sync, phone control, editing, history, members, new PC features) | One pass, tests A–F: [live-test-guide.md](docs/qa/live-test-guide.md); database ready (26 Oct); waiting for the owner's tests |
| Architecture audit follow-up ([audit](docs/project/2026-10-25-architecture-audit.md) §9) | Phase 1 built on PR #32: P1–P4, C2 crash watchdog. C1: signing ready (SignPath, M-D1), auto-update not designed yet |
| Stream Deck plugin | Removed 26 October (owner's request) |
| Target architecture migration ([review](docs/architecture-review.md), [plan](docs/migration-plan.md), [report](docs/post-migration-report.md)) | All 8 steps built on PR #32 (owner decisions M-D1–M-D6, 25 Oct): audit log, ESV key, missing-media check, API grants, licence and signing, members from the cloud, free AI (Ollama), PowerPoint export and Audio, member groups. Merged; database scripts run live (26 Oct). Next: live tests |
| Free for everyone ([free-hosting.md](docs/project/free-hosting.md)) | In progress: 1 static companion (live at framedecks.pages.dev); 2 keep-alive and encrypted backup (live, first runs green); 3 fewer database requests (done); 4 sign-in providers first (live: Google and Microsoft; Brevo skipped); 5 public repo, signing, Releases (owner) |
| 6.11: plan on the website ([meeting-form.md](docs/architecture/meeting-form.md)) | In progress: 1 camera check and Open FRAMEDECKS link (built); 2 website Meeting Form (built); 3 Excel into Settings, version 6.11 (built); owner test G. 6.12 removes Excel after the owner's test (W3) |
| Camera renamed FRAMECAST; v6.11 release notes | Built; v6.11 release published with the installer (26 October) |
| Audit roadmap step 2 (support bundle, update notice, CI checks, one OpenCV, non-blocking windows) | Built (26 October), ships in 6.11.1 |
| Design audit rank 1 (DD-01: every camera label says FRAMECAST, with a test) | Built (26 October), ships in 6.11.1 |
| 6.11.1: production audit steps 1–2 (`docs/project/2026-10-26-production-audit.md`) | Built (26 October); owner publishes v6.11.1 and runs `0009`. Next: step 3 (live tests, M9, M7) |
| Website idle performance (no endless animations, less blur) | Built and live on push (26 October) |
| First-install fixes: website "Forbidden", Teleprompter unpin, Settings menu | Built on `main` (26 October); owner tests from the next build |
| Website settings from the PC | Built: Branding, Transition style, Birthdays this week. Later, if wanted: email wording, card looks |
| Hosting long term ([hosting.md](docs/architecture/hosting.md)) | Recommended: companion to Cloudflare (static) before a public launch; Supabase Free → Pro when churches depend on it |
| Later (not designed yet) | Asset references (size/hash) across PCs; on-screen missing-media line (needs approval); auto-update; a shared Template Store |
| Real-device PWA acceptance, operations | Later |
| Packaged Windows run, tray icon check | Installer builds pass on GitHub; a person still checks the tray icon and sync's key storage on an installed PC |
| Logo visual QA (light theme, teleprompter, remote, speaker, 16px favicon) | Done 25 Oct ([report](docs/qa/2026-10-25-logo-visual-qa.md)); heavier small-size emblem added for 16–32 px |
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Done 25 Oct: `main`'s plan stands; #8–#16 closed, branches kept |
