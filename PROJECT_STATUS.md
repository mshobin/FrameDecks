# PROJECT STATUS

Last verified: 27 October 2026. **FrameDecks 6.11.1 is published** at `v6.11.1`; its build and publish workflow passed.
The FrameDecks README/release header image refresh merged in PR #38. The live database has `0001`–`0008`; `0009`
waits for the owner.
- **GitHub:** Desktop checks, Hosted companion checks and Build Windows installer (with the installer smoke test) green.
- **Trust-fix branch checks:** hosted tests 127/127, lint, typecheck, build; manual budget 330 KB JS / 70 KB largest /
  18 KB CSS; desktop JS 4/4; README fact tests 2/2; CSS tokens 14 files / 0 problems; doc links 97 files / 0 problems;
  packaging self-check passed. The full Python suite had 4 errors from missing `cv2` (165 run, 3 skipped). The
  budget script's Windows path handling fails, but the equivalent measurement passed.
- **Next:** the owner's live tests A–I on 6.11.1 (`docs/qa/live-test-guide.md`); see `.ai/NEXT_SESSION.md`.

Phase detail lives in
[docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md); migration results in
[docs/post-migration-report.md](docs/post-migration-report.md).

## Completed
- **Desktop and brand.** Desktop 6.10 and the approved emblem (PRs #7, #18); drift resolved (see "Drift").
- **Hosted companion** on Cloudflare Pages (`hosted/`); Vercel remains until retired.
  - Sign-in (PR #18) and workspaces (PR #19) are **confirmed live**.
  - Members and invitations (PR #20) are built.
- **Phase 4 sync** (PRs #21–#24), **Phase 5 control from the companion** (PRs #25–#27), **companion editing and
  history** (PRs #28–#30), and the live test guide (PR #31). All built and tested against stand-ins; the owner's live
  tests are pending.
- **PR #32 (merged 26 October):**
  - **Audit:** [architecture audit](docs/project/2026-10-25-architecture-audit.md). Its Phase 1 (P1–P4) and the C2
    crash watchdog (`supervisor.py`) are built.
  - Stream Deck plugin (later removed, 26 October, owner's request).
  - **Target-architecture migration:** the [review](docs/architecture-review.md),
    [plan](docs/migration-plan.md) and [report](docs/post-migration-report.md).
    1. Audit log `0006`.
    2. ESV key in Credential Manager.
    3. Missing-media check.
    - Explicit API grants `0007`.
    4. Apache 2.0 licence and SignPath-ready signing.
    5. Members from the cloud.
    6. Free AI with Ollama ("Suggest" questions).
    7. PowerPoint export and Audio Content.
    8. Member groups `0008`.
    - M-D5 hosting recommendation ([hosting.md](docs/architecture/hosting.md)).
- **PR #38 (merged 27 October):** refreshed the README and release header to use the FrameDecks wordmark.

## In Progress
- **6.11** ([meeting-form.md](docs/architecture/meeting-form.md)): built: camera check card and `framedecks://` link; website Meeting Form (`/meeting`);
  Excel moved into Settings → Data / Backup; version 6.11. Owner: live test G; then 6.12 removes Excel (W3).
- **Website polish (26 October):** redesign, motion and About; owners delete workspaces; Branding page, Transition style on
  the Meeting Form, Birthdays this week on the dashboard (synced `brand`, `layout/profile` and member records).
- **Old name removed (26 October):** every Kingdom Connect reference is FrameDecks, except upgrade-only code (CLAUDE.md
  Gotchas). Camera files renamed `framedecks_vcam*.dll`; owner checks the camera after the next install.
- **Audit step 2 (26 October):** built on `main` for 6.11.1 (see NEXT_SESSION); Stream Deck plugin removed.
- **Design audit rank 1 (26 October):** every camera label says FRAMECAST (DD-01), guarded by `tests/test_camera_name.py`; Python 141 OK.
- **Design audit ranks 2–4 (26 October, owner-approved):** first-run Start fresh + Getting started card (DD-03), nothing
  over the Studio canvas and a Teleprompter empty state (DD-02), command bar in words (DD-13); `tests/test_ui_labels.py`;
  Python 147 OK. Checked in a browser at 1920, 1440, 1280 and 1100 px, idle and live.
- **Design audit ranks 5–7, 9–11 (26 October, owner-approved):** website dates, phone tab bar, landing with real
  screenshots (`hosted/public/product/`), destructive styling, 12 px / 4.5:1 labels (website and program), card previews.
  Hosted 114/114, lint, typecheck, build, budget (JS 323 KB); Python 147 OK. Screenshots at 1440 px and 390 px.
- **Design roadmap complete (26 October, owner-approved, ranks 8 and 12–21):** see `docs/design-system.md`. Hosted
  120/120, lint, typecheck, build, budget (JS 329 KB); Python OK incl. `test_css_tokens`; `tools/css_tokens.py` 0
  problems; `tests/visual/layout.mjs` 9/9. Website font is a 47 KB Latin subset in `hosted/public/fonts/`.
- **UX simplification (27 October, owner-approved):** Prepare / Run with Up next, Before you start and Practice mode
  (`app/js/service.js`); How people see it; Advanced; FRAMECAST Fine-tune; Members → People; labelled tabs, worded
  Previous / Next, calm-until-live Hide all, one status pill, grouped Live tools (Esc closes); Black screen; website
  Running order with cross-links and a factual trust strip; `docs/glossary.md`. Checks: Python OK, `node tests/run.js`
  4/4, layout 13/13, axe 0 problems (both themes, Run included), hosted 120/120, budget JS 330 KB. Owner: Test H in
  the live test guide on Windows; a real quote or usage figure for the landing page.
- **Steps to 90+ after the re-audit (27 October):** all program colours in `app/css/palette.css` (`tools/css_palette.py`,
  colour literals now fail `css_tokens.py`), radii/shadows on tokens, `!important` 42 → 16, keyboard editor and About
  story built on first open (2,220 → 1,796 elements), axe WCAG 2.1 AA scan in CI (`tests/visual/a11y.mjs`, 0
  violations in both themes) and its ARIA and light-theme contrast fixes. Not done: a real screen-reader pass and
  a Windows check (owner); a landing quote or usage fact (owner supplies a real one).
- **Landing brief (27 October):** FrameDecks spelling everywhere people read it (identifiers kept); front page for
  every gathering with the approved hero words, Day 1–4, Ready to Serve?, no named streaming products, motion back
  (transform/opacity only, idle page draws nothing); website says team; About readable in Light; neutral product
  pictures. Checks: hosted 124/124, lint, typecheck, budget (CSS 18 KB of 20); Python OK; JS 4/4; layout and axe pass.
  Owner: decide on the About story's wording and the program's church presets; Test I.
- **10/10 plan, phases 1–2 and the owner-free parts of 3–4 (27 October):** website Home · Plan · Live · People with
  Settings (Branding, Service PCs, Help); one Plan page (Meeting Form + running order); next-service Home with
  volunteer actions; first-time steps; Your account; New here? / Welcome back; Help page with version; tablet Live;
  restraint identity (`identity.css`: no glows, frame corners, EB Garamond); rebuilt landing (download first, Next
  demo, week, FAQ, footer); compact transition dropdown and "+ Add a question"; program Run: larger Up next, key
  hints, Practice reminder at service time. Checks: hosted 122/122, lint, typecheck, build, budget JS 325 KB; Python
  OK; JS 4/4; layout and axe pass. Owner: Test I; projector legibility and templates by type wait for a go-ahead.
- **Trust fixes (`fix/trust-layer-errors-confirmations`):** service errors use safe, actionable copy; destructive
  confirmations use a branded dialog; README and hosted companion docs describe the current release and live features.
  Local checks passed as listed above; PR #39's CI and preview deployments passed. After merge, verify production
  deployment; the owner's live tests remain pending.
- **6.11.1 (26 October):** audit steps 1–2 built (pinned build, cross-site guard, error logging, plan recovery and
  sync guard, `0009`); published at `v6.11.1` on 27 October. The owner still needs to run `0009`.
- **Website performance (26 October):** the website no longer animates when idle (older 8 GB PCs next to the program).
- **First-install fixes (26 October):** website "Forbidden" (request identity), Teleprompter unpin freeze, grouped Settings menu; on `main`, not yet in a release.
- **FRAMECAST (26 October):** the virtual camera's new name; v6.11 release published with the installer (the
  first tag build failed on the release-notes step, now fixed).
- **Free plan** ([free-hosting.md](docs/project/free-hosting.md)): steps 1–4 are on `main` (26 October):
  (companion builds as static files; `/api/sync-config` written at build time) and step 2 (keep-alive every 3 days,
  encrypted nightly backup, [restore guide](docs/project/database-backup.md)). Step 3 done (idle
  phone-control polling 5 → 15 s). Step 4 code done (Google/Microsoft
  above the email link). Companion live at `https://framedecks.pages.dev` (the PC now links through it; owner signed in there, 26 October). Part B live (keep-alive and nightly backup green, 26 October). Part D live: Google and Microsoft sign-in work (26 October; Google brand verification pending; Brevo skipped). Owner setup: finish Part A (test, then retire Vercel); Part E.
- Database live: `0001`–`0008` run in Supabase (26 October). Waiting for the owner's live tests A–F
  ([live-test-guide.md](docs/qa/live-test-guide.md)).

## Pending
- **Owner:** install from the latest "Build Windows installer" run on `main` and run the live tests A–F.
- **Owner, before using Audio Content:** update every linked PC (older versions drop Audio Content).
- **Owner, M-D1:** follow [code-signing.md](docs/project/code-signing.md):
  - make the repository public after the checks;
  - apply to SignPath Foundation;
  - add `SIGNPATH_API_TOKEN` and the three `SIGNPATH_*` variables.
- **Later:**
  - Google/Microsoft providers with the invitation test;
  - companion to Cloudflare before a public launch;
  - Supabase Pro when churches depend on it;
  - real-device PWA install test;
  - a person checks the tray icon and Credential Manager on an installed PC;
  - live RLS tests (they need `*.supabase.co` reachable).

## Technical Debt
- **Installer (C1):** unsigned (signing ready, off until SignPath approval); no auto-update yet.
- **Missing media (C8):** found before the service, not shown on screen. Asset references (size/hash) need a design.
- **Not tested against live Supabase:** RLS and sync run on PGlite and a stand-in cloud. D4 (conflict rules) was
  built as recommended without an explicit answer.
- **Audio Content and older versions:** versions 6.10 and before drop it; every linked PC must be updated.
- **Hosting terms:** Vercel Hobby is personal and non-commercial; see the hosting recommendation.
- **`npm audit`:** high findings in the dev-only ESLint tree (a fix would downgrade `eslint-config-next`).
- **Wordmark:** the horizontal and stacked logos still crop it from the raster `framedecks-logo-source.png`.

## Risks
- Vercel Root Directory `hosted` is assumed from the working deployment, not read from the dashboard.
- Logo checked on 25 October 2026 ([logo visual QA](docs/qa/2026-10-25-logo-visual-qa.md)): clear in both themes, the
  Speaker/Teleprompter header and the remote. The faint 16 px favicon and 16–20 px tray icon on light backgrounds are fixed by a
  heavier small-size emblem (owner-approved; used only at 16–32 px). The program icon (.ico) carries the new emblem. Unchecked: the real tray
  on an installed PC.
- **Repository drift: parallel work outside `main` contradicts its decisions** (see "Drift" below).
- Service worker caching must never cover `/api/` or `/auth/` once auth exists (guarded and tested).

## Drift (found and resolved 25 October 2026)
Pull requests from an earlier workstream predated `main`'s choices and conflicted with them. Decision (owner asked for
the recommended course): `main`'s plan stands. #7 was brought up to date and merged; #8–#16 were closed with a note.
Their branches are kept, so any of them can be reopened or mined:

| PR | What | Outcome |
|---|---|---|
| #7 | 6.10: Quit really quits (desktop fix) | Merged after `main` was merged in and every check passed. |
| #8 | Flutter port of the Studio and phone remote | Closed: outside `main`'s plan. Branch `claude/flutter-platform`. |
| #9, #10 | Windows 11 and Mac virtual cameras | Closed: desktop function change. Branches `claude/windows11-camera`, `claude/mac-camera`. |
| #11 | SaaS + PWA architecture (Cloudflare) | Closed: `main` uses Vercel + Supabase. Branch `claude/saas-pwa-architecture`. |
| #12 | Alternative rename, logo and Decks model | Closed: `main` has its own approved emblem; desktop UI frozen. Branch `claude/framedecks-branding`. |
| #13–#16 | SaaS Phases 1–4 on Cloudflare | Closed: different backend. Branches `claude/saas-phase1` … `claude/saas-phase4`; unfinished `claude/saas-phase5`. |

**Worth reusing when `main` reaches these steps** (designs and tests, not the Cloudflare code):
- Secure device pairing (`main` Phase 5): `docs/architecture/pairing-protocol.md` on `claude/saas-phase4`: 5-minute
  QR / 6-digit code, approval at the PC, X25519 key agreement bound to the QR or six check digits, AES-GCM sealed
  messages with replay counters, roles enforced by the runtime, revoke in under a second; phone and PC crypto checked
  against one shared test vector (`tests/pair-crypto.test.js`, `tools/make_pairing_vector.py`).
- Runtime channel: `docs/architecture/relay-protocol.md` (same branch): the PC connects outward; relayed requests are
  replayed on a listener that treats them as a phone, never as the PC, so the remote's allow-list and roles hold.
- Metadata sync (`main` Phase 4): `docs/architecture/cloud-api.md` and `app/js/entities.js` on `claude/saas-phase2`:
  per-record revisions, a workspace sequence, conflict rules ("never lose a Frame"), members end-to-end encrypted with
  a recovery key, and a two-computer test harness.

## Assumptions
- Hosted companion is online-first and separate from the LAN remote.

## Blockers
- The live tests need the owner to install the build from `main` and link a PC (the database is ready). Google/Microsoft sign-in needs the
  owner's OAuth apps (their secrets go only into the Supabase dashboard).

## Recommended Next Task
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md) "Recommended Next Task": the owner's live tests (A–G and the website
settings) first; 6.12 removes Excel only after test G passes. No new features unless the owner asks.
