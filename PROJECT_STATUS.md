# PROJECT STATUS

Last verified: 26 October 2026. PR #32 is merged (`main` at `8fe4cf7`). The owner ran database scripts `0002`–`0008`
in Supabase, all passed, so the live database is complete (`0001`–`0008`). The checks below are for `f424761`.
- **GitHub:** hosted checks and the Stream Deck build are green, and the Windows installer build passed (run
  40231518591, with python-pptx bundled).
- **Locally:** Python 126 tests OK, desktop JS 4/4, `packaging/check.py` (6.10), hosted 85/85 (lint, typecheck,
  build), Stream Deck 5 tests and `validate`, doc links 0 problems.

Phase detail lives in
[docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md); migration results in
[docs/post-migration-report.md](docs/post-migration-report.md).

## Completed
- **Desktop and brand.** Desktop 6.10 and the approved emblem (PRs #7, #18); drift resolved (see "Drift").
- **Hosted companion** on Vercel (`hosted/`).
  - Sign-in (PR #18) and workspaces (PR #19) are **confirmed live**.
  - Members and invitations (PR #20) are built.
- **Phase 4 sync** (PRs #21–#24), **Phase 5 control from the companion** (PRs #25–#27), **companion editing and
  history** (PRs #28–#30), and the live test guide (PR #31). All built and tested against stand-ins; the owner's live
  tests are pending.
- **PR #32 (merged 26 October):**
  - **Audit:** [architecture audit](docs/project/2026-10-25-architecture-audit.md). Its Phase 1 (P1–P4) and the C2
    crash watchdog (`supervisor.py`) are built.
  - **Stream Deck plugin** (`streamdeck/`).
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

## In Progress
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
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md). The next Phase 4 task is the 6.9 JSON import/export bridge with dry-run validation and representative fixtures. Phase 3 auth still needs owner-supplied Supabase configuration; durable sync transport remains gated on auth/tenant readiness.
