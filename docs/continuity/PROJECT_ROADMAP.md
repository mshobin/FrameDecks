# PROJECT ROADMAP

Phases follow [modernization-status.md](../project/history/modernization-status.md), which is authoritative for detail.
Updated 28 October 2026 (after the second reorganization check, the four-step structure clean-up and the repository standard, all green). FrameDecks 6.11.2 (maintenance: repository layout, trust fixes) is published at `v6.11.2` (verified after the reorganization; licence and lint-config follow-ups on `main`), after 6.11.1 (`v6.11.1`); the README/release header wordmark was refreshed in PR #38; trust fixes (#39), the Windows budget-script fix and five Action upgrades (#33–#37) are on `main`, all green. The live Supabase database has every script, `0001`–`0009` (`0009` run 27 October).
Repository clean-up is on `main` (modules in `src/`; `README.md`, `LICENSE`, `NOTICE` and `ruff.toml` at the top level; `CONTRIBUTING`/`SECURITY`/`SUPPORT`/`CODE_OF_CONDUCT` in `.github/`; `THIRD_PARTY_NOTICES.md` in `docs/legal/`; user guides in `docs/guide/`, developer docs in `docs/development/`, finished plans and audits in `docs/project/history/`; images named `framedecks-*`); the maintainer guide is [PROJECT_GUIDE.md](PROJECT_GUIDE.md) (active references updated), and the Windows batch launchers are in `tools/launchers/`. They resolve the repository root before running. No application behaviour change. The frozen build was tested here; the next tag still runs the real installer workflow.
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
| Control a service from the companion (Phase 5) | Design agreed ([remote-control.md](../architecture/remote-control-design.md), R1–R5 as recommended); steps 1–3 built (database `0004`/`0005`, PC side `src/cloud_remote.py` and window bridge, Settings switch, companion Live page, "Can run services"); step 4 (live test by the owner) next |
| Edit services in the companion (D3 "next step") | Design agreed ([companion-editing.md](../architecture/companion-editing.md), E1–E4 as recommended); steps 1–2 built (editing helpers, Services page editing) plus Frame history and restore (30 days); step 3 (live test by the owner) next |
| Owner's live tests (sync, phone control, editing, history, members, new PC features) | One pass, tests A–F: [live-test-guide.md](../qa/live-test-guide.md); database ready (26 Oct); waiting for the owner's tests |
| Architecture audit follow-up ([audit](../project/history/2026-10-25-architecture-audit.md) §9) | Phase 1 built on PR #32: P1–P4, C2 crash watchdog. C1: signing ready (SignPath, M-D1), auto-update not designed yet |
| Stream Deck plugin | Removed 26 October (owner's request) |
| Target architecture migration ([review](../project/history/architecture-review.md), [plan](../project/history/migration-plan.md), [report](../project/history/post-migration-report.md)) | All 8 steps built on PR #32 (owner decisions M-D1–M-D6, 25 Oct): audit log, ESV key, missing-media check, API grants, licence and signing, members from the cloud, free AI (Ollama), PowerPoint export and Audio, member groups. Merged; database scripts run live (26 Oct). Next: live tests |
| Free for everyone ([free-hosting.md](../deployment/free-hosting.md)) | In progress: 1 static companion (live at framedecks.pages.dev); 2 keep-alive and encrypted backup (live, first runs green); 3 fewer database requests (done); 4 sign-in providers first (live: Google and Microsoft; Brevo skipped); 5 public repo, signing, Releases (owner) |
| 6.11: plan on the website ([meeting-form.md](../architecture/meeting-form.md)) | In progress: 1 camera check and Open FrameDecks link (built); 2 website Meeting Form (built); 3 Excel into Settings, version 6.11 (built); owner test G. 6.12 removes Excel after the owner's test (W3) |
| Camera renamed FrameRelay; v6.11 release notes | Built; v6.11 release published with the installer (26 October) |
| Audit roadmap step 2 (support bundle, update notice, CI checks, one OpenCV, non-blocking windows) | Built (26 October), ships in 6.11.1 |
| Design audit rank 1 (DD-01: every camera label says FrameRelay, with a test) | Built (26 October), ships in 6.11.1 |
| Design audit ranks 2–4 (DD-03 first run, DD-02 overlaps and empty states, DD-13 command bar words) | Built (26 October), ships in 6.11.1 |
| Design audit ranks 5–7, 9–11 (website dates, phone tab bar, landing, destructive actions, contrast, card previews) | Built (26 October); website live on deploy, program part in 6.11.1 |
| Design audit ranks 8, 12–21 (voice, states, type, icons, a11y, gold, composer, tokens + lint, design system + visual checks, Overview, light theme) | Built (26 October); the whole design roadmap is done |
| UX simplification (Prepare / Run, Practice, How people see it, Advanced, People, Live tools groups, glossary, website Running order and trust strip) | Built (27 October). Owner: Test H (live test guide) on Windows |
| Re-audit steps to 90+ (palette, radii/shadows, `!important`, lazy sections, axe scan in CI) | Built (27 October). Left for the owner: Windows check, a screen-reader pass (NVDA/Narrator), a real quote or usage fact for the landing page |
| Landing brief: FrameDecks spelling, every audience, motion back, About in Light | Built (27 October). Owner: About story wording, program presets |
| 10/10 plan: phases 1–2, owner-free parts of 3–4 (website four places, Plan, Home, first-time path, Help, identity, landing, Run polish) | Built (27 October). Owner: Test I; go-ahead for projector legibility, templates by type, the Wi-Fi remote; real quotes and photos |
| Repository structure clean-up (unused files, one `ruff.toml`/`LICENSE`, top-level `README`/`NOTICE`, docs by reader, `framedecks-*` images) | Done (28 October, `f260b47`–`55e98e2`); every check and the Windows installer build green; no behaviour change |
| Plan of 29 October: one-click linking, 4-screen front page, setup guide, synced workspace looks ([plan](../project/2026-10-29-onboarding-linking-themes-plan.md)) | Owner approved all four answers (29 October). 6.13 built (linking + front page); next 6.14 the Setup guide, 6.15 the six workspace looks; the new ideas of section 5 are on this roadmap |
| 6.14: Setup guide in the program and on the website (one step list, detected steps, Show me how) | On `main` (29 October). Owner: tag `v6.14`, live Test J on a fresh PC |
| 6.13: one-click linking (`/connect`, `0010_link_by_url.sql`), front page about four screens, GSAP removed | On `main` (29 October). Owner: run `0010` in Supabase, tag `v6.13` (after `v6.12`), live Test A |
| 7.0: commercial model: proprietary, framedecks.com downloads, R2 + update service, auto-update, legal and security pages ([plan](../project/2026-10-29-commercial-model-plan.md)) | On `main` (29 October). Owner: Email Routing, R2 + secrets, `wrangler deploy`, run 0011, tag `v7.0` before making the repo private, lawyer review, code signing |
| 7.1: workspace looks (was 6.15) | On `main` (29 October). Owner: live Test K, tag `v7.1` |
| 7.1.1: no shells (Defender false positive), launcher built from source | On `main` (31 October). Owner: tag `v7.1.1`, report the false positive to Microsoft |
| 7.1.2: release guards after the 1 November audit | Published (1 November) |
| 8.0.0: one Teleprompter, Frame cards, no Run/Practice, Setup wizard, plain camera settings, one-view phone remote | Published (1 November) |
| 8.1.0: Teleprompter transparency and pin, six looks, one Content view, website-matching restyle | On `main`; tag `v8.1.0` publishes it |
| 8.2.0: bare Teleprompter (controls in its bar, upload, script mode), Spotlight, transitions one per effect + Burst, .frame files, sync status chip | Published (tag `v8.2.0`) |
| 9.5.0: Welcome to FrameDecks (full-screen first start on the PC), KJV + WEB without a key, Church Service Quick Start, + Deck, neutral labels and wording | On `main`; owner tags `v9.5.0` |
| 9.5.1: speed on older PCs (welcome without blur filters or endless loops, follow-lens cache, `tests/visual/perf.mjs`) | On `main`; folded into 9.6.0 unless the owner tags `v9.5.1` |
| 9.6.0: Spotlight as a meeting remote (compact until you type, hidden from capture, Zoom / Teams / Meet keys, volume), one button style with the phone remote, website tokens from the program (`tools/design_tokens.py`), fresh product shots | Published |
| 9.7.0: Draw / Spotlight on the Share Window from Spotlight, Content arrows and live-only remote in Spotlight, Spotlight only on its shortcut, main window maximized, phone picture only sideways, welcome Going live page; phone sign-in recommendation (docs/architecture/remote-sign-in.md, owner decides) | Published |
| 9.10.2: Command Center smooth on older PCs (fixed window size, transform/opacity-only motion, panels built once) and no grey flash on first open | Published |
| 9.10.3: the cloud's address and publishable key built into the program (website is the backup when linking a PC) | Published |
| 9.11.0: live push (doorbell; docs/architecture/live-push.md) and the Command Center tray that folds away | Published (0016 run) |
| 9.11.1: website Go to Home when signed in; How it works + See it work as one stage | Folded into 9.11.2 |
| 9.11.2: website motion (one rhythm, living hero, progress line, closing scene, pointer light, button moments) | Published |
| 9.12.0: Command Center Notes, Compact and top/centre/bottom, one place per action; Settings in six groups | Published |
| 26.11.1: motion everywhere it helps (Go Live moment, Frames that move, reading band, phone swipe, undo timer, status pill, teaching empty lists, switches), light on 4 GB PCs | Released |
| 26.11.2: top bars that fit every window, voice while in front, Command Center opens cleanly, Defender scan before release and no downloaded program code | Released |
| 26.11.3: the Command Center with nothing behind its glass over the desktop; the new website front page | Released |
| 26.11.4: Help: error codes and Check my connection, ? links and Help search, Keys and What's new, clips and Was this helpful?, support report and Ask Help | Released |
| 26.11.5: floating controls: the Command Center's chip panels and the phone remote with no boxes inside, colour only for meaning | Released |
| 26.11.6: the Command Center's window cut to the shape it shows (SetWindowRgn), so no grey box on any PC | Released |
| 26.11.7: the meeting guard (measure in meetings, lighter FrameDecks, before-you-go-live line, busy hint); Teleprompter in Engage | Released; owner's report: camera 4 fps, FrameDecks 37-87 % GPU, 1.3 GB |
| 26.11.8: Branding Background slider; sharper meeting meter (GPU by process and kind, windows open and in front, page names); meeting mode in every window; Up next hidden not reloaded; memory figure fixed | Released; owner's report: GPU fixed (22-29 %), camera 30.7 in / 7.5 out, 133 ms per frame (blur) |
| 26.11.18: Command Center fix: back to the 26.11.13 shape timing (26.11.17 showed only the bar on Windows), curves and square joins kept, gentler pour | Released |
| 26.11.19: Command Center black box fixed (DeleteObject argtypes, one shape worker), fewer measurements while live, live Control fits 720 px | Released |
| 26.11.20: Voice commands (hold Right Ctrl / hold buttons), one waiting request per window (riders) so presses answer at once | Released |
| 26.11.21: Voice commands: Left Ctrl, F8 or your own hold key; a shortcut never starts listening | Released |
| 26.11.22: Premium feel: instant presses, Undo for 5 s, Smart Next, crash-proof live, sounds, Settings search and reset, motion and elevation | Released |
| 26.11.23: Meeting summary (print, PDF, email) and prayer requests wall (migration 0019) | Not tagged: released in 26.11.24 |
| 26.11.24: Members' phones (/follow, migration 0020), sermon notes, scripture said by members (meeting audio, ask-only) | Released with 26.11.25 (or tagged on its own) |
| 26.11.25: the leader's corner card (a verse heard, prayer requests) while the Studio is behind the meeting | Released (v26.11.25) |
| 26.11.26: joining without typing: Add a device signs the phone in as you, Connect this PC from the website, passkeys, Google/Apple/Microsoft | Released with 26.11.27 (or tagged on its own); owner steps done |
| 26.11.27: voice commands by name, a spoken verse asks first, website heading "Prepared before. Confident during." | Released with 26.11.28 (or tagged on its own) |
| 26.11.28: ready check (with light and framing hints), voice search in the Command Center, next week from this meeting, the summary's Moment, seasons (Christmas) | Released with 26.11.29 (or tagged on its own) |
| 26.11.29: Off air on the Go Live button, by press and hold | Released with 26.11.30 (or tagged on its own) |
| 26.11.30: the release audit's fixes (framing + enforced CSP, one status request, plan-recovery notice, Off air name, Ready check hurry line, queue, setuptools, Share Window) | Released with 26.11.31 (or tagged on its own) |
| 26.11.31: features you switch on or off (Settings, Command Center More, Welcome sets; off stops the work) | Released with 26.11.32 (or tagged on its own) |
| 26.11.32: Settings in six groups (Start here, Meeting look, Content, How people see it, People & devices, This PC) | Released with 26.11.33 (or tagged on its own) |
| 26.11.33: songs, speaker name tags, polls from members' phones (0022), timing plan | Released; 0022 applied |
| 26.11.34: Bluetooth microphones (microphone choice in Listening, default-microphone fallback, Ready check warning) | Released |
| 26.11.35: No season fix, Go Live always Go Live (hold for off air), instant Hide all | Released with 26.11.36 (or tagged on its own) |
| 26.11.36: smart first sync with preview and Undo; passkey-first sign-in; new-device alerts (0023) | Released; 0023 applied, device-alert live (Resend) |
| 26.11.37: phone is the key (Open with your phone, Open in this PC's browser), animated connect flowchart, passkey only where saved, add-email nudge | On `main`; owner tags `v26.11.37` |
| 26.11.17: Command Center waterfall restored (curved joins traced into the window shape, pour motion), never cut short (timer shape check) | Released; showed only the bar on the owner's PC |
| 26.11.16: Emergency + meeting clock on the Command Center and phone, phone Mute/Camera, Teleprompter in Engage only, Heard earlier, planned verses | Released |
| 26.11.15: Listen for scripture catches every verse (newest in a phrase, partials, retry, hidden Studio), Off/Ask/Auto in Control on the Command Center, top bar and phone; Freeze in the Command Center, Hide the cards on the phone | Released |
| 26.11.14: draw pad, Listen for scripture (microphone), run sheet, stage grip, Live / On screen, quieter top bar, Command Center chip pins + no box while moving | Released |
| 26.11.13: Live Stage (Mockup B), resize + wrap layout, switch fix, landing flowchart and scroll motion | Released |
| 26.11.12: Scan to join (0018), Live Presentation Stage, How people see it, Simple by default | Released; owner runs 0018, enables anonymous sign-ins, adds the code to the Magic Link email |
| 26.11.11: Command Center shape no longer needs page focus (grey box over Zoom fixed again) | Released |
| 26.11.10: blur on a second core (`BlurStage`), masks on the outline thread, no-person blur fix, Command Center Question/Both/Scripture | Released; owner sends the report after a Zoom meeting with blur |
| 26.11.9: camera keeps up (Pace steps the blur down and back), faster natural blur, no full-size blur | Released; report: 13.9 fps out of 29.7, 72 ms per frame |
| 26.11: Teleprompter Follow my voice (Vosk, own low-priority process, only while pinned); versions become YY.MM; old release notes and changelog archived; 4 GB check and preview leak fix | Published; clean-up done |
| 9.13.0: the five chips everywhere (top bar in place of Live tools, Command Center, phone remote tabs), Notes from the phone, Draw opens the Share Window | Published |
| 9.12.1: Spotlight on demand (double-click or Ctrl twice) with a bloom exit | Published |
| 9.10.1: no grey box behind the Command Center (form painted black: `desktop_win.clear_back`) | Published |
| 9.10.0: Command Center redesigned: frameless glass bar, four chips Prepare / Engage / Control / More with panels, Go Live switch, animations; Ask AI removed | Published |
| 9.9.0: the Command Center (was Spotlight): glass bar, context strip, five modules as scopes (Alt+1 to 5), Recent, prefixes, Ask AI, meetings and Memory Cards in the bar; phone remote in the same look | Published |
| 9.8.1: Spotlight never opens at start or reopen (lazy window), Security page with every protocol, legal pages in 9.8 wording, Help pictures of Sync Workspace | Published |
| 9.8.0: passwordless workspace (Sync / Save / Continue on Another Device, one-time link), Trusted Devices, Manage Devices, migration 0015, desktop section renamed Workspace Sync | On `main`; owner runs 0015 and the Supabase settings (docs/architecture/trusted-workspace.md §6), tagged `v9.8.0` (published) |
| 9.4.0: remote redesigned to run the whole meeting (tabs, portrait and landscape, Spotlight drag, video controls, Plan outline), Spotlight follows the pointer, Workbook Meeting plan (Frame > Deck > Content), Import from Excel in Quick Start | Published |
| 9.3.0: completes the production audit: report-only CSP (desktop and website), camera driver in Program Files, hashed build lock, migration 0014 (link limits, idle writes, account deletion, Make owner), state cache, frame buffers, private cards off the phone, sync keeps overwritten edits, backup MAC and the Low items (M11 deferred) | Published |
| 9.2.0: signed release manifests (active once the owner adds the key), updater and release workflow hardening (audit H3, M3, M4, L7–L9, part of M5) | Published (manifest signing left off for now, owner's decision; switch on later per docs/deployment/release-pipeline.md "Signed manifests") |
| Migration 0013: the team owner cannot be demoted or removed by an admin (audit H5) | On `main`; owner runs it in Supabase |
| 9.1.2: security and reliability patch (production audit 3 Nov: H1, H2, M1, M2, M8 and Low items) | Published (tag `v9.1.2`) |
| Next from the audit: cloud hotfix (M6 link-code limits, L11 account deletion leftovers), SignPath on (M3), fully hashed build lock (M5), 9.3 (CSP, frame buffers, state cache, overlay long-poll), later H4 (vCam DLL in an admin-only folder) | docs/project/2026-11-03-production-audit.md |
| 9.1.1: Capture Memory works on the phone remote (its script was refused to other devices) | Published (tag `v9.1.1`) |
| 9.1.0: Memory Cards as chat bubbles only (pop animation, several shown together in copy order, clear of every card), Capture Memory on the phone remote, the camera renamed FrameDecks vCam | Published (tag `v9.1.0`) |
| 9.0.0: Memory Cards in the FrameRelay chat overlay (beside / below / over the video, corner popup, Studio pane, pinned cards kept); Audience Dock removed; drag crash fixes | Published (tag `v9.0.0`) |
| 8.9.0: Safe Next (Up next strip under the Studio Canvas with warnings), Audience Dock Waiting/Shown + keys, chat window clear of the camera inset | Published (tag `v8.9.0`) |
| 8.8.1: the Audience Dock opens on screen on scaled displays (it was placed off the right edge) and takes typing when pinned | Published (tag `v8.8.1`) |
| 8.8.0: Audience Dock (Ctrl+C a chat message → a card on FrameRelay; click-through dock with Ctrl+Shift, handle, timer/pin/hide, Share Window option) | Published (tag `v8.8.0`); real-PC checklist in docs/architecture/audience-dock.md |
| 8.7.0: Spotlight as a soft see-through disc with settings, landing How it works Day 5 and a self-playing See it work | Tagged `v8.7.0` |
| 8.6.0: Quick Start imports .frame files, Teleprompter bar arrow, Help Center, sign-out to framedecks.com, Plan cards, wider pages | Published (tag `v8.6.0`) |
| 8.5.0: several meetings (the PC shows one at a time; Frame `group` = meeting; migration 0012) and a right-side flowchart timeline on the website Plan | Published (tag `v8.5.0`); 0012 in Supabase is the owner's |
| 8.4.0: .frame Use this plan + import check, Resync Linked PCs, Meeting Details of three fields, Help step-by-step guide with screenshots | Published (tag `v8.4.0`) |
| 8.3.0: website Plan in five guided steps, drag-and-drop timeline, Preview, Choose Animation, media kept in the browser and carried in .frame files | Published (tag `v8.3.0`) |
| 7.2: Azure Trusted Signing in the workflow (urgent after the Defender quarantine), Ed25519-signed release manifests | Next (both stay off until the owner adds the signing account / key) |
| Ideas from the 29 October plan, section 5 (run-through timer, "Take it home" phone page, backup operator, volunteer rota; safe Next preview built in 8.9) | On the roadmap, one at a time after 6.15, each with a live test |
| framedecks.com as the one address (redirects, TLS, cache, WAF) | Live (28 October): framedecks.com serves, pages.dev noindex. Owner: redirect DNS records (www, app, framedecks.app), HSTS, Supabase + Google URLs, then the pages.dev Bulk Redirect |
| 6.12: FrameRelay rename, still hero arrival, Proverbs 16:3, About wording | Prepared on `main` (28 October). Owner: tag `v6.12`, pilot install, check the camera name in Zoom/Teams |
| Landing redesign: pinned 4-step guide, demo, bento, statement, Reduce effects; signed-in visual pass | Built (28 October). Owner: real step screenshots (`hosted/public/product/step-*.webp`), compare with the mock-up file |
| Repository standard (`docs/development/repository-structure.md`: one layout for every repository) | Applied (28 October, `832a07b`–`4e88eda`, CI green); exceptions recorded; no behaviour change |
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
| Resolve drift: open PRs #8–#16 vs this plan (see PROJECT_STATUS.md) | Done 25 Oct: `main`'s plan stands; #8–#16 closed; their branches are kept as `archive/*` tags (28 Oct) |
