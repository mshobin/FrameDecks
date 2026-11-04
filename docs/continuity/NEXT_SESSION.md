# NEXT SESSION HANDOFF

Commit identity (owner's instruction, 4 Nov 2026): every commit is authored as `Shobin Mathews <276174545+mshobin@users.noreply.github.com>`; set it at the start of each session with `git config user.name "Shobin Mathews"` and `git config user.email "276174545+mshobin@users.noreply.github.com"`, and add no co-author or tool lines.

Updated 4 November 2026 (9.10.1 on `main`, untagged: the owner saw a light grey box behind the Command Center on Windows: pywebview leaves the transparent window's WinForms form in its default grey; `desktop_win.clear_back` now paints it black (see-through with `glass`). Not verifiable in the sandbox: owner checks on Windows, then tags `v9.10.1`. 9.10.0 published: the Command Center redesigned as a frameless glass bar with four chips Prepare / Engage / Control / More (`GROUPS` in app/js/command-center.js; the window is see-through via `desktop_win.clear_frame` + glass without frost); Control holds the Go Live switch and the live remote; Ask AI removed. 9.9.0 published: the Command Center (`app/js/command-center.js`; the window is still `spotlight.html` / `win spotlight` internally) with modules as palette scopes (`KCPalette.scope`, `hooks`), prefixes > # @ ?, meetings and Ask AI in the index, the phone remote restyled (remote.css 9.9 block); `tools/make_product_shots.py --guide-only` for the guide pictures. 9.8.1 published: the Spotlight window is created only on first use (`spot_window(create=True)` in `src/desktop_app.py`; pywebview shows transparent windows on navigation even when hidden), `docs/legal/security.md` lists every protocol, legal pages and guides in 9.8 wording, help shots recaptured. 9.8.0 published: passwordless workspace and Trusted Devices (docs/architecture/trusted-workspace.md): website `/sync` (Sync / Save / Continue on Another Device, emailed one-time link), Trust This Device (`hosted/src/lib/trusted-device.ts`, `components/trusted-device.tsx`), `/devices` Manage Devices, migration `0015_trusted_devices.sql` (+ rollback, PGlite tests) with the pre-request revocation check; `/sign-in` forwards; desktop Settings section renamed Workspace Sync. Owner: run 0015 in Supabase, set Email OTP Expiration to 600 s, switch Google and Microsoft off, then tag `v9.8.0`. 9.7.0 published: Draw / Spotlight on the Share Window from Spotlight, live-only Spotlight remote with Content arrows, main window maximized, phone picture only sideways, welcome Going live page. 9.6.0 published: Spotlight as a meeting remote, website tokens from the program, product shots. 9.5.0 published: Welcome to FrameDecks (`app/js/onboarding.js`, full screen, PC only, `onboarding` record in kc-app-settings.json) replaces the first-run dialog and the Setup guide auto-start (guide on request: Settings → About); KJV + WEB via bible-api.com (`OPEN_BIBLES`; the sandbox could not reach it: owner checks a fetch on a real PC); Church Service Quick Start; + Deck button; neutral labels and wording (owner's item-5 fixes); tests `tests/test_scripture_95.py`. Owner: tag `v9.5.0`. 9.4.0 published: the remote redesigned to run the whole meeting (stage + Show / Plan / Tools / Memory / Meeting tabs, portrait and landscape; `app/js/remote.js`), the Spotlight that follows the pointer (`/api/pointer`, `live.follow`, `vcam/spotlight.py` `Follow`, `.pg-follow`), remote video controls (`remote_studio_action` op `media`), the Workbook Meeting plan (Frame > Deck > Content, 1 · 1.1 · 1.1.1) and Import from Excel in Quick Start; tests `tests/test_remote_94.py`. Owner asked for recommendations only (no code) on remote-camera capture for Capture Memory and on generic vs BSF-specific wording; given in chat. Owner: check the remote on a real phone (portrait and sideways), then tag `v9.4.0`. 9.3.0 published: completes the production audit (docs/project/2026-11-03-production-audit.md lists every finding). Desktop: report-only CSP (`server.page_csp`), state JSON cache outside `cond` (M10), reused vCam buffers (M9), private card text off the phone (L5), `update_state` inside its lock (L2), 400 for malformed bodies (L17), long-word wrap / width cache / Excel range clamp / .frame size limit (L16), PowerPoint macros off (L6), sync keeps overwritten versions (L12), camera DLL copied to Program Files and registered there by content tag (H4: real-PC check still needed: install, camera works in Zoom, update with an unchanged camera asks no permission, uninstall removes `C:\Program Files\FrameDecks vCam`). Build: hashed lock `packaging/requirements-lock.txt` (M5), Inno Setup 6.7.1. Cloud: migration 0014 (link limits M6, idle remote_take L13, account deletion L11, `transfer_ownership`); owner: run 0013 then 0014 in Supabase (the website's Make owner needs 0014). Website: per-page CSP in `_headers` by `scripts/write-csp.mjs` (report-only), /connect uses the stored PC name (L10), Make owner, per-page JS budget, About styles on demand (L15). Backups: HMAC (`tools/backup_mac.py`, L14). Deferred: M11 (OBS connection limit). Owner later: SignPath (M3), manifest signing key. Owner: tag `v9.3.0` once CI is green. 9.2.0 published: signed release manifests (`src/ed25519.py`, `src/manifest_sig.py`, `updater.TRUSTED_KEYS`, `tools/manifest_key.py`; dormant until the owner makes a key and adds the `MANIFEST_SIGNING_KEY` secret and the public key line: docs/deployment/release-pipeline.md "Signed manifests"), updater hardening, release workflow guards (tag on main, signed flag from the check, env tag, pinned runners); `tests/test_update_chain.py`. Owner decided (4 Nov) to switch manifest signing on later: 9.2.0 ships with TRUSTED_KEYS empty (signing dormant); tag `v9.2.0` as is. Migration `hosted/supabase/migrations/0013_protect_owner.sql` on `main` (audit H5: admins cannot demote or remove the owner, memberships stay with their person and team, only the owner changes roles or adds people directly); owner: run it in the Supabase SQL editor; rollback in `hosted/supabase/rollback/`. 9.1.2 published: security and reliability patch from the production audit (docs/project/2026-11-03-production-audit.md): media names never paths (`src/media_names.py`), PIN lockout race and backoff, LAN timeouts / connection cap / small bodies, atomic settings writes, chat-parser backtracking, escaped selector ids, WhatsApp/Messages/Phone labels on camera bubbles; `tests/test_hardening.py`. Open audit items (H3 signed manifest, H4 vCam DLL folder, H5 migration 0013, M3–M7, M9–M11) are listed there. Owner: tag `v9.1.2`. 9.1.1 published: the phone remote's Capture Memory did nothing on a real phone because `/js/remote-memory.js` was not in `REMOTE_PUBLIC` (tests ran on the PC, where everything is allowed); fixed, with a test that every file `remote.html` loads is allowed. Owner: tag `v9.1.1`. 9.1.0 published (owner's request): Memory Cards shown as chat bubbles only, no window (`vcam/chatcard.py` one Card per bubble + `stack`, `program.py` pop / glide, `overlay.js` `.chat-list`), several selected shown together in copy order (`Memory.show_many`, `showmany`), a copied conversation split per message (`memory.split`), floating bubbles clear of every card (`OverlayLayer.visible`, `ProgramFX._avoid_rects`), Capture Memory on the phone remote (`/api/remote/memory`, `app/js/remote-memory.js`), and the camera renamed **FrameDecks vCam** (was FrameRelay; same CLSID; history docs keep the old name); design-history §53, memory-cards.md items 10–13. Owner: run those on Windows, then tag `v9.1.0`. 9.0.0 published: Memory Cards replace the Audience Dock: `src/memory.py`, `/api/memory`, `live.memory`, `vcam/chatcard.py` layouts (beside default / below / over; the picture shrinks), overlay.js `.stage-root`, Studio pane + corner popup (`app/js/memory.js`), pinned cards in `kc-memory.json`; crash fixes (dock removed, capture.py one WNDPROC); design-history §52, docs/architecture/memory-cards.md. Owner: run its real-PC checklist, then tag `v9.0.0`. 8.9.0 published: Safe Next (`KCScenes.upNext`, the Up next strip under the Studio Canvas, warnings), Audience Dock Waiting/Shown tabs and keys, the FrameRelay chat window keeps clear of the camera inset; design-history §51. Owner chose 1 and 2 of the four 8.9 candidates; the run-through timer and Take it home page wait. Owner: tag `v8.9.0`. 8.8.1 published: the Audience Dock opened off the right edge of displays scaled above 100 % (pywebview scales x/y/size; dock rects are now screen pixels placed after showing) and could not take typing when pinned (focus=True now). Owner: tag `v8.8.1`, then rerun the dock checklist. 8.8.0 published: the Audience Dock (Live tools → Audience Dock): Capture turns a copied chat message (Ctrl+C) into a card, Show/Pin/Hide puts it on FrameRelay as `live.audience` with a server timer; the dock is click-through (Ctrl+Shift or the handle's pin to use it), hidden from capture, 85/20/100 % (`src/dock.py`); new `src/audience.py`, `src/capture.py`, `/api/audience`, `/api/app/dock`; design-history §50 and docs/architecture/audience-dock.md (owner: run its real-PC checklist on Windows before tagging `v8.8.0`). 8.7.0 tagged: the Spotlight as a soft see-through disc (style disc/ring, settings in Annotate and Settings → Transitions), How it works with five days incl. Point it out, See it work touring its tabs; design-history §49. Owner: tag `v8.7.0`. 8.6.0 published: Quick Start imports .frame files through the Settings import, the Teleprompter bar arrow, Help Center with topics, sign-out to framedecks.com, Plan card hierarchy, wider pages; design-history §48. 8.5.0 published: several meetings per workspace (meeting record `meetings`, a Frame's `group` names its meeting, the PC shows one at a time via `Scenes.order`; design-history §47), a right-side flowchart timeline on the website Plan, .frame per meeting. Owner: run `hosted/supabase/migrations/0012_meetings.sql` in Supabase if not yet. 8.4.0 published: .frame Use this plan with an integrity check and a field-by-field import check, Resync Linked PCs, Meeting Details of name/date/notes, Help step-by-step guide (re-run tests/visual/help-shots.mjs when a screen in it changes; hosted/tests/help-guide.test.mjs checks its labels). 8.3.0 published: the website Plan in five guided steps with a drag-and-drop timeline, Preview, Choose Animation and media kept in the browser that travels in the .frame file; check it with tests/visual/plan-flow.mjs after a website build. 8.2.0 published: Teleprompter controls only in its top bar with upload and Each Frame / Whole meeting scripts, Annotate Spotlight, one transition per effect plus Burst, .frame files (website Export for Service PC, PC Import/Export Frame File; docs/reference/frame-file.md), header Sync chip; 8.1.0: Teleprompter transparency + pin, looks, one Content view, website-matching restyle; 8.0.0 published; 7.1.2 published: release guards after the production audit; 7.1.1 no hidden PowerShell/netsh/taskkill; 7.1 workspace looks; 7.0 proprietary + framedecks.com downloads; owner steps under 7.0 and the audit): the maintainer guide is now [PROJECT_GUIDE.md](PROJECT_GUIDE.md); current references were updated. The continuity files now live in `docs/continuity/`. Windows batch launchers are under `tools/launchers/` and resolve the repository root before running. Release `v6.11.2` (repository layout and trust fixes, no desktop change; pilot install on a real PC and SHA-256 check still the owner's) was tagged after `v6.11.1`, which is published; the FrameDecks README and release header refresh merged in
PR #38. Trust fixes merged in PR #39 (`27cfb4b`). Later the same day: the budget script fixed for Windows
(`57cd9c3`), the five Dependabot action upgrades merged (#33–#37), and the handoff PR #40. All checks on `main` are
green, including the Cloudflare Pages deploy (production); a look at the live site is still the owner's. Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md) ("Working locally" has the set-up and run commands).

1 November, version 8.0.0 on `main` (tag `v8.0.0`): owner-approved UI simplification. Teleprompter = one window
(`speaker.html` via `desktop_app.teleprompter()`, server action `teleprompter`, `window.KCTeleprompter` in
`annotate.js`); `prompter-dock.js`, `prompter.html/js/css` and the `overlay*` settings removed (old keys ignored on
load). Frames: compact cards (theme.css "8.0 Frame cards"), one "Duplicate Frame", `sceneForm` = Name, script,
auto-advance, Duplicate + `details#sc-adv` Advanced. "Decks" label; three text presets removed. `service.js` now only
ready checks (`KCServiceChecks`) and How people see it: Run, Up next, Practice removed (`practice=1` gone from
`overlay.js`). Setup guide (`guide.js`) is a wizard, six steps (`rehearse` retired; `app_settings()` strips it from
saved progress). FrameRelay quality grouped in plain words, Diagnostics its own box with `diagnose()`.

1 November, version 7.1.2 (published from `v7.1.2`): a read-only production audit (tags v6.12, v6.13, v7.1 exist;
GitHub Releases up to 7.1; nothing ever published to R2 because run #174's upload was skipped, R2 not configured
then, so api.framedecks.com/health says latest:false). 7.1.2 guards the release pipeline: tag must equal
v+APP_VERSION and come from a push; `concurrency: publish-releases`; the publish job reads index.json from R2
(head-object/cp), fails on non-404 errors, refuses an already-published version; `make_release_manifest.py` refuses
older versions, previous = next lower, index sorted. `local-test.sh` runs the real read/upload steps and the
refusals. **Owner:** do NOT re-run the v7.1 tag run (it would publish the Defender-flagged 7.1); with the R2 secrets
set, push only `v7.1.2`; never push v6.14 or v7.0.

31 October, version 7.1.1 on `main` (not yet tagged): Microsoft Defender quarantined the owner's FRAMEDECKS.exe 7.1
(behavioural "Trojan … executes commands from an attacker"). `src/winapi.py` replaces every PowerShell/netsh/taskkill
launch (network check, firewall rule via `FRAMEDECKS.exe --firewall`, camera install, updater signature check and
install script, stuck-copy ending); the updater starts the installer with `/UPDATE=1` (`installer.iss` IsUpdate:
waits, restarts the app). Network check only while Phone & iPad Remote settings are open. Build compiles PyInstaller's
bootloader from source. `tests/test_winapi.py` forbids shell launches (AST) and exercises the Windows calls on CI.
**Owner:** restore the quarantined copy or install 7.1.1; add the folder exclusion; report the false positive to
Microsoft; code signing is now urgent. State of the owner's local clone (31 October): diverged, 1 local commit
"Updates" + 156 staged files; plan given: commit them on `backup-before-sync-2026-10-31`, reset `main` to `origin/main`,
then compare.

29 October, version 7.1 on `main` (not yet tagged): **workspace looks**. Website Branding → Look
(`hosted/src/lib/workspace-settings.ts` `LOOKS`, `components/branding-panel.tsx`) saves `layout/look`
`{id, name, a, b, font, base}` and the brand accent. Sync carries it as the document key `look` (both mappings);
`store.js` normalize keeps only a well-formed one; output pages via `KCScenes.lookSurface` → `--surf-a/--surf-b/
--scripture`; camera via `vcam/cards.py` `surface_of` (per draw, under the accent lock) and the branding plate.
`cloud_sync` holds `LOOK_KEYS` while `on_screen(plan)`. Appearance → Follow my workspace (`nav.js`, first paint from
`kc-theme-base`). No migration. Verified: Deep Ocean and Morning Light on the stage page and Follow my workspace in
the program (fresh `KC_DATA_DIR`); Branding page against a stand-in Supabase (pushes look then brand, phone and
desktop, no overflow). Checks: Python 197, desktop JS 6/6, website 159, lint, types, build, budget (CSS 23 KB of 24),
visual and axe suites. **Owner:** live Test K; tag `v7.1` after `v7.0`. Next: 7.2 signed manifests (off until a key).

29 October, after 7.0: the download page no longer guesses a download address (until the service answers it says
"Download opens soon" and offers planning on the website; `downloadState` in `hosted/src/lib/releases.ts`), and the
release pipeline was tested end to end on this machine: `bash infra/update-api/local-test.sh` (wrangler dev + local R2,
two releases, routes, updater, tampering, previous version, rollback) passes. The download page was also checked
in a browser against that local service: version, notes, checksum, and the downloaded file's SHA-256.

29 October, version 7.0 on `main` (not yet tagged): the **commercial model** (plan:
`docs/project/2026-10-29-commercial-model-plan.md`, sections 1–9 answer the brief's eight items). Owner's answers:
legal owner Shobin Mathews (personal); governing law left as a marked gap; hello@/security@ (and privacy@) at
framedecks.com via Email Routing; Windows now, Mac and Linux later. Built:
- **Proprietary:** `LICENSE` = EULA (`docs/legal/eula.md`) with a header, new `NOTICE` and third-party intro, no
  open-source wording left in the README, guides, website or installer (`LicenseFile`, publisher, contacts).
- **Website:** `/download` (OS detection, newest version from `api.framedecks.com/releases/latest`, size, notes,
  SHA-256), `/terms`, `/privacy`, `/cookies`, `/eula`, `/security`, `/security/disclosure`, `/legal`, `/about`,
  `/contact`, `/roadmap`, `/docs` (+ every guide), `/status`, five-column `SiteFooter`, cookie notice (`fd-consent`),
  `.well-known/security.txt`. Markdown from `docs/legal/` and `docs/guide/` is copied by `scripts/write-content.mjs`
  (committed copies, a test keeps them current) and rendered with `marked` (`lib/markdown.ts`).
- **Accounts:** `0011_accounts_legal.sql` (`accept_terms`, `export_my_data`, `delete_my_account`; rollback file),
  the agreement tick on sign-up, `LegalGate` for existing accounts, Account → Your data. PGlite tests.
- **Release pipeline:** `tools/make_release_manifest.py`, the workflow's `publish` job (R2 via the AWS CLI; does
  nothing and says so without the secrets), the Worker `infra/update-api`, guide `docs/deployment/release-pipeline.md`;
  `cloudflare-domains.md` (api/downloads, Email Routing) and `code-signing.md` (SignPath Foundation no longer
  applies) updated.
- **Program:** `src/updater.py` (manifest checks, size + SHA-256 + optional Authenticode, detached PowerShell install
  that waits, installs silently, rolls back, restarts; outcome told once), `server.update_action`, Settings → About
  Updates box; the GitHub releases check is gone.
- Checks: listed in PROJECT_STATUS.

**Owner, in this order** (details in [release-pipeline.md](../deployment/release-pipeline.md) and the plan's
section 7): (1) Cloudflare Email Routing for hello@, security@ and privacy@framedecks.com (`cloudflare-domains.md`
step 6a); (2) the R2 bucket `framedecks-downloads` with the `downloads.framedecks.com` custom domain, an R2 token,
and the GitHub secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and variables `R2_ACCOUNT_ID`, `R2_BUCKET`;
(3) remove the `api` redirect rule and record, then `npx wrangler deploy` in `infra/update-api`; (4) run
`0010_link_by_url.sql` (if not yet) and `0011_accounts_legal.sql` in Supabase; (5) tag `v6.12`, `v6.13`, `v6.14`
and then `v7.0` on `main` (the session cannot push tags) **while the repository is still public**, so 6.x copies,
which ask GitHub, still see 7.0; check `api.framedecks.com/releases/latest` and framedecks.com/download; (6) make the
repository private; (7) a lawyer reviews `docs/legal/` and fills "[governing law to be confirmed]" in the EULA and
Terms; (8) code signing (Azure Trusted Signing recommended, `code-signing.md`), then `RELEASE_SIGNED=true`.

Next: 6.15 the workspace looks (now 7.1), then Ed25519-signed manifests.

29 October, version 6.14 on `main` (not yet tagged): the **Setup guide**. `app/js/guide-steps.js` (seven steps, five
kinds; same list in `hosted/src/lib/guide-steps.ts` and `server.GUIDE_STEPS`, tests keep them equal), `app/js/guide.js`
(panel at the right, steps ticked only by detection: kind chosen runs its Quick Start, `KCServiceChecks.output()`,
phone connected, `api/sync` linked, `KCWorkspace.planSig()` changed since the guide opened, Next while Practice is on,
every Before you start line green after the rest; "Show me how" spotlight; finish view; Settings → About box and a
palette command), progress in `kc-app-settings.json` `guide` (`server._valid_guide`). The Getting started card in
`app-bridge.js` is gone (an open one hands over to the guide once). Website: `components/setup-guide.tsx` on Home
(kind chosen in `fd-guide`, linked PC, a Frame record saved by `user:…`; PC steps "On the PC"), `show-guide.tsx` on
Help. Live test J added. Verified in the program from an empty data folder (`KC_DATA_DIR`) and on the website with a
stand-in Supabase. Checks: Python, desktop JS, website 142/142, lint, types, build, budget, visual and axe suites.
Next: 6.15 the workspace looks.

29 October, version 6.13 on `main` (not yet tagged). Owner's answers to the plan's section 7: (1) keep "Type a code
instead" as a fallback, (2) the six looks are approved (6.15), (3) the four-screen front page without the pinned guide
and GSAP is approved, (4) the new ideas go on the roadmap. Built:
- **One-click linking.** `hosted/supabase/migrations/0010_link_by_url.sql` adds `computer_link_peek(code)` (signed-in
  only, same 20-an-hour failure limit; rollback in `supabase/rollback/`; PGlite test in `supabase-sync.test.mjs`).
  Website `/connect` (`components/connect-panel.tsx`, `lib/connect-link.ts`, `app/connect/page.tsx`): reads
  `#code=…&name=…`, shows the PC with its check number (SHA-256 of the code, two bytes, mod 90 + 10; same in
  `cloud_sync.check_number`), the workspace picker for owners/admins, Allow / Cancel, then "connected" and a
  `framedecks://linked` link. Signed out: "Sign in to continue", the request is remembered for 15 minutes
  (`fd-after-sign-in`) and `auth-callback.tsx` returns to it. Program: Settings → FrameDecks account → **Connect to
  FrameDecks** opens `connectUrl` (`cloud_sync.connect_url`, site from the sync config) in the browser; the waiting
  view shows the check number, Open the page again, Cancel and the fallback code; polling every 1.5 s. Home, Service
  PCs and the live test guide (Test A) describe the new way. The "email the owners" idea became the existing Service
  PCs list (no mail provider). Verified in a browser against a mocked Supabase: ask, signed out, member-only, no code,
  Allow → connected.
- **Front page about four screens** (4.5 at 1366 × 768, was about 9 plus 1.6 pinned): two-column hero with four proof
  ticks (the marquee is gone), How it works as four tabs with a 6 s filling bar that plays once while on screen
  (holds on hover/focus, never under reduce motion / Reduce effects; `landing/how-it-works.tsx`), one tab set for the
  demo and the features (`landing/feature-tabs.tsx`), four questions + "More questions", the promise inside Ready to
  Serve?. `statement.tsx` removed; `gsap` uninstalled (JS 380 → 339 KB). The hero picture no longer fades in, so the
  paragraph stays the largest paint: Lighthouse mobile 86–89, accessibility 100.
- `APP_VERSION` 6.13, `docs/releases/v6.13.md` (Known Issues: run 0010), CHANGELOG (the framedecks.com entry moved
  into 6.13), design history 36, header image at 6.13, design-system "Landing", metadata-sync.
- Checks: Python 174, desktop JS 4/4, packaging, CSS tokens, ruff, doc links, release notes check, website 138/138,
  lint, types, build, budget, program visual and axe suites.
- **Owner:** run `0010_link_by_url.sql` in the Supabase SQL editor; tag `v6.12` and then `v6.13` on `main` (the session
  cannot push tags); live Test A with the new flow. **Next (6.14):** the Setup guide in the program, then on the
  website; 6.15 the workspace looks. Plan: `docs/project/2026-10-29-onboarding-linking-themes-plan.md`.

28 October, framedecks.com live-check (owner's curl results, 11:38 UTC): **framedecks.com serves the site** through
Cloudflare (200, the repository's security headers), `robots.txt` names `https://framedecks.com/sitemap.xml`,
`/api/sync-config` answers the program's User-Agent with the Supabase URL and publishable key, and
`framedecks.pages.dev` answers `x-robots-tag: noindex`. **Still open (owner):** `www.framedecks.com`,
`framedecks.app`, `www.framedecks.app` and `app.framedecks.com` give no answer at all (most likely their proxied
`AAAA 100::` records are missing, or the framedecks.app zone is not Active yet; ask for `nslookup` and `curl.exe -I`
output); HSTS is not on (no `Strict-Transport-Security`); Supabase Site URL / redirect URL and the Google consent
screen URLs not yet changed; the pages.dev Bulk Redirect waits until all that works for a few days. Brevo is not used
(skipped 26 October): sign-in mail stays on Supabase's built-in mail, so framedecks.com gets no-mail DNS records
(null MX, `v=spf1 -all`, DMARC reject; guide updated in `d463e84`). This session cannot reach framedecks.com or the
Cloudflare API (network policy), so checks are run by the owner with `curl.exe` on Windows.

28 October, framedecks.com as the one address (repository side done; Cloudflare and Supabase steps are the owner's):
`hosted/src/lib/site.ts` (`SITE_URL`), canonical links on `/`, `/help`, `/privacy`, `/sign-in`, `noindex` on every
signed-in page, `robots.txt` + `sitemap.xml`, `X-Robots-Tag: noindex` on `*.pages.dev`, a year's cache on
`/_next/static/`; `src/cloud_sync.py` asks framedecks.com then framedecks.pages.dev (ships in the next program
release); `hosted/tests/site-domain.test.mjs`. Owner's checklist with every DNS record, redirect rule (framedecks.app
and www 301; app/api/docs reserved 302), TLS, cache, security and WAF setting: `docs/deployment/cloudflare-domains.md`
"Order of work". There were no framedecks.app references to replace. Checks: Python 172, website 133/133, build.

28 October, version 6.12 prepared on `main` (not yet tagged): the camera FRAMECAST is renamed **FrameRelay** everywhere
(registered name in `packaging/build_vcam.py` / `src/vcam/sink.py`, same CLSID; `src/vcam/devices.py` and
`hosted/src/lib/pc-setup.ts` still recognise "framecast" as an earlier name); the website hero no longer tilts, follows
the mouse, floats or sways (one ordered arrival, then still; the closing light is still too); the Helen Keller quote in
the website demo became Proverbs 16:3 (KJV) and `hosted/public/product/studio.webp` was captured again from the
program with that verse live; "Ministry Servant" left the About screen (`app/js/brand.js`). `APP_VERSION` 6.12,
`docs/releases/v6.12.md`, CHANGELOG, design history section 35 and the README/release header (Version 6.12).
Checks: Python 170, desktop JS 4/4, packaging, CSS tokens, ruff, doc links, release notes check, website 129/129,
lint, types, build, budget, program visual and axe suites. Owner: tag `v6.12` on `main` to publish (the session
cannot push tags), then install over 6.11 with "Install the FrameRelay camera" ticked and check the name in Zoom/Teams.

28 October, landing page redesign and signed-in visual pass (owner's spec; built from the written spec because
`design/framedecks-landing-mockup.html` was not in the repository: add it to compare). Owner's choices: light by
default (loops only while on screen, a Reduce effects switch), signed-in pages a visual pass only.
- Structure: `hosted/src/components/landing.tsx` (words, order) with `landing/nav.tsx`, `landing/hero.tsx`,
  `landing/how-it-works.tsx`, `landing/step-screens.tsx` (Plan, Rehearse, Check, Present; each takes `image?`),
  `landing/feature-previews.tsx` (Teleprompter, FrameRelay), `landing/statement.tsx`; `next-demo.tsx` enlarged
  (16:9 screen, wire, Next/Previous/Hide all/Black screen, ripple, question timer); `effects-toggle.tsx`;
  `motion.tsx` rewritten (reveal fix, `data-loop` → `data-live`, the two-glow stage light).
- How it works: pinned with GSAP ScrollTrigger above 960 px when motion is allowed, `end: "+=" + innerHeight * 1.6`,
  `snap: { snapTo: [0, 1/3, 2/3, 1], duration: { min: 0.2, max: 0.45 }, ease: "power2.out", delay: 0.05 }`, step =
  `Math.round(progress * 3)`, rail fill follows progress, a click scrolls to the snap point. Measured: each wheel
  flick moves one step (snaps 410 px apart at 1366 × 768). GSAP is loaded only there (phones never download it).
  Phones and reduce motion: no pin, pill tabs, description below, autoplay every 4 s while on screen until a tap
  (no autoplay under reduce motion or Reduce effects).
- TODO for the owner: real screenshots of the four steps (1200 × 750 WebP in `hosted/public/product/step-*.webp`,
  then `image` per step in `landing.tsx`).
- Checks: website tests 129/129, lint, types, build; no horizontal scroll at 375/768/1366/1920; no section left
  hidden after an anchor jump; Lighthouse desktop 100/100 (performance/accessibility), mobile 89–90 (old landing
  88–90 on the same test); JS 380 KB, CSS 21 KB (budget raised to 24 KB on purpose). Tests changed:
  `idle-performance` (endless loops must be paused until on screen; glows rest; reveal never stays hidden) and
  `design-audit` (landing parts, pin settings). Dead CSS of the old landing removed. GSAP added to
  `docs/legal/THIRD_PARTY_NOTICES.md`. Signed-in pass: gold top edge and deep shadow on cards (`--shadow`), gold
  eyebrows, gold rail on the active place, one easing, Reduce effects in the top bar. Not done: a look at the
  signed-in pages with real workspace data (needs an account).

28 October, repository standard (no behaviour change; owner-approved steps 1–4): the layout every repository of the
owner follows is in `docs/development/repository-structure.md`, with this repository's exceptions (`app/`, `hosted/`,
the paired copies in both, `kc-*.json`, the upper-case PR template). Applied: `.editorconfig`; `code-style.md` redirect
removed; `docs/ministry/` → `docs/guide/roles/`, `docs/images/` → `docs/guide/images/`, `reference/user-guide.md` →
`guide/`; `performance.md` → `docs/development/`, `branding-assets.md` → `docs/reference/`; finished plans and audits
→ `docs/project/history/` as `YYYY-MM-DD-topic.md`; `docs/design/baselines/` → `tests/visual/baselines/`; sample
spreadsheets → `framedecks-members-sample.xlsx` / `-template.xlsx`. Before and after every step: Python 170, desktop JS
4/4, packaging, CSS tokens, ruff, doc links 0 problems; at the end also the website (127 tests, lint, types, build,
budget), app start, visual and axe suites and a broken-image check. Commits `832a07b`, `68b1ffc`, `20a8583`, `4e88eda`;
Desktop checks and Build Windows installer green on GitHub. Nothing is open from this work. New files go where
`docs/development/repository-structure.md` says.

28 October, structure clean-up (no behaviour change): (1) unused files removed (`kc-mark.png`, the duplicate meeting
workbook in `docs/templates/`, 12 unreferenced pre-redesign `docs/qa` screenshots; `.vscode/` no longer tracked);
(2) one `ruff.toml`, `README.md`, `LICENSE` and `NOTICE` at the top level (`docs/legal/` keeps only
`THIRD_PARTY_NOTICES.md`; `tests/test_licence_copy.py` retired); (3) docs grouped: user guides in `docs/guide/`,
developer docs in `docs/development/` (`docs/CONTRIBUTING.md` is now `developer-guide.md`), finished plans and audits in
`docs/project/history/`; the top of `docs/` holds only `README`, `CHANGELOG` and `ROADMAP`. Every link and path updated. (4) the last
`kc-` images renamed: `app/img/framedecks-emblem.webp` (same name as the website's copy), `app/img/framedecks-world-map.svg`,
`assets/brand/framedecks-about-header.webp` and `.version`. The `kc-` data files (`kc-*.json`, keys) and CSS class
names keep their names on purpose: renaming them would lose people's saved data.

28 October, branch clean-up: closed, unmerged work is kept as annotated tags `archive/*` (flutter-platform,
windows11-camera, mac-camera, saas-pwa-architecture, alternative-branding, saas-phase1–5) and those branches, plus the
three merged ones, were deleted on GitHub (see `docs/development/branching.md`). Owner's rule: push directly to
`main` (after the checks pass); no working branches unless asked.

28 October, second post-reorganization check (`54d8c0e`: `vcam/` → `src/vcam/`, launchers → `tools/launchers/`,
continuity files → `docs/continuity/`): everything passed except one defect, fixed: in the installed app the FrameRelay
camera's Text Content could not find its fonts (`src/vcam/layers.py` counted folders from its own file; now
`fonts_folder()`, with `tests/test_vcam_fonts.py`). Releases 6.11.1 and 6.11.2 were built before the move and are not
affected. This guide (`PROJECT_GUIDE.md`) is the only maintainer guide; there is no top-level guide file.

28 October, post-reorganization check of `main` (`c87d059`, v6.11.2): build, tests, installer, release job, Cloudflare
deploy and every page passed; the program behaves identically to before the move and the website differs only in the
version number. Two fixes followed: `LICENSE` copied back to the top level (the website footer's Licence link and
GitHub's licence detection had broken when it moved to `docs/legal/`; a later clean-up keeps one top-level copy only) and a
top-level `ruff.toml` that extends `ruff.toml` (plain `ruff check .` had fallen back to default rules).

## Where things stand (27 October)
- **Repository cleanup (merged to `main`):** the orphaned `streamdeck/` bundle is gone;
  release notes v4.9–v6.7 moved to `docs/releases/archive/` (v6.8–v6.11.1 stay in `docs/releases/`);
  `deployment-guide.md`, `environment-variables.md`, `free-hosting.md`, `code-signing.md` are in `docs/deployment/` and
  `database-backup.md` in `docs/operations/`. All references updated; doc links 97 files / 0 problems. Root clean-up
  (later the same day): Windows batch launchers were moved out of the root to `tools/launchers/` and resolve the repository
  root as their working directory. The continuity files now live in `docs/continuity/`; the root retains required top-level files and git dotfiles;
  ignored development data stays there as before. The 12 Python modules are in `src/` (`python src/server.py`;
  `server.HERE` is still the repository root, so dev data stays where it was;   the camera package is `src/vcam/` and `server.SRC` is its development path;
    `config/`, `legal/`, `samples/` and `vcam/` left the root on 28 October, now `ruff.toml`, `docs/legal/`, `assets/samples/`, `src/vcam/`); after the
  28 October structure clean-up: `README.md`, `LICENSE`, `NOTICE` and `ruff.toml` at the top level; `CONTRIBUTING`/`SECURITY`/`SUPPORT`/`CODE_OF_CONDUCT` in `.github/`; `THIRD_PARTY_NOTICES.md` in `docs/legal/`; user guides in `docs/guide/`, developer docs in `docs/development/`, finished plans and audits in `docs/project/history/` (the installer bundles `LICENSE` and `NOTICE` at the app's top level);
  `CHANGELOG.md`, `ROADMAP.md` in `docs/`; plain `ruff check .` uses the top-level `ruff.toml`; the Mac launcher is also in `tools/launchers/`. **Not verified here:** a
  real PyInstaller build and the installed exe (run the Build Windows installer workflow or `tools/launchers/build.bat` before tagging).
- **Release:** **FrameDecks 6.11.1 is published** at `v6.11.1`; its build and publish workflow succeeded. The README
  and release body both show the refreshed FrameDecks wordmark (PR #38).
- **`main` since 6.11:** audit steps 1–2 (plan recovery, safe sync, support bundle, update notice, pinned build); the
  design roadmap and UX simplification (Prepare / Run, Up next with keys, Practice mode and its start-time reminder,
  How people see it, Advanced, People); the website's four places (Home · Plan · Live · People), first-time steps,
  Help and Your account; the owner's landing brief (approved hero words, Day 1–4, Ready to Serve?, every audience,
  motion back with no animated blur); the name written **FrameDecks** everywhere people read it; About readable in Light.
- **Live:** website at `https://framedecks.pages.dev` (Cloudflare Pages, deploys from `main` by itself); Google,
  Microsoft and email sign-in work; keep-alive and nightly backup run green. Database: `0001`–`0009` all run
  (`0009` by the owner on 27 October).
- **Checks (trust-fix PR #39):** hosted tests 127/127, lint, typecheck, build; manual budget 330 KB JS / 70 KB largest /
  18 KB CSS; desktop JS 4/4; README fact tests 2/2; CSS tokens 14 files / 0 problems; doc links 97 files / 0 problems;
  packaging self-check passed. The full Python suite had 4 errors from missing `cv2` (165 run, 3 skipped): a local
  set-up gap, fixed by `pip install -r packaging/requirements-desktop.txt -c packaging/constraints.txt` in `.venv`.
  The budget script now works on Windows too (`57cd9c3`, `fileURLToPath`).
- **GitHub Actions (27 October):** checkout v7.0.1, setup-python v7.1.0, setup-msbuild v3.0.0 (all exercised: the
  installer build passed on `be52af2`), download-artifact v8.0.2 and action-gh-release v3.0.3 (used only by the
  release job, so the **next tag** is their first run; download-artifact now fails on a digest mismatch). If that
  release job fails, fix the cause and re-run the job; the installer build is unaffected.
- **Cloudflare Pages gotcha:** the three failed deploys on 27 October (c48006d–91c3bc4) were exactly the commits that
  had edited comments in `hosted/supabase/migrations/0001`–`0008`; restoring those files fixed it. `0001`–`0009` are
  all run live now. Never edit a
  migration that has been run (PROJECT_GUIDE.md), not even a comment; the dashboard log has the exact reason.
- **Gotcha for the visual suites:** start `src/server.py` with nothing else on port 8750 (a leftover server makes them test
  the wrong data and fail on things that are fine).

## Completed (merged to `main`, PRs #7–#32 and #38–#39)
- Desktop 6.10, the approved emblem, and the drift cleanup.
- Hosted companion on Cloudflare Pages (Vercel remains until retired): sign-in and workspaces confirmed live by the owner; members and invitations.
- Phase 4 sync of service plans, built and not yet live-tested:
  - database `0003`;
  - record mapping;
  - PC sync with Settings → FrameDecks account;
  - companion Services / Members / Computers.
- Phase 5, control from the companion, built and not yet live-tested:
  - database `0004`/`0005`;
  - `src/cloud_remote.py`;
  - the Settings switch;
  - the Live page.
- Companion editing and 30-day Frame history with restore.
- The owner's live test guide.

## Completed on PR #32 (merged 26 October)
- **Audit:**
  - [architecture audit](../project/history/2026-10-25-architecture-audit.md);
  - its Phase 1, P1–P4: writing, sync, image memory and screen-capture copying per press;
  - C2: `src/supervisor.py`, a crash watchdog in the installed exe.
- **Stream Deck plugin:** removed on 26 October at the owner's request (with `/api/command`).
- **Target-architecture migration** (owner's brief):
  - [review](../project/history/architecture-review.md), [plan](../project/history/migration-plan.md) (owner decisions M-D1–M-D6 in §8),
    and [results](../project/history/post-migration-report.md).
  1. `0006_audit_log.sql`: an audit log of people, roles, invitations and PCs.
  2. ESV key moved to Windows Credential Manager.
  3. Missing-media check: `/api/media/check` and Diagnostics.
  - `0007_data_api_grants.sql`: explicit grants for **Supabase's 30 October 2026 change**.
  4. M-D1: Apache 2.0 `LICENSE`, `NOTICE`, `docs/legal/THIRD_PARTY_NOTICES.md`; SignPath signing in the Windows build, off until
     the secret exists.
  5. M-D2: the workspace is the member list's source.
     - The companion's Members page adds, edits and removes people.
     - A linked PC rebuilds a lost member file from the workspace.
  6. M-D3: free AI with Ollama on the PC.
     - **Suggest** drafts discussion questions from a Frame's passage, and is hidden without Ollama.
     - Code in `src/ai.py`; user guide [docs/guide/ai.md](../guide/ai.md).
  7. M-D4: **Export this meeting to PowerPoint** (`src/pptx_export.py`) and **Audio** Content (`app/js/audio-player.js`).
  8. M-D6: `0008_member_groups.sql`; member groups on the companion's Members page only.
  - M-D5: long-term hosting recommendation, [docs/architecture/hosting.md](../architecture/hosting.md).

## In progress: the free plan (owner's request, 26 October)
Steps, in order, from [docs/deployment/free-hosting.md](../deployment/free-hosting.md):
1. **Companion as static files**: **live on Cloudflare Pages** at `https://framedecks.pages.dev` (26 October; Supabase
   Redirect URL `https://framedecks.pages.dev/auth/callback` added). The PC's built-in companion address
   (`cloud_sync.COMPANION_URL`) now points there; the next installer uses it. The owner signed in there with an emailed link
   (26 October). Owner: finish Part A step 7 (open each page) and retire Vercel after a quiet week (step 8).
2. **Keep-alive and encrypted nightly backup**: **code done** (`.github/workflows/db-keepalive.yml`,
   `db-backup.yml`, `tools/db_backup.sh`, restore guide `docs/operations/database-backup.md`). **Live:** the owner added the 4 secrets; first runs on 26 October were green (keep-alive: the
   database answered; backup: `framedecks-backup-1`, 113 KB, kept to 25 November).
3. **Fewer database requests**: **done** (`src/cloud_remote.py` `IDLE_EVERY` 5 → 15 s). Shorter history/audit retention
   was left out on purpose (it would replace `sync_push` in the live database for almost no saving).
4. **Google/Microsoft sign-in first**: **code done** (`sign-in-form.tsx`: provider buttons above the email link when
   switched on). Owner: Part D. Google sign-in works (brand verification pending, retry
   after 24 h in Verification Center). Microsoft sign-in works too (26 October, after a settings fix). Brevo skipped by
   the owner: the email link stays on Supabase's built-in mail.
   Google needs a privacy policy link to publish: `hosted/src/app/privacy/page.tsx` (`/privacy`, linked under the
   sign-in card). Keep it true to what is stored if sync or members change.
5. Public repository, SignPath, GitHub Releases: **owner only** (Part E; the build already publishes on version tags).

**Branch state:** steps 1–4 are on `main` (pushed 26 October, together with the owner's sync-contract / legacy-6.9
work). `hosted/tsconfig.json` gained `allowImportingTsExtensions` so `src/lib/sync/legacy-6.9.mts` typechecks and
builds. Next: the owner's Parts A, B, D and E.

## In progress: 6.11 (owner's request, 26 October; design [meeting-form.md](../architecture/meeting-form.md))
Owner decisions: W1 the website form edits the live plan; W2 keep Excel import in 6.11 but only under the program's
Settings; W3 6.12 removes Excel import, template and export (PowerPoint export stays).
1. **Camera check and "Open FrameDecks on this PC"**: **built** (`hosted/src/lib/pc-setup.ts`,
   `hosted/src/components/pc-setup-card.tsx` on Overview; installer registers `framedecks:` for this user;
   `src/desktop_app.py` never reads the link; `tests/test_open_link.py`).
2. **Website Meeting Form**: **built** (`hosted/src/lib/meeting-form.ts` row ⇄ layer mapping, checked against the
   Excel import in `hosted/tests/meeting-form.test.mjs`; `hosted/src/components/meeting-form-panel.tsx` on
   `/meeting`: meeting details, add / edit / move / delete Frames and every Content type; conflicts keep the
   person's changes on top). Browser-tested with stand-in Supabase; live test G in the guide.
3. **Excel into Settings → Data / Backup** (`app/dashboard.html` box "Meeting from Excel", wired in
   `app/js/meeting-import.js`; removed from the Meeting menu, Meeting tab, empty Studio; one palette entry opens
   it), **version 6.11** (`src/server.py`, `docs/releases/v6.11.md`, header picture, CHANGELOG): **built**.
   Owner next: install 6.11 (release `v6.11` or the latest Build Windows installer run), then live test G.
4. **6.12 (after test G):** remove the Excel import, template and export (W3); keep Export to PowerPoint.

## Website redesign (26 October, owner's request)
Built on the branch: Apple-style design for the whole companion (`hosted/src/app/design.css`, tokens in
`globals.css`): landing page for visitors (brand, "How it works" four-step workflow, features, privacy), signed-in
dashboard (greeting, brand, live tiles: next meeting, plan, service PC, people; workflow; account), grouped
sidebar (Plan / Present / People), sticky glass top bar, split sign-in page, document layout for Privacy. All pages
checked at 1440 and 390 px with stand-in data. The program's dark theme now uses the same palette (last block of
`app/css/theme.css`, colours only; owner's request); keep the two in step.

## Deleting a workspace (26 October)
Owners delete a workspace from Overview → Your workspaces → Delete (type its name to confirm). No new migration:
`organizations_delete` (0001) and the grant (0007) already allow it, and every table cascades
(`hosted/tests/supabase-rls.test.mjs` checks owner-only and the cascade). Others use Members → Leave.

## Website motion and About (26 October, owner's request)
Built on the branch: cinematic but quiet motion on every page (words rise in on load, sections rise into view on
scroll, steps of "How it works" arrive in order with their connectors drawing, a pointer-following light on cards, a
shimmer on the gold wordmark, a floating emblem with a morphing glow, a slowly drifting ambient light behind every
page, the hero easing away and the top bar firming up as you scroll where the browser supports it). Palette and
layout unchanged; everything stops under "reduce motion". An (i) About button (top bar, landing bar, sign-in) opens
the program's About page in the website's design, with the same words (brand.json from app/js/brand.js).

## Pending (owner)
1. ~~Run the database scripts~~: **done** on 26 October (`0002`–`0008`, all passed).
2. ~~Merge PR #32~~: **done**. Take the installer from the latest "Build Windows installer" run on `main` (Actions →
   Artifacts); if no run started after the merge, start one with **Run workflow**.
3. **Live tests:** [docs/qa/live-test-guide.md](../qa/live-test-guide.md), tests A–F:
   - A sync, B phone control, C editing, D history;
   - E members from the cloud and groups;
   - F PowerPoint export, Audio, Suggest.
4. **Before using Audio Content:** update every linked PC. Older versions drop Audio Content and would sync the Frame
   without it.
5. **M-D1 signing:** follow [docs/deployment/code-signing.md](../deployment/code-signing.md):
   - check the history, then make the repository public;
   - apply to SignPath Foundation;
   - add the `SIGNPATH_API_TOKEN` secret and the three `SIGNPATH_*` variables.
6. **Later (owner's choice):**
   - Google/Microsoft sign-in with the invitation test;
   - the move of the companion to Cloudflare before a public launch ([hosting.md](../architecture/hosting.md));
   - Supabase Pro once churches depend on it.

## Open work (needs a decision or a design first)
- **Media reference checks:** asset references (size and hash in sync records) from migration step 3 need a short
  design first, because of the risk of two PCs rewriting each other's reference.
- **Missing-media warning:** a line on screen needs the owner's approval (desktop UI is frozen).
- **Signing:** C1 (unsigned installer, no auto-update) stays open until signing is on. Auto-update is not designed yet.
- **Live database tests:** RLS tests against the real Supabase need `*.supabase.co` reachable. A local machine can
  reach it; the cloud environment could not.

## Risks
- **Logo/branding:** the 16px favicon remains faint on light tab backgrounds; do not change the approved emblem without owner approval. The packaged tray icon has not been run; `src/desktop_app.py` uses `app/icons/remote-192.png`.
- **Never tested against live Supabase:** sync, phone control, member editing, groups and grants. They are tested on
  PGlite and against stand-ins only.
- **Audio Content and older versions:** see Pending 4.
- **Vercel Hobby terms:** personal, non-commercial use only; asking for donations counts as commercial (hosting.md).
- **Closed PRs #8–#16:** not `main`'s plan; reuse only what PROJECT_STATUS.md "Worth reusing" lists.

## Assumptions
- The hosted app is separate from the LAN remote and never calls the PC's local server.
- D4 (sync conflict rules): built as recommended (keep both Frames; the last writer wins for settings and people).

## Design audit (26 October, chat only)
The design roadmap is complete (ranks 1–21; ranks 8 and 12–21 on 26 October). For any screen change, follow
`docs/development/design-system.md`, run `python tools/css_tokens.py` and `node tests/visual/layout.mjs` (needs the program running
and Playwright), and refresh `tests/visual/baselines/` and `hosted/public/product/` when a screen changes on purpose.
27 October, UX simplification (owner-approved): `app/js/service.js` holds Prepare / Run (body `run-mode`; Run hides the
editor and blocks rename, drag, menus, Delete, cut, paste and undo in the Studio), Up next (`KCWorkspace.upNext()`),
Before you start (reads the status chips), Practice (Black screen + `practice=1` on the program's own previews,
`overlay.js`; any other Black screen off ends it) and How people see it (`#sec-output`). Hide all is neutral unless
`body.kc-on-air` (set in `dashboard.js` refreshStatus). The command bar wraps to two rows below 1460 px in Prepare and
1240 px in Run; measure with something on screen when changing it. The LAN remote's Advanced view still says
"Blackout" (it is off-limits). Words: `docs/guide/glossary.md`. Owner: Test H in `docs/qa/live-test-guide.md`.
27 October, steps to 90+ after the re-audit: colours only in `app/css/palette.css` (run `python tools/css_palette.py`
after adding a colour; `css_tokens.py` fails otherwise; `teleprompter.css` is exempt because the LAN remote loads it
without the palette), `!important` baseline 16, keyboard editor and About story built on first open (`buildOnce` in
`settings.js`), and `node tests/visual/a11y.mjs` (axe-core 4.10.3, installed `--no-save` in `tests/visual`) in the CI
visual job. Left for the owner: Windows check, NVDA/Narrator pass, a real landing quote or usage fact (never invent one).
27 October, the 10/10 plan, phases 1–2 and the parts of 3–4 that need no owner (owner's request): the website has
four main places (`app-shell.tsx` `main`: Home `/`, Plan `/plan`, Live `/live`, People `/members`) and Settings
(Branding, Service PCs `/computers`, Help `/help`); `/meeting` and `/services` render the same `PlanPage`
(`plan-page.tsx`, `plan-panel.tsx`: Edit the meeting / History and restore, `#history`). Home is `overview.tsx`
(`NextService` in `glance.tsx`, or `FirstSteps` that creates the church inline); `/account` holds the workspace list
and invitations. Sign-in: `SignInChooser` (`#new`). The look: `hosted/src/app/identity.css` (restraint overrides,
`.fd-framed` corners, EB Garamond subset `public/fonts/EBGaramond-latin.woff2`), loaded before `light.css`. Landing:
`landing.tsx` + `next-demo.tsx`; `public/product/live-phone.webp` was retaken from the new nav. Program: Run's Up next
is larger, shows keys (`.rn-keys`, from `KCShortcuts`) and the Practice strip turns amber at the meeting's time
(`remindPractice`). Not done (owner or later): 2–3 design directions (one was built), projector legibility mode and
templates by type (Quick Start already offers types; both change the program's screens, so they need the owner's
go-ahead), the Wi-Fi remote redesign (protected), SignPath, public repo, real quotes/photos, screen-reader pass.
Owner: Test I in `docs/qa/live-test-guide.md` (and Test H step 6).
27 October, the owner's landing brief: the name is **FrameDecks** in everything people read (a guarded replace;
identifiers kept: `APP_NAME`, `FRAMEDECKS_*`, data folder, exe, the ping's `"app"`, `FIREWALL_RULE`, Credential
Manager names, old camera names, `src/vcam/` comments; the legacy remote's files untouched). Front page rebuilt
(`landing.tsx`, `next-demo.tsx`, new `hosted/src/app/landing.css`): approved hero words verbatim, Day 1–4, Ready to
Serve?, every audience, no OBS/Camo; motion back (`fd-enter`, `data-reveal`, `data-spotlight`, scroll-linked Studio
settle) with no animated `filter` anywhere. Website says team, not church. About readable in Light (`light.css`).
Product pictures retaken from neutral content (`hosted/public/product/`). Left for the owner: the About story and
`brand.js` mission (the owner's own ministry words), the program's own church-flavoured presets and templates
(Sunday Service, Bible Study; program content, protected), docs/guide/roles, the `Start FRAMEDECKS*.bat` file names.
Visual suites: run `src/server.py` with no other program server on 8750 (a stray one makes them test the wrong data).
The FrameRelay panel is still built at start (it updates its controls in place every poll).
Gotcha: `next build` reuses its cache; after CSS changes that do not appear, delete `hosted/.next` and `hosted/out`.
Earlier: ranks 1–7 and 9–11 are done (5–7, 9–11 on 26 October: `hosted/src/lib/when.ts`,
`content-kind.tsx`, the phone tab bar in `app-shell.tsx`, landing screenshots in `hosted/public/product/`; retake those
if the Studio or Live page changes look). Earlier: ranks 1–4 are done (DD-01 camera labels, `tests/test_camera_name.py`; DD-03
first run, DD-02 overlaps and Teleprompter empty state, DD-13 command bar words, `tests/test_ui_labels.py`). Next in
the list: 8 microcopy voice pass (DD-16), 12 state kit (DD-15), 13 typography (DD-04), 14 Lucide icons (DD-06). Desktop items need the owner's go-ahead; website items do not.
Owner checks on Windows: a new data folder shows Welcome to FrameDecks with Start fresh first; the command bar at
the PC's real width.

## Recommended Next Task
Verify the production deployment for PR #39. Then, in order:
1. **Owner's live tests** with the installed **6.11.1** release: A–I in
   [docs/qa/live-test-guide.md](../qa/live-test-guide.md) (H: Run, Practice and its reminder; I: the website's new
   places and front page), plus the website settings (change Branding on the website, see it in the program within a
   minute). (`0009` is run.) Fix what they find; mark each test done in the four files.
2. **Owner decisions still open:** the About story's wording (`app/js/brand.js`: mission, vision, story are the
   owner's ministry words; the website shows them too); the program's church-flavoured presets and templates
   (`app/js/store.js` PROFILES and templates: Sunday Service, Bible Study, Funeral…; program content, protected);
   projector legibility and templates by type; the Wi-Fi remote redesign (protected); real quotes and photos.
3. **6.12 (W3): remove the Excel Meeting Workbook** (import, template, export) — only **after** the owner reports test G
   passed. Do not start it before.
4. Owner tasks with no code: Google brand re-verification; E1–E3 (public repo, SignPath); an NVDA/Narrator pass.
Do not start new features unless the owner asks. If there is nothing to fix, say so and stop.

## Files Likely To Change Next
Whatever the live tests find:
- `src/cloud_sync.py`, `src/cloud_remote.py`, `src/server.py`, `app/js/frame-lists.js`, `app/js/audio-player.js`,
  `src/pptx_export.py`, `src/ai.py`;
- `hosted/src/components/*-panel.tsx`, `hosted/src/lib/*.ts`;
- `hosted/supabase/migrations/`: a **new numbered** migration with its own grants and an undo script in
  `hosted/supabase/rollback/`; never an edited one;
- the four continuity files in `docs/continuity/`.

## Session Handoff (VS Code on Windows)
Setup and the full check list are in [PROJECT_GUIDE.md](PROJECT_GUIDE.md) under "Working locally" and "Commands".

Start by fetching and checking out the branch:
- `git fetch origin`
- `git checkout main`
- `git pull`

Before and after every change, run all the checks in PROJECT_GUIDE.md. At the end of every step, update all four
continuity files in `docs/continuity/` in the same commit (owner's rule). Never force-push.

## Three settings on the website (26 October, owner's request)
- **Branding** page (Plan → Branding): Meeting Name, Leader or organization, accent colour, "New Frames include branding".
  Writes the synced `brand` record; the logo is kept as it is (pictures stay on the PC).
- **Transition style** on the Meeting Form: the program's eight profiles; writes `layout/profile` `{value}`.
- **Birthdays this week** on the dashboard, from the synced member list (ISO or `--MM-DD` birth dates; 29 Feb on 28 Feb).
- Fixed in passing: things revealed on scroll inside a block that arrived later (the birthday pills) now appear.
- Owner test: change branding on the website and see it in FrameDecks → Settings → Meeting & Branding within a minute.

## Old name removed (26 October, owner's request)
- Every "Kingdom Connect" reference is now FrameDecks: docs, release notes, file names (`packaging/framedecks.ico`,
  `assets/samples/framedecks-members-*.xlsx` (renamed from `FRAMEDECKS-Members-*` on 28 October), `docs/project/history/framedecks-redesign.html`), the camera files
  (`framedecks_vcam64/32.dll`, `register-/unregister-framedecks-camera.cmd`) and internal names.
- The Excel Meeting Workbook's header said "KINGDOM CONNECT"; regenerated with `tools/make_meeting_workbook.py`.
- The camera picker now recognises its own "FrameDecks" camera again (it looked for the old name).
- Kept on purpose (upgrades only): see PROJECT_GUIDE.md Gotchas. The installer removes the old-named camera files and
  registers the camera again from the new ones. Owner check: after installing, the camera still shows in Zoom.
- GitHub's old "Kingdom Connect 6.9" release can only be changed by the owner (publish 6.11; delete or rename 6.9).

## FrameRelay and the 6.11 release (26 October, owner's request)
- The virtual camera is now called **FrameRelay** (Zoom/Teams/OBS name and every label that names the camera; same
  device ID). The website's camera check also accepts the earlier name. Owner-approved; recorded in PROJECT_GUIDE.md.
- The tag build for v6.11 failed at "Write the branded release notes": `tools/make_release_notes.py` crashed on the
  empty `motto` in `app/js/brand.js`. Fixed, with `tests/test_release_notes.py`. Release notes rewritten.
- **Published** 26 October: Releases → FrameDecks 6.11 with the About header, notes, `FrameDecks.v6.11.exe` and `.sha256`.

## Fixes from the owner's first 6.11 install (26 October)
- **"Could not reach framedecks.pages.dev: Forbidden"** in FrameDecks account: Cloudflare refuses Python's default
  identity. Every request to the website and the database now says `FrameDecks (Windows; ...)` (`cloud_sync.USER_AGENT`,
  tests in `test_cloud_sync.WebsiteIdentity`). Not verifiable from the remote build environment (the host is blocked there).
- **Teleprompter froze the program on unpin:** the window op `on-top` used pywebview's `on_top` setter, which waits on
  the window's thread. Now `desktop_win.set_topmost` (SetWindowPos with SWP_ASYNCWINDOWPOS, never waits). Owner to test.
  If the program is frozen: Task Manager → end every FrameDecks task, then open it again.
- **Settings menu** grouped and described, with "Find a setting" (owner-approved; PROJECT_GUIDE.md).
- These are on `main` but not in the published v6.11 installer: take it from the latest "Build Windows installer" run
  (Actions → Artifacts), or publish a new release.

## Website performance on older PCs (26 October, owner's request)
- Measured with Playwright + CDP (stand-in data): the main thread was light (4-5 MB heap), but the landing page and
  dashboard ran 9 endless animations: three 58vmax blurred glows drifting behind every page, an emblem glow
  morphing its border-radius (repaint each frame), a wordmark shimmer (repaint), the "How it works" lights moving
  `left` (layout each frame), and a pulsing dot; seven glass surfaces re-blurred what moved behind them.
- Now: the ambient light is one static gradient layer; every animation runs a few times and stops; the moving light
  uses transform; `backdrop-filter` only on the two sticky bars; the pointer light updates once per frame, mouse only.
  After load nothing animates on its own (only scroll-linked effects while scrolling).
- The program's server idles at ~0.1% CPU and 62 MB; its page has no running animations; the Studio preview is
  polled only while the Studio canvas is visible, and unchanged pictures answer 304.

## Production audit (26 October, read-only)
- Report: [docs/project/2026-10-26-production-audit.md](../project/2026-10-26-production-audit.md). No code changed.
- Verdict: conditional GO for the supervised pilot; NO-GO for a public release until H1 (plan-file recovery and sync
  mass-delete guard), H2 (signing) and H3 (pin build inputs by SHA) are done and live tests A–G pass.
- Nothing from it is implemented yet: each fix waits for the owner's approval (SAFE items first, then H1 as 6.11.1).

## 6.11.1: audit steps 1 and 2 (26 October, owner's request)
- Built and on `main`: H3 (Actions and softcam pinned by SHA, Dependabot, release job alone has write access),
  M1 (X-Frame-Options / frame-ancestors / Permissions-Policy), M3 (local API refuses cross-site calls), M8 (42 silent
  `except Exception: pass` now log via `errlog.swallowed`, rate-limited), M10 (`0009_seen_throttle.sql` + undo),
  H1 (damaged plan kept aside, newest backup opened, Diagnostics row; linked PC adopts the workspace; all-Frames-gone
  guard). Version 6.11.1, release notes `docs/releases/v6.11.1.md`, About header recaptured.
- Owner: (1) run `hosted/supabase/migrations/0009_seen_throttle.sql` in the Supabase SQL editor (done 27 October); (2) test on Windows:
  Teleprompter pin/unpin, FrameDecks account linking, the Settings menu, and the camera in Zoom.
- Next from the audit (step 3): live tests A–G, M9 (other window operations non-blocking), M7 (one OpenCV).

## Stream Deck plugin removed (26 October, owner's request)
- Deleted `streamdeck/`, its workflow, `tools/make_streamdeck_icons.py`, the local `/api/command` and
  `/api/command/status` endpoints (`server.run_local_command`, `local_status`) and `tests/test_local_command.py`.
  This also closes audit finding N1 (the plugin's vulnerable zod). Companion and Wi-Fi remotes are unchanged.

## Audit roadmap step 2 (26 October, owner's request; all in published 6.11.1)
- Built: non-blocking window buttons (M9); one OpenCV (M7); Save support bundle; update notice (About, once a day,
  never downloads); Desktop checks workflow (ruff + JS syntax + doc links); website performance budget; installer
  smoke test (install, start, ping, quit, uninstall) in the Windows build; nightly backup self-check + checksum;
  failure issues for the DB workflows; offline-cache trimming; fsync of the plan file; release checklist with
  rollback (`docs/development/release-checklist.md`).
- Owner: `0009` is run (27 October); next the Windows checks and live tests A–G on the published v6.11.1 release.
- Next (step 3, before going public): signing, full CSP, phone-remote sessions/PIN, backup location, outside
  penetration test, 6.12 Excel removal.
