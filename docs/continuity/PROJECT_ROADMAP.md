# PROJECT ROADMAP

Phases follow [FRAMEDECKS_MODERNIZATION_STATUS.md](../FRAMEDECKS_MODERNIZATION_STATUS.md), which is authoritative for detail.
Updated 28 October 2026. FrameDecks 6.11.2 (maintenance: repository layout, trust fixes) is published at `v6.11.2` (verified after the reorganization; licence and lint-config follow-ups on `main`), after 6.11.1 (`v6.11.1`); the README/release header wordmark was refreshed in PR #38; trust fixes (#39), the Windows budget-script fix and five Action upgrades (#33–#37) are on `main`, all green. The live Supabase database has every script, `0001`–`0009` (`0009` run 27 October).
Repository clean-up is merged (modules in `src/`, docs in `.github/` and `legal/`); the maintainer guide is [PROJECT_GUIDE.md](PROJECT_GUIDE.md) (active references updated), and the Windows batch launchers are in `tools/launchers/`. They resolve the repository root before running. No application behaviour change. The frozen build was tested here; the next tag still runs the real installer workflow.
| Step | State |
|---|---|
| Audit, branding, architecture decisions | Done |
| Hosted Next.js companion + CI + Cloudflare Pages | Done (Vercel remains until retired) |
| PWA manifest + safe service worker | Done (device acceptance pending) |
| Tenant schema + RLS | Done; tested in-repo on PGlite; all scripts `0001`–`0009` run in live Supabase (`0001`–`0008` 26 Oct, `0009` 27 Oct); live RLS tests pending |
| Supabase project, providers, sign-in UI | Done for emailed links (live sign-in confirmed 25 Oct); Google/Microsoft need owner setup |
| Workspaces, members, invitations | Built; workspaces confirmed live; invitations to be tested live with Google/Microsoft later |
| Live RLS tests against Supabase | Needs `*.supabase.co` allowed in the cloud environment |
| Sync service plans (metadata only) | Design agreed ([metadata-sync.md](../architecture/metadata-sync.md)); steps 1–4 built (database, record mapping, PC sync + Settings section, companion Services / Members / Computers); step 5 (live test by the owner) next |
| Control a service from the companion (Phase 5) | Design agreed ([remote-control.md](../architecture/remote-control.md), R1–R5 as recommended); steps 1–3 built (database `0004`/`0005`, PC side `src/cloud_remote.py` and window bridge, Settings switch, companion Live page, "Can run services"); step 4 (live test by the owner) next |
| Edit services in the companion (D3 "next step") | Design agreed ([companion-editing.md](../architecture/companion-editing.md), E1–E4 as recommended); steps 1–2 built (editing helpers, Services page editing) plus Frame history and restore (30 days); step 3 (live test by the owner) next |
| Owner's live tests (sync, phone control, editing, history, members, new PC features) | One pass, tests A–F: [live-test-guide.md](../qa/live-test-guide.md); database ready (26 Oct); waiting for the owner's tests |
| Architecture audit follow-up ([audit](../project/2026-10-25-architecture-audit.md) §9) | Phase 1 built on PR #32: P1–P4, C2 crash watchdog. C1: signing ready (SignPath, M-D1), auto-update not designed yet |
| Stream Deck plugin | Removed 26 October (owner's request) |
| Target architecture migration ([review](../architecture-review.md), [plan](../migration-plan.md), [report](../post-migration-report.md)) | All 8 steps built on PR #32 (owner decisions M-D1–M-D6, 25 Oct): audit log, ESV key, missing-media check, API grants, licence and signing, members from the cloud, free AI (Ollama), PowerPoint export and Audio, member groups. Merged; database scripts run live (26 Oct). Next: live tests |
| Free for everyone ([free-hosting.md](../deployment/free-hosting.md)) | In progress: 1 static companion (live at framedecks.pages.dev); 2 keep-alive and encrypted backup (live, first runs green); 3 fewer database requests (done); 4 sign-in providers first (live: Google and Microsoft; Brevo skipped); 5 public repo, signing, Releases (owner) |
| 6.11: plan on the website ([meeting-form.md](../architecture/meeting-form.md)) | In progress: 1 camera check and Open FrameDecks link (built); 2 website Meeting Form (built); 3 Excel into Settings, version 6.11 (built); owner test G. 6.12 removes Excel after the owner's test (W3) |
| Camera renamed FRAMECAST; v6.11 release notes | Built; v6.11 release published with the installer (26 October) |
| Audit roadmap step 2 (support bundle, update notice, CI checks, one OpenCV, non-blocking windows) | Built (26 October), ships in 6.11.1 |
| Design audit rank 1 (DD-01: every camera label says FRAMECAST, with a test) | Built (26 October), ships in 6.11.1 |
| Design audit ranks 2–4 (DD-03 first run, DD-02 overlaps and empty states, DD-13 command bar words) | Built (26 October), ships in 6.11.1 |
| Design audit ranks 5–7, 9–11 (website dates, phone tab bar, landing, destructive actions, contrast, card previews) | Built (26 October); website live on deploy, program part in 6.11.1 |
| Design audit ranks 8, 12–21 (voice, states, type, icons, a11y, gold, composer, tokens + lint, design system + visual checks, Overview, light theme) | Built (26 October); the whole design roadmap is done |
| UX simplification (Prepare / Run, Practice, How people see it, Advanced, People, Live tools groups, glossary, website Running order and trust strip) | Built (27 October). Owner: Test H (live test guide) on Windows |
| Re-audit steps to 90+ (palette, radii/shadows, `!important`, lazy sections, axe scan in CI) | Built (27 October). Left for the owner: Windows check, a screen-reader pass (NVDA/Narrator), a real quote or usage fact for the landing page |
| Landing brief: FrameDecks spelling, every audience, motion back, About in Light | Built (27 October). Owner: About story wording, program presets |
| 10/10 plan: phases 1–2, owner-free parts of 3–4 (website four places, Plan, Home, first-time path, Help, identity, landing, Run polish) | Built (27 October). Owner: Test I; go-ahead for projector legibility, templates by type, the Wi-Fi remote; real quotes and photos |
| Trust fixes (safe service errors, branded confirmations, current public copy) | Merged in PR #39 (`27cfb4b`); local checks and preview deployments passed; production verification and owner live tests remain |
| 6.11.1: production audit steps 1–2 (`docs/project/2026-10-26-production-audit.md`) | Built and published (27 October); `0009` run by the owner (27 October). Next: step 3 (live tests, M9, M7) |
| Website idle performance (no endless animations, less blur) | Built and live on push (26 October) |
| First-install fixes: website "Forbidden", Teleprompter unpin, Settings menu | Built on `main` (26 October); owner tests from the next build |
| Website settings from the PC | Built: Branding, Transition style, Birthdays this week. Later, if wanted: email wording, card looks |
| Hosting long term ([hosting.md](../architecture/hosting.md)) | Companion is live on Cloudflare Pages (static); Vercel remains until retired. Supabase Free → Pro when churches depend on it |
| Later (not designed yet) | Asset references (size/hash) across PCs; on-screen missing-media line (needs approval); auto-update; a shared Template Store |
| Real-device PWA acceptance, operations | Later |
| Packaged Windows run, tray icon check | Installer builds pass on GitHub; a person still checks the tray icon and sync's key storage on an installed PC |
| Logo visual QA (light theme, teleprompter, remote, speaker, 16px favicon) | Done 25 Oct ([report](../qa/2026-10-25-logo-visual-qa.md)); heavier small-size emblem added for 16–32 px |
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Done 25 Oct: `main`'s plan stands; #8–#16 closed, branches kept |
