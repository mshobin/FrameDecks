# NEXT SESSION HANDOFF

Commit identity (owner's instruction, 4 Nov 2026): every commit is authored as `Shobin Mathews <276174545+mshobin@users.noreply.github.com>`; set it at the start of each session with `git config user.name "Shobin Mathews"` and `git config user.email "276174545+mshobin@users.noreply.github.com"`, and add no co-author or tool lines.

Updated 16 November 2026 (26.11.58 on `main`: release files for the sign-off work below; owner pushes tag v26.11.58 after CI. Owner to test on a real PC: members load after the DPAPI conversion; main window, Share Window, Teleprompter, Command Center open with the local key. Earlier the same day (after 26.11.57, not tagged: release sign-off audit (artifact TWyJteufCAXC4s62LMQ6Af) and its safe fixes. Legal texts rewritten for members' phones, legal basis, roles, processors, children; "on screen never leaves the PC" corrected in program, landing and FAQ; prayer/follow/download wording; Vosk notices; alert emails quote names; PIN `known_devices`; `save_private` via `write_atomic`; import skips `kc-remote-sessions.json`; migration 0027_signoff_safe (rooms close on unlink, pg_temp, export + delete) with hosted/tests/supabase-0027.test.mjs; vercel.json headers. Owner decisions still open: governing law (Terms/EULA stay "draft" until named), postal address, whether Vercel is retired, confirm processor regions in privacy.md. Owner steps: apply 0027 in Supabase; redeploy the device-alert Edge Function. Terms version not bumped (bump once with the governing law so people accept once). Not done (need review): PC-key self sign-in approval, code length/limits, admin policies, retention sweep, CSP enforce, remote session scope. Items 2-6 built (owner chose owner-only admin rules): migration 0028_codes_limits_retention (lock after lookup, 8-char codes, /64, daily salt table request_salts, owner-only invite/remove policies, pc_room_close clears poll+answers, members_phones_sweep with pg_cron if present); website accepts 6 or 8 chars, prayer_send sent:false, Members page owner-only Admin/Remove, CSP enforced with cloudHost(); tests supabase-0028 + room-codes; npm test now lists 0027/0028. Owner order: deploy website first, then apply 0028; enable pg_cron in Supabase (Database > Extensions) BEFORE 0028 or the hourly sweep is not scheduled (the lazy sweep still runs). Update signing ON (H1): owner made the key on their PC, secret MANIFEST_SIGNING_KEY set by the owner, public key 6e249884d5950a0b in TRUSTED_KEYS; a lost key means installed copies can never update again (owner keeps an offline backup); to change keys see docs/deployment/release-pipeline.md "Signed manifests".)

Previous: 15 November 2026 (26.11.57 on `main`: owner asked to build audit items 1-5, the confusing items, whole service, online Bible study and the roadmap as one tag (audit artifact 9oKTfhQUWRqTS6DLY2jZUh). Song Library `src/songbook.py` + `songs-lib.js`/`songs.js`; room screen `/api/displays` + `present_on`; `stage-display.html`; `service-tools.js` (themes, video next, Show a verse, discussion countdown + Breakout via `SC.discussion` / `question.at`); typed answers `0026_room_answers.sql` + `src/room_answers.py` + `answers.js` + /follow box; StaticCache/WOFF2/KCLazy/KCTick; smartNext on. Migration 0026 must be applied by the owner. tests/test_service_2611_57.py, hosted/tests/supabase-0026.test.mjs.)

Previous: 15 November 2026 (26.11.56 on `main`: owner built the three run-order mockups (canvas "Run order mockups"). `Scenes.flowDeckHolds` + every Next path steps a deck that is the current flow step first; `app/js/run-order.js` (Run order dialog `#mt-run`, `slidesAfter`), layer menu item for pdf. Fixed frame-order.js paint before strip. tests/test_run_order_2611_56.py.)

Previous: 15 November 2026 (26.11.55 on `main`: owner chose ideas 1, 3, 5 for Present slides. `KCSlides.open({dock: $('canvas-wrap')})` docks the presenter view in the Studio stage (Pop out → dialog), `sl-who` chip, `ON SCREEN` badge, Back to Studio; Share Window title `FrameDecks Share Window – what people see` + hover label (native `who_rect`, web `.who`), `.s2-present.on` green edge. A persistent green edge inside the Share Window was not added: Zoom would share it. tests/test_present_view_2611_55.py. Not built: idea 2 (People see mini preview) and 4 (first-time tip).)

Previous: 15 November 2026 (26.11.54 on `main`: Import a lesson. `src/lesson_import.py` (parts, questions, `find_refs`), `POST /api/lesson/read`, `app/js/lesson-import.js` (preview with ticks, builds Frames with scripture + question layers and `flow`, one Undo; own `freeName` because `SC.uniqueName` bumps a trailing number), `app/css/lesson-import.css`. tests/test_lesson_import_2611_54.py. Tuned on a made-up lesson: ask the owner for a real lesson PDF to check its layout. Owner also asked (suggest only) how Present slides could make clearer which window is which.)

Previous: 15 November 2026 (26.11.53 on `main`: owner asked that a PowerPoint's Settings match the cards of other decks, uniform, no blank spaces. `mediaForm`/`audioForm` now build cards via `mcard` (`sc-media`, main cards `sc-essential` shown in Simple; note `.sc-main` is taken by the Frame form); `fitCards()` sets `--sc-cols` (balanced rows, last card spans), rows stretch. tests/test_deck_settings_2611_53.py. Owner also asked (suggest only, not built) whether a lesson PDF could become Frames with questions and scriptures automatically.)

Previous: 15 November 2026 (26.11.52 on `main`: owner reported "When i added the ppt, and tried to present the slides, the app crashed". Fix: `slides.PDFIUM_LOCK` around every PDFium use (slides.py + vcam/layers.py PdfSource), deck_ready thumbnails pause between slides; `crash_reporter()` (faulthandler -> kc-crash.txt, in the support bundle). Not reproduced here (Linux, no PowerPoint): if it crashes again, ask the owner for the support bundle (kc-crash.txt and the supervisor's crash code in kc-app-log.txt) and look at vcam/powerpoint.LiveShow next. tests/test_slides_crash_2611_52.py.)

Previous: 15 November 2026 (26.11.51 on `main`: a Frame's order `sc.flow` (store.js `cleanFlow`, `Scenes.flow*`, `live.flow`; take starts at step 1; copies keep it via `freshIds`; `previewState(..., all)`), Next/Previous walk the steps everywhere (workspace, remote, spotlight-remote, voice-commands; live-stage Next step). `app/js/frame-order.js`: Set order UI under the preview + Look ▾ (Copy/Paste/Use this look for…; settings only via the WORDS list; own Undo, since Store.snapshot holds only the screen). tests/test_frame_order_2611_51.py. No migration. Tags: owner tags v26.11.50 at 7ace111 and v26.11.51 when green.)

Previous: 15 November 2026 (26.11.50 on `main`: type in the preview. `app/js/preview-tools.js` (`KCPreviewTools`): click selects a card (gold `.pv-sel`, corner handles, name tag), toolbar `.pv-bar` (Edit, A−/A+, ◀ n of m ▶, + item, Show/Hide, Delete with Undo), drag to move / corner to resize (text `pos` via `nearestPos`, question `qBottom`/`qWidth`, scripture `verseY`/`verseWidth`), double-click empty space → add menu (`kc-pv-empty` from preview-edit.js; new empty Text opens `typeNew`), Editing badge, keys. Area below = Settings as cards (`sc-cards`, `cardsMode` in workspace.js; Show text fields switch `kc-text-fields`; Simple mode still hides settings behind Design). Styles in app/css/edit-preview.css (in css_tokens DESKTOP). tests/test_preview_editing_2611_50.py. No migration. Owner suggestions pending (suggest only, not built): copy a Content's look to other Frames/Decks (Copy look / Paste look, "Use this look for…").)

Previous: 15 November 2026 (26.11.49 on `main`: meetings tabs/This PC runs/New from Copy (store `copyFrames`, website `copyFramesTo`, `meetingDates`); slides: `live.deck.nxt`, `KCSlides.nextWhat`/`statusWords`, Present mode in slide-sorter.js (Rehearse removed at the owner's word, 15 Nov: do not add it back), More ▾ via `KCSlideTools.items`, Live Stage Present slides / Next slide (presses the top bar's slide ▶, no requests), deck ready line in Content Settings (`POST /api/slides {op: ready}`), phone Clicker. tests/test_meetings_slides_2611_49.py. Capture Memory renamed Capture Chats (owner); its pane is now the `#mem-dlg` window from Engage › Memory Cards, not below Decks. No migration. Owner: try Present slides and the Clicker with a real .pptx on Windows.)

Previous: 15 November 2026 (26.11.48 on `main`: delete a whole meeting (Studio `Scenes.deleteMeeting` + Undo; website `deleteMeeting` in meeting-form-panel, refused while live); new meetings start with a blank Frame; members' phones /follow full screen (`FollowPanel` own layout, meeting name under the FrameDecks name, tabs at the bottom) with `follow-slides.tsx` (zoom, look back via `room_slides`/`room_slide`, handout when `notes.slides`); migration 0025_room_slides (owner applies; without it phones keep the small picture: `member_room.slides_ok=False` after one PGRST202); keep off phones `c.phones`/`c.nophone`; fixed the 26.11.45 bug where the slide picture pushed the screen over 0020's 16,000 bytes. tests/test_meetings_phones_2611_48.py, hosted/tests/supabase-0025.test.mjs. Owner: apply 0025 in Supabase.)

Previous: 14 November 2026 (26.11.47 on `main`: sync echo fix. `cloud_sync.Engine.run` took this PC's own push coming back in the next pull for an edit in both places whenever the Frame was edited between two rounds: the Frame reverted (lost scripture/question) and the edit became a "<name> (from <computer>)" copy; deletes came back. Now `agreed is not None and remote_hash == agreed["hash"]` keeps ours (after the held/adopt branches, so mass-delete restore still works); `sync_preview` matches. tests/test_sync_echo_2611_47.py (5 of 6 fail on the old code). Owner: copies made before stay in the workspace; review and delete. No migration.)

Previous: 13 November 2026 (26.11.46 on `main`: PowerPoint animations play. An animated .pptx deck is played by PowerPoint itself (`vcam/powerpoint.LiveShow`: read-only, macros off, window show, tucked behind, focus given back; Next = next click via GetClickIndex/GetClickCount, then GotoSlide along the run order; ended on layer change and atexit) and captured (`vcam/layers.LiveShowSource`: WGC on the show window, cropped to the `paneClassDC` slide pane and the slide's aspect; PDF slide until ready). Server `deck_live_pptx`/`deck_show`, `live.deck.click/clicks/animated`, Studio "Play animations" (`c.anim`). Fixed a 26.11.45 bug: `set_layers` did not pass a new page to the kept PdfSource, so the camera stayed on the old slide. Not tested against a real PowerPoint here (Linux): owner to check with a real animated .pptx before tagging. No migration.)

Previous: 12 November 2026 (26.11.45 on `main`: PowerPoint slides 1-6. `src/slides.py` (titles/text/notes from the source .pptx, thumbnails, run order, search); server-owned `live.deck` (`deck_live`/`deck_go`, `/api/slides`, stale-save guard, compositor page and zoom from it); every slide at once `app/js/slide-sorter.js` (Studio top bar `#lb-slides-t`, chip `slides`, palette, Command Center and phone "Slide 3 of 12"); Studio tools `app/js/slide-tools.js` (run order `c.order`/`c.skip`, hold, layouts, Songs Deck, share); Teleprompter `app/js/teleprompter-slides.js`; slide scripture offers (`slideScripture`); members' phones slide; voice "slide N"/"slide about". Animations not in this release (proposed for 26.11.46: per-click builds as images + "Play in PowerPoint"). No migration. Owner: check on a real PC with a real .pptx, then tag `v26.11.45`.)

Previous: 11 November 2026 (26.11.44 on `main`: members' phones QR code. Own encoder `src/qr_encode.py` (decoded by OpenCV in tests/test_join_qr_2611_44.py), `src/join_qr.py`; the code card carries `qr` and draws it on the camera and the overlay pages (`/api/join-qr.svg`); Settings -> Meeting & Branding `joinQr` off/beside/below puts it on the Branding badge via server-owned `live.join` while the room is open. No migration. Owner: check on a real PC (scan from a phone through Zoom), then tag `v26.11.44`.)

Previous: 11 November 2026 (26.11.43 on `main`: the members' side. Show the code on screen fixed (it was a Memory Card, so it skipped the Share Window unless memShare was on and left after 12 s): `Memory.put` with `everywhere` and `stay`, `/api/members` invite/uninvite, `codeOnScreen`; prayer and poll cards reach every screen too. "On members' phones" heading in Engage (chips.js `side`/`SIDES`, `.cc-side`, `.lc-side`), feature group `members`, website Help topic. Frame design unchanged. Owner: check on a real PC (Members' phones → Show the code on screen while sharing a window), then tag `v26.11.43`.)

Previous: 11 November 2026 (26.11.42 on `main`: the owner's report on the Command Center and Go Live. Top-bar Draw/Spotlight open the Command Center on Engage with the tool (`engageTool` -> `/api/app/spotlight {then}` -> `KCSpotlight.then`); the frame design is unchanged (the owner asked to keep the narrower tray); the panel keeps its size (`holdSize`/`natural`, max-height = window room, scroll inside); window height `spot_height()` up to 900 and `spot_y` clamps to the work area; Go Live: Command Center switch off only by hold, Next off air takes the selected Frame, pill says Live, Live Stage says On air. Owner: check on a real PC (Command Center pinned over Zoom, Next several times, top-bar Draw), then tag `v26.11.42`.)

Previous: 10 November 2026 (26.11.41 on `main`: voice commands understand natural speech and spoken name forms (`src/voice_commands.py` spoken_forms/understand/_relative; Frame "Also called" = `scene.aka`, only when set), Frames panel Sync with a read-only preview (`app/js/frames-sync.js`, `Engine.sync_preview`, `/api/sync` preview), per-round duplicate Frame guard, bigger scripture/corner cards and toasts, meeting clock out of the Frames header. 4 GB check green (studio idle ~3% settled, server 76 MB). No migration. Owner: tag `v26.11.41`.)

Previous: 10 November 2026 (26.11.40 on `main`: the website's left panel has a Next meeting card under Help (`components/side-card.tsx`: meeting name/date/Frames, 5 readiness checks, church PC, changes waiting for Sync Now), sharing Home's load (`lib/glance-data.ts`, cached a minute). JS 378/401 KB. No migration. Owner: tag `v26.11.40`.)

Previous: 10 November 2026 (26.11.39 on `main`: website Plan changes wait until Sync Now (`hosted/src/lib/plan-changes.ts`, box under the timeline, only differing Frames sent in one push, conflicts stay waiting, order merged, kept in localStorage); multi-select by Frame number in list and timeline with Delete selected; clicked Frame lit on the timeline. No migration. JS budget 400.94/401 KB: the next website feature needs a trim first. Owner: tag `v26.11.39`.)

Previous: 10 November 2026 (26.11.38 on `main`: the email code is the main way in on framedecks.com (Your email → Email me a code → six boxes; Whose computer is this? Mine = trust_device, Someone else's = tab only; unknown emails answered like sent and never create a user, only Start with email does; flowchart into the workspace). Migration 0024 `email_sign_in` + `device-alert` sign-in email to the person; Devices: Sign out other computers. Supabase Auth set to 6-digit code-only emails (template in hosted/supabase/setup/email-code.html). Owner: run 0024, tag `v26.11.38`.)

Previous: 10 November 2026 (26.11.37 on `main`: one way in, the phone is the key. PC Settings → Sync "Open in this PC's browser" (add-device code + `&go=1`, join page opens a self code without a click); website Open your workspace leads with Open with your phone, drawn as an animated flowchart (`components/connect-steps.tsx`, `.cs-*` in `app/join.css`) that connects into a picture of the workspace; passkey button only where one is saved (`fd-passkey`); Keep your workspace safe card asks a scanned phone once for an email and a passkey; Connect this PC hidden once the team has a PC. tailwind-merge and class-variance-authority removed for the JS budget (398/401 KB). No migration. Owner: tag `v26.11.37`.)

Previous: 10 November 2026 (26.11.36 on `main`: smart first sync (`src/first_sync.py`, preview before anything changes, meetings never mixed, fingerprint skip, list de-dup, Undo this connection for 7 days); passkey-first website sign-in without Google/Microsoft/Apple; new-device alerts (0023 + Edge Function device-alert). Owner: switch off the providers in Supabase, run 0023, deploy device-alert with its secrets and the webhook (docs/architecture/passwordless.md), tag `v26.11.36`.)

Previous: 10 November 2026 (26.11.35 on `main`: No season clears a synced season look (`store.js` `lookSeason`); Go Live always reads Go Live, hold to go off air (`off-air.js`); Hide all instant, no Undo. Owner: tag `v26.11.35`.)

Previous: 10 November 2026 (26.11.34 on `main`: Bluetooth microphones: Settings → Listening → Microphone (`microphone.js`, `voiceMic`), fallback to the Windows default when the chosen microphone stops (`voice_follow.py`, `mic` status part, toast), Ready check hands-free warning (`ready_check.handsfree`). Owner: tag `v26.11.34` after `v26.11.33`.)

Previous: 10 November 2026 (26.11.33 on `main`: songs (`song` kind, verses step on Next), speaker name tags (`nametags.js`), polls from members' phones (migration 0022, `room_responses.py`, `responses.js`), timing plan (`timing.js`); four new features. Owner: apply migration 0022, tag `v26.11.33`.)

Previous: 10 November 2026 (26.11.32 on `main`: Settings in six groups (Start here, Meeting look, Content, How people see it, People & devices, This PC); new pages sec-features, sec-pc, sec-listening, sec-memory; Recording on the vCam page (`recording` aliases to `vcam`). Owner: tag `v26.11.32`.)

Previous: 10 November 2026 (26.11.31 on `main`: features you switch on or off: `src/features.py` + `app/js/features.js`, `/api/app/features` (locked while live), Settings → General → Features, the Welcome's three sets, the Command Center's More → Features; off hides the feature everywhere (`data-feature`, `chips.js`) and stops its work. Owner: tag `v26.11.31`.)

Previous: 9 November 2026 (26.11.30 on `main`: the 26.11.29 release audit's fixes: pages refuse other sites' frames and enforce the CSP (`PAGE_FRAME_HEADER`, `CSP_HEADER`), the Studio's status in one request (`/api/app/status`, `KCStatus.part`), the plan-recovery notice, Off air's accessible name, the Ready check's hurry line, `request_queue_size = 64`, setuptools 84.1.0, `present.html` checks the engine first. Owner: tag `v26.11.30` (it carries 26.11.29 if not tagged), then the manual smoke test on a low-end Windows PC (camera, voice, installer, update).)

Previous: 9 November 2026 (26.11.29 on `main`: Off air on the Go Live button by press and hold (`app/js/off-air.js`; the top bar's Go Live while the selected Frame is on air, the Live Stage's button after the last Frame; 1 s, with Undo; clicks never go off air). Owner: tag `v26.11.29` (it carries 26.11.27 and 26.11.28 if they were not tagged).)

Previous: 9 November 2026 (26.11.28 on `main`: the ready check (`src/ready_check.py`, `/api/app/ready`, `app/js/ready-check.js`, under Go Live and in the Command Center's Control), light and framing hints (`src/vcam/hints.py`, only while the check is open), voice search in the Command Center (`VoiceCommands.search`, `cc-voice.js`), Next week from this meeting (`KCScenes.nextWeek`), the summary's Moment picture (`meeting-summary.js`, `share-moment`), seasons with Christmas (`KCScenes.setSeason`, `overlay.css html[data-season]`). Owner: tag `v26.11.28`. Untested here: the light and framing hints with a real webcam, voice search with a real microphone, Copy the picture in WebView2.)

Previous: 9 November 2026 (26.11.27 on `main`: voice commands by name (hold Right Ctrl: "go to <Frame>", a Deck of the live Frame by its name; `voice_commands.match(text, names)`, `server._voice_names`), a verse asked for by voice is offered first ("You asked for", `from: "voice"`, never Auto; "show it" confirms through `ScriptureListen.confirm`), the website's features heading "Prepared before. Confident during.", and the front page's one-chapter-per-gesture stage. The 26.11.26 owner steps are done on the live project (0021 applied, `device-sign-in` deployed, Passkeys, Google and Microsoft on). Owner: tag `v26.11.27` (it carries 26.11.26 if that was never tagged). Voice by name is untested with the real microphone here: try "go to <a Frame name>" on the PC.)

Previous: 9 November 2026 (26.11.26 on `main`: joining without typing (`docs/architecture/passwordless.md`): migration `0021_passwordless.sql`, Edge Function `hosted/supabase/functions/device-sign-in`, Add a device signs the phone in as the person (website `/join`, Devices, PC Settings → Sync), Connect this PC from the website (`framedecks://connect?grant=`, `app/js/connect-grant.js`, always asks), passkeys and Google/Apple/Microsoft shown only when switched on. Help topics now drawn on the server (`components/help-topics.tsx`) to make room: website JS 400 of 400 KB. After it, on `main`: the front page's stage moves one chapter per scroll, swipe or wheel turn (`.tr-snap` snap points, `target`/`step` in `components/landing/tour.tsx`), each chapter's story then plays by itself (`STORY`); total JS budget raised to 401 KB for it (400.25 used). Owner: run 0021, deploy `device-sign-in` with Verify JWT off, switch on Passkeys (and providers if wanted), then tag `v26.11.26`. Note: anonymous sign-ins were found still off on the live project (`/auth/v1/settings`); 26.11.26's Add a device does not need them.)

Previous: 9 November 2026 (26.11.25 on `main`: the leader's corner card (`src/leader_alerts.py`, `/api/alerts`, `desktop_app.alert_card`, `app/alert-card.html`, setting `leaderCard`): a verse heard or a prayer request waiting, while the Studio is not in front. Owner: run migrations 0019 + 0020 in Supabase, then tag `v26.11.25` (it carries 26.11.23 and 26.11.24). Check on Windows: the card appears over Zoom, is not in a shared screen, and Show works.)

Previous: 9 November 2026 (26.11.24 on `main`, which also carries 26.11.23 (never tagged alone): Members' phones (migration `0020_member_room.sql`, website `/follow`, `src/member_room.py`, `/api/members`, `app/js/members-phones.js`), sermon notes (`meeting_log.sermon_notes`, `/api/summary/notes`, the summary dialog's second view), and scripture said by members (`src/loopback.py` WASAPI loopback, `voice_worker` meeting ear, setting `scriptureMeeting`, never Auto). Owner: run migrations 0019 and 0020 in Supabase, then tag `v26.11.24`. Website JS is at 399.99 of 400 KB: the next website change must make room first. The loopback code is untested on real Windows audio here: check it on the PC.)

Previous: 9 November 2026 (26.11.23 on `main`: meeting summary (`src/meeting_log.py`, `/api/summary`, `app/js/meeting-summary.js`) and prayer requests wall (migration `0019_prayer_wall.sql`, website `/pray`, `src/prayer_wall.py`, `/api/prayer`, rider `pr`, `app/js/prayer-wall.js`; shown as Memory Cards). Owner: run 0019 in Supabase, then tag `v26.11.23`. Website JS is at 399 of 400 KB: the next website page needs room made first.)

Previous: 9 November 2026 (26.11.22 on `main`: premium feel. Optimistic `Store.update`; Undo for 5 s (`Store.snapshot`/`restore`/`undoable`); Smart Next (`KCScenes.smartNext`/`smartApply`, `live.smart`, setting `smartNext`); crash-proof live (`kc-running.flag`, `RECOVERED` in `/api/app/info`); sounds (`app/js/ui-sound.js`, `uiSounds`); Settings search inside pages and Reset this section (`app/js/studio-feel.js`, `/api/app/settings-reset`); motion/elevation tokens; tests/test_premium_2611_22.py. Next: 26.11.23 prayer requests wall and the meeting summary. Owner: tag `v26.11.22`.)

Previous: 8 November 2026 (26.11.21 on `main`: Voice commands' hold key is Right Ctrl, Left Ctrl, F8 or your own (`k:<vk>+<vk>`, recorded in Settings → Scripture); a hold starts after 0.25 s held alone and another key cancels it quietly (`voice_commands.key_step`, tests/test_voice_keys_2611_21.py). Owner: tag `v26.11.21`.)


Previous: 8 November 2026 (26.11.20 on `main`: Voice commands, hold to talk (`src/voice_commands.py`, settings `voiceCommands`/`voiceKey`; a third grammar in `voice_worker.py` heard only while held; the Studio runs commands in `app/js/voice-commands.js`; hold buttons in `app/js/cc-voice.js` and `app/js/remote-voice.js`; never Go Live / Leave / Share / Emergency). Also the real cause of slow presses: each window held several long-polls and WebView2 allows ~6 connections per host for all windows together (measured 0.5–9 s per request; 2–3 ms after). Now one waiting request per window: `Store.ride(name, fn)` (riders vl, vc, mem on `/api/state` and `/api/rev` via `also=`; `{unchanged: true}` when only a rider moved). Never add another long-poll to a desktop page: ride instead. Owner: tag `v26.11.20`, then on Windows try Right Ctrl + "next frame" while live, and check presses are instant.)

Previous: 8 November 2026 (26.11.19 on `main`: the owner's photo after 26.11.18 showed the whole Command Center window as a black box and slow presses. Root cause of the box (and of 26.11.17's bare search bar): `gdi32.DeleteObject` had no argtypes, so a region handle with its top bit set raised in `desktop_win.clip` before `SetWindowRgn`; every GDI call that takes a handle is now declared (tests/test_cc_box_2611_19.py checks it), `_free` never costs the shape, and `desktop_app.shape_later` applies shapes on one worker, newest last. cc-shape.js ignores text-only changes (the meeting clock caused five measurements a second); the Control panel writes attributes only on change. Live Control now fits the 720 px window (26.11.19 block at the end of spotlight.css). Chips open at once: `cc-enter` is removed 0.95 s after opening (it stayed on, so every panel waited 0.24 s). Owner: tag `v26.11.19`, then check on Windows: no box, presses quick, Meeting row visible.)

Previous: 8 November 2026 (26.11.18 on `main`: 26.11.17 left the Command Center as a bare search bar on the owner's Windows PC (could not be reproduced in a browser). cc-shape.js is back to the 26.11.13 timing with only pure additions (fillets, square joins, timer exact check, try/catch). Do not reintroduce frame-by-frame (requestAnimationFrame-loop) shape following; change cc-shape.js only with the owner testing on Windows. Owner: tag `v26.11.18`.)

Previous: 8 November 2026 (26.11.17 on `main`: the owner's photo showed the Command Center as a straight box cut short. Cause: the window shape (cc-shape.js) never included the tray's concave joins (pseudo-elements), and an old shape could stay after opening. Fixed with traced fillets, square joins, a timer check, and a pour/drop opening motion. Never let the window shape drop pseudo-element decoration again. Owner: tag `v26.11.17`; confirm on Windows.)

Previous: 8 November 2026 (26.11.16 on `main`, the owner's picks from the 26.11.15 suggestions: Emergency screen and the meeting clock in Control on the Command Center and phone; Mute and Camera from the phone via signed-in `/api/remote/meeting-key` (Leave and Share deliberately not offered); the Teleprompter in Engage only everywhere; Listen for scripture's Earlier list (op `replay`) and planned verses (`server._plan_passage`, shown from the plan with no lookup). Owner: tag `v26.11.16`; try phone Mute/Camera in a real Zoom meeting.)

Previous: 8 November 2026 (26.11.15 on `main`: the owner found Listen for scripture missed a second verse. Causes fixed: only the first reference in a phrase was read, only after a pause, a 45 s repeat block, no retry after an error, and a hidden Studio's throttled timers (verse-listen.js now long-polls with no timer between requests). Off / Ask / Auto plus Show / Dismiss are in Control on the Command Center (`app/js/cc-listen.js`, in Control's header because the 720 px window is full while live), the top bar and the phone (`app/js/remote-listen.js`, signed-in `/api/remote/verse-listen`). Chip audit: Freeze added to the Command Center (Alt+F), Hide the cards to the phone, the phone heading Memory Cards, duplicate palette key fixed. Not done (suggested): Emergency screen on the Command Center and phone, a read-only meeting clock in Control, phone meeting-app keys. Still untested with real speech here. Owner: tag `v26.11.15`.)

Previous: 8 November 2026 (26.11.14 on `main`: (1) the draw pad, `app/js/cc-drawpad.js` (Draw and Spotlight in the Command Center draw on the live picture into `live.ink`, no Share Window unless How people see it is Share a window); (2) Listen for scripture, `src/scripture_speech.py` + `src/scripture_listen.py` + `app/js/verse-listen.js`, one listener process shared with Follow my voice (`src/voice_worker.py --scripture`), microphone only (meeting-sound loopback was not built: it needs Windows audio code that could not be run here), untested with real speech, since the Vosk model cannot be downloaded in the cloud container; (3) the run sheet, `app/js/run-sheet.js` (`live.since`, `sc.plan`), the stage border grip, Live / On screen wording, the quieter top bar while live (`body.kc-live`); (4) the Command Center: a chip is its own pin (`kc-cc-tray` holds the chip id), the arrow tab removed, and `cc-shape.js` follows moves frame by frame and sends shapes in order (no box behind while a panel or the pad moves). Owner: tag `v26.11.14`; check over Zoom that the pad's ink shows on the camera and that no box shows behind the Command Center while chips open; try Listen for scripture with a real microphone.)

Previous: 8 November 2026 (26.11.13 on `main`: the Live Stage, Mockup B, owner-approved after three mockups: the picture takes the Studio's room beside one column (status, Up next, one Go Live/Next button; Advanced adds status tiles and In this Frame) — `app/js/live-stage.js`, `.stage-row` in `css/theme.css`; the border under the stage fits the picture (snap + double-click) and dragged far up switches to the wrap layout (`.ws.wrap`, `js/panels.js`); Simple | Advanced moved to the editor's bar; the Settings `.big-switch` double knob fixed; the website landing's flowchart, sooner Studio (Advanced) and scroll-linked, reversible motion. Next: the owner tags v26.11.13. 26.11.12's Supabase steps (0018, anonymous sign-ins, Magic Link code) still apply if not yet done.)

Previous: 8 November 2026 (26.11.12 on `main`, one tag for four pieces of work: (1) Scan to join, migration 0018 (the owner runs it, switches on Authentication → Allow anonymous sign-ins, and adds `{{ .Token }}` to the Magic Link email; docs/architecture/scan-to-join.md §5), PC Settings → Sync (`app/js/account.js`, `src/cloud_sync.py`), website /join, /allow, simpler /sync, one /devices page; (2) the Live Presentation Stage (`app/js/stage-status.js`); (3) How people see it: Camera / Share a window / Both (`peopleSee`, vCam not started for window only); (4) Simple by default (`app/js/simple-mode.js`, `studioMode`; the owner chose changes 2–10 of the design review and kept every name: Frame, Deck, Go Live). Help screenshots retaken (tests/visual/help-shots.mjs switches to Advanced for pc-bar). Next: the owner tags v26.11.12, runs 0018 and the two Supabase settings, then tries Add a device with a phone.)

Previous: 7 November 2026 (26.11.11 on `main`: the owner's photo in a Zoom meeting showed the grey box behind the Command Center again. Cause: da0be19 (26.11.7) gated `cc-shape.js` on `document.hasFocus()`, which is often false for a window opened by the shortcut or pinned behind a meeting, so no shape was sent. Now `KCShape.wake()`/`rest()` from the program, and the last rects re-applied before show and after resize (`state["spot_rects"]`). Never gate the shape on focus again. Owner: tag `v26.11.11`, check over Zoom with the Command Center pinned. Before that, 26.11.10 (released): the 26.11.9 report showed 13.9 fps out of 29.7 in, 72 ms per frame, blur model 45 ms, Pace level 2: the camera loop ran on one core in series. `vcam.engine.BlurStage` runs the blur of frame N on its own thread while the loop finishes N-1; the outline thread builds the natural masks (`BackgroundBlur.want`); fixed the 26.11.9 crash with nobody in the picture (empty box); Command Center Control has a Shows switch (Question / Both / Scripture, `#spr-qs`); the support report says the picture size. Report after a Zoom meeting with blur still wanted. Before that, 26.11.9 (released): the 26.11.8 report showed the graphics card fixed (PC 22-29 %, pages ~0) but the camera at 7.5 fps out of 30.7 in, 133 ms per frame, blur model 47 ms (this PC is ~5x slower than CI); `vcam.engine.Pace` steps the blur down (5/s outline, then `blur.coarse`: the same natural blur on a picture half as big) and back; natural blend in uint8, only in the box around the person; no full-size blur. Owner asked for an organic blur with no halo: `blurStyle` is always natural, Classic removed from the vCam panel (a saved classic reads as natural). Owner: tag `v26.11.9`, send the next report. Before that, 26.11.8 (released): Branding → Background slider (`c.bg`); meeting meter split by process/kind + windows open/front (`split_gpu`, `windows_now`), `meeting-mode.js` (`kc-meeting`, `KCGuardRest`), Up next hidden instead of reloaded, memory figure fixed. The owner's 26.11.7 report: camera 4 fps (583 dropped), PC CPU/GPU to 100 %, FrameDecks GPU 37-87 %, 1.3 GB; next report will say which part. Owner: tag `v26.11.8`. Before that, 26.11.7 (released): the meeting guard (`src/meeting_guard.py`; `/api/app/guard`; Control chip `.cc-guard`; Studio/Up next rest behind a meeting; blur 5/s while busy; support report line) after the owner's Task Manager photo (GPU 99 %, FrameDecks 43 %, WebView2 40 %, Camera app 23 % during Zoom). Not yet known which part used the GPU: the owner sends **Send a report to support** after a Zoom meeting and its `Meeting guard:` line says. Teleprompter also in Engage (`alsoIn`). Owner: tag `v26.11.7`. Before that, 26.11.6 (released): the owner's photo after 26.11.5 still showed a grey box behind the Command Center on a real PC; the window is now cut to the shape of what it paints: `app/js/cc-shape.js` → `api/app/win` op `clip` → `desktop_win.clip` (SetWindowRgn of rounded rects, `shape_boxes`). Owner: tag `v26.11.6`, then check on the same PC over the Studio and the desktop. Before that, 26.11.5 (released): floating controls (owner's request): in the Command Center a chip's panel is the one glass sheet and nothing inside it is boxed (26.11.5 block at the end of `app/css/spotlight.css`), the phone remote the same (block before the reduced-motion rule in `app/css/remote.css`); colour only for meaning; tests `tests/test_floating_2611_5.py`; pictures recaptured. Owner: tag `v26.11.5`. Before that, 26.11.4 (released; owner runs 0017 in Supabase): Help, in the owner's order: error codes (`app/js/help-codes.js`, copied to `hosted/content/help-codes.json`) and Check my connection (remote-panel.js `cxSteps`, only `server.SETTINGS_PAGES` open); ? links (`LINKS` in help-codes.js) and Help search (`lib/help-search.ts`, `lib/help-index.ts`, Error codes topic, `help?code=`); Keys (`app/js/keys.js`, ? in the Command Center, Settings box, `content/help-keys.json`) and What's new (`app/js/whats-new.js`, once per version, returning people, never live); clips (`tools/make_help_clips.py`, `public/help/clips/`) and Was this helpful? (`components/help-vote.tsx`, migration `0017_help_votes.sql`: owner runs it in Supabase); Send a report to support (settings.js `supportReport`) and Ask Help (`components/help-bot.tsx`, no AI). Tests `tests/test_help_2611_4.py`, `hosted/tests/help-search.test.mjs`, `supabase-0017.test.mjs`. Owner: run 0017, then tag `v26.11.4`. Before that, 26.11.3: the Command Center's black box over the desktop fixed: the window pywebview makes hidden stays layered (Opacity 0 → 1), so DWM ignored per-pixel see-through and the black form showed; `desktop_win.unlayer` + `AllowTransparency = False` in `clear_back`, called in `spot_prepare` and on every open; owner: check on a real PC with the program in the tray, then tag `v26.11.3`. Before that, website only: the front page is one pinned stage, `hosted/src/components/landing/tour.tsx` + `app/tour.css`: on arrival a Frame, its Decks and Content build themselves and fly into the real Studio screenshot; scrolling moves through real screenshots (Command Center, Teleprompter, Spotlight, live Control, phone remote) with the app's own keys; every picture of the program comes from `tools/make_product_shots.py` (now also teleprompter.webp and phone-remote.webp); the old hero/showcase/how-it-works/feature-tabs/next-demo are deleted; motion rules for tour.css in `hosted/tests/motion-rules.test.mjs`. 26.11.2 tagged and released. Earlier: 26.11.2 on `main`: the content area under the preview redesigned (label and add buttons in `#insp-tools`, question card grid, scripture/birthday/Frame columns, folded settings as a row of buttons; layout facts in tests/visual/layout.mjs) and linked to the preview (click a card → its item pings; choose an item → outline; live edits are drafts with Update screen / Enter twice; hint `#pv-hint` until used, `kc-pv-hint` in localStorage). Top bars fit by measuring (`app/js/bar-fit.js`, `data-bar-fit` on `.cmdbar` and the Teleprompter's `.sp-row`s, levels in theme.css / speaker.css; old `.cmdbar` width breakpoints removed); Follow my voice listens while pinned or in front (`inFront` in speaker.js, status `front`); Command Center made off-screen and see-through from first paint (`spotlight.html?glass=1`, x/y -32000) so no empty box on first open; Defender: the Vosk DLLs ship in the installer (`src/voice_runtime`, git-ignored, from build-windows.yml), only the model downloads, the installed app's worker starts without CREATE_NO_WINDOW, and build-windows.yml scans dist with MpCmdRun and stops the release if flagged. Not changed yet and worth a real-PC look: the installer's hidden elevated `register-framedecks-camera.cmd`. Tests `tests/test_bar_fit_2611_2.py`, bar checks in layout.mjs. Owner: tag `v26.11.2`. 26.11.1 (tagged): motion (`app/js/motion.js`, `app/css/motion.css`, hooks in workspace/dashboard/chip-bar/voice-follow/teleprompter/remote/memory/notes-pad/guide/onboarding); rules in `tests/test_motion_2611_1.py`. Owner: tag `v26.11.1`. 26.11 (tagged, released, clean-up run): versions are now YY.MM (`tests/test_version_scheme.py`; `updater.version_tuple` pads to four parts; the first YY.MM release starts a fresh R2 index). Teleprompter Follow my voice: `app/js/voice-follow.js` (matcher), `src/voice_follow.py` (download, memory check, process), `src/voice_worker.py` (libvosk via ctypes, waveIn mic, only script words, silence skipped; refuses to start without FRAMEDECKS_VOICE_CHILD), listens only while pinned; voice files mirrored by `voice-files.yml`. Old notes/changelog in `docs/releases/archive/` and `docs/archive/`. Owner: tag `v26.11`, then run Actions → Clean up old releases (once) with DELETE. 9.13.0 (tagged): the five chips (Prepare, Engage, Control, Notes, More) defined once in `app/js/chips.js` and drawn by the Command Center, the Studio's top bar (`js/chip-bar.js`, replaces Live tools) and the phone remote's tabs; one Notes pad (`js/notes-pad.js`); phone notes `/api/remote/notes` with `remoteNotesAdd` (on) / `remoteNotesRead` (off); top-bar Draw opens the Share Window; tests `tests/test_chips_913.py`. Owner: tag `v9.13.0`. 9.12.1 (tagged): Spotlight on demand (double-click or Ctrl twice, no follow lens; Share Window asks the main window for the word via `DESKTOP.spot_word`), bloom exit; tests `tests/test_spotlight_on_demand.py`. Owner: tag `v9.12.1`. 9.12.0 (tagged): Command Center Notes chip (`src/meeting_notes.py`, `/api/notes`, sticky note, Alt+5), size/place settings `ccSize`/`ccPlace` (`desktop_win.spot_y`, `cc-bottom`), one place per action, Settings in six groups with tabs (`js/settings.js`, `#s-tabs`); tests `tests/test_command_center_912.py`. Owner: tag `v9.12.0`. 9.11.2 (tagged): website motion: one timing token `--t-move` (motion.css), finishing touches in `app/flourish.css` loaded after first paint (flourish-later.tsx; 3 KB later-CSS budget), rules held by `hosted/tests/motion-rules.test.mjs`. Owner: tag `v9.11.2` (9.11.1 CI green, folded in). 9.11.1: website only: Go to Home in the landing bar when signed in, `/sync` skips the form when signed in; the landing's How it works and See it work merged into `components/landing/showcase.tsx` (steps 3 s / 3.5 s, no blur). Owner: tag `v9.11.1`. 9.11.0 published (owner ran 0016): live push, the doorbell (docs/architecture/live-push.md): migration `0016_live_push.sql` (owner: run it in Supabase; switch `live_push`), `src/live_push.py` (WebSocket + Bell + Doorbell, push / asleep / poll), website Live page on the private channel `live:<workspace>` with `remote_watch`; everything falls back to 9.10 polling. Owner asked next for a Command Center tray that folds away behind a Teleprompter-style arrow (hover shows, click pins) and a design audit of app and website. 9.10.3 published: the Windows build writes `src/cloud_builtin.json` (git-ignored) from the repository secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` with `tools/write_cloud_builtin.py` (publishable/anon keys only) and bundles it; `cloud_sync.companion_config` uses it first and the website's `/api/sync-config` as the backup (owner's request: fewer dependencies on the website; advice only on scaling, live push, Resend vs Postmark and Cloudflare D1 was given in chat, nothing built). Owner: tag `v9.10.3`. 9.10.2 published: Command Center performance audit (owner: smooth on older PCs beside Zoom/Teams): fixed window size `SPOT_H`, set up once in `spot_prepare` before it shows (no grey flash on first open), animations by transform/opacity only, panels cached; perf.mjs measures it. Owner: tag `v9.10.2`. 9.10.1 published: the owner saw a light grey box behind the Command Center on Windows: pywebview leaves the transparent window's WinForms form in its default grey; `desktop_win.clear_back` now paints it black (see-through with `glass`). Owner confirmed the box goes after the first open. 9.10.0 published: the Command Center redesigned as a frameless glass bar with four chips Prepare / Engage / Control / More (`GROUPS` in app/js/command-center.js; the window is see-through via `desktop_win.clear_frame` + glass without frost); Control holds the Go Live switch and the live remote; Ask AI removed. 9.9.0 published: the Command Center (`app/js/command-center.js`; the window is still `spotlight.html` / `win spotlight` internally) with modules as palette scopes (`KCPalette.scope`, `hooks`), prefixes > # @ ?, meetings and Ask AI in the index, the phone remote restyled (remote.css 9.9 block); `tools/make_product_shots.py --guide-only` for the guide pictures. 9.8.1 published: the Spotlight window is created only on first use (`spot_window(create=True)` in `src/desktop_app.py`; pywebview shows transparent windows on navigation even when hidden), `docs/legal/security.md` lists every protocol, legal pages and guides in 9.8 wording, help shots recaptured. 9.8.0 published: passwordless workspace and Trusted Devices (docs/architecture/trusted-workspace.md): website `/sync` (Sync / Save / Continue on Another Device, emailed one-time link), Trust This Device (`hosted/src/lib/trusted-device.ts`, `components/trusted-device.tsx`), `/devices` Manage Devices, migration `0015_trusted_devices.sql` (+ rollback, PGlite tests) with the pre-request revocation check; `/sign-in` forwards; desktop Settings section renamed Workspace Sync. Owner: run 0015 in Supabase, set Email OTP Expiration to 600 s, switch Google and Microsoft off, then tag `v9.8.0`. 9.7.0 published: Draw / Spotlight on the Share Window from Spotlight, live-only Spotlight remote with Content arrows, main window maximized, phone picture only sideways, welcome Going live page. 9.6.0 published: Spotlight as a meeting remote, website tokens from the program, product shots. 9.5.0 published: Welcome to FrameDecks (`app/js/onboarding.js`, full screen, PC only, `onboarding` record in kc-app-settings.json) replaces the first-run dialog and the Setup guide auto-start (guide on request: Settings → About); KJV + WEB via bible-api.com (`OPEN_BIBLES`; the sandbox could not reach it: owner checks a fetch on a real PC); Church Service Quick Start; + Deck button; neutral labels and wording (owner's item-5 fixes); tests `tests/test_scripture_95.py`. Owner: tag `v9.5.0`. 9.4.0 published: the remote redesigned to run the whole meeting (stage + Show / Plan / Tools / Memory / Meeting tabs, portrait and landscape; `app/js/remote.js`), the Spotlight that follows the pointer (`/api/pointer`, `live.follow`, `vcam/spotlight.py` `Follow`, `.pg-follow`), remote video controls (`remote_studio_action` op `media`), the Workbook Meeting plan (Frame > Deck > Content, 1 · 1.1 · 1.1.1) and Import from Excel in Quick Start; tests `tests/test_remote_94.py`. Owner asked for recommendations only (no code) on remote-camera capture for Capture Memory and on generic vs BSF-specific wording; given in chat. Owner: check the remote on a real phone (portrait and sideways), then tag `v9.4.0`. 9.3.0 published: completes the production audit (docs/project/2026-11-03-production-audit.md lists every finding). Desktop: report-only CSP (`server.page_csp`), state JSON cache outside `cond` (M10), reused vCam buffers (M9), private card text off the phone (L5), `update_state` inside its lock (L2), 400 for malformed bodies (L17), long-word wrap / width cache / Excel range clamp / .frame size limit (L16), PowerPoint macros off (L6), sync keeps overwritten versions (L12), camera DLL copied to Program Files and registered there by content tag (H4: real-PC check still needed: install, camera works in Zoom, update with an unchanged camera asks no permission, uninstall removes `C:\Program Files\FrameDecks vCam`). Build: hashed lock `packaging/requirements-lock.txt` (M5), Inno Setup 6.7.1. Cloud: migration 0014 (link limits M6, idle remote_take L13, account deletion L11, `transfer_ownership`); owner: run 0013 then 0014 in Supabase (the website's Make owner needs 0014). Website: per-page CSP in `_headers` by `scripts/write-csp.mjs` (report-only), /connect uses the stored PC name (L10), Make owner, per-page JS budget, About styles on demand (L15). Backups: HMAC (`tools/backup_mac.py`, L14). Deferred: M11 (OBS connection limit). Owner later: SignPath (M3), manifest signing key. Owner: tag `v9.3.0` once CI is green. 9.2.0 published: signed release manifests (`src/ed25519.py`, `src/manifest_sig.py`, `updater.TRUSTED_KEYS`, `tools/manifest_key.py`; dormant until the owner makes a key and adds the `MANIFEST_SIGNING_KEY` secret and the public key line: docs/deployment/release-pipeline.md "Signed manifests"), updater hardening, release workflow guards (tag on main, signed flag from the check, env tag, pinned runners); `tests/test_update_chain.py`. Owner decided (4 Nov) to switch manifest signing on later: 9.2.0 ships with TRUSTED_KEYS empty (signing dormant); tag `v9.2.0` as is. Migration `hosted/supabase/migrations/0013_protect_owner.sql` on `main` (audit H5: admins cannot demote or remove the owner, memberships stay with their person and team, only the owner changes roles or adds people directly); owner: run it in the Supabase SQL editor; rollback in `hosted/supabase/rollback/`. 9.1.2 published: security and reliability patch from the production audit (docs/project/2026-11-03-production-audit.md): media names never paths (`src/media_names.py`), PIN lockout race and backoff, LAN timeouts / connection cap / small bodies, atomic settings writes, chat-parser backtracking, escaped selector ids, WhatsApp/Messages/Phone labels on camera bubbles; `tests/test_hardening.py`. Open audit items (H3 signed manifest, H4 vCam DLL folder, H5 migration 0013, M3–M7, M9–M11) are listed there. Owner: tag `v9.1.2`. 9.1.1 published: the phone remote's Capture Memory did nothing on a real phone because `/js/remote-memory.js` was not in `REMOTE_PUBLIC` (tests ran on the PC, where everything is allowed); fixed, with a test that every file `remote.html` loads is allowed. Owner: tag `v9.1.1`. 9.1.0 published (owner's request): Memory Cards shown as chat bubbles only, no window (`vcam/chatcard.py` one Card per bubble + `stack`, `program.py` pop / glide, `overlay.js` `.chat-list`), several selected shown together in copy order (`Memory.show_many`, `showmany`), a copied conversation split per message (`memory.split`), floating bubbles clear of every card (`OverlayLayer.visible`, `ProgramFX._avoid_rects`), Capture Memory on the phone remote (`/api/remote/memory`, `app/js/remote-memory.js`), and the camera renamed **FrameDecks vCam** (was FrameRelay; same CLSID; history docs keep the old name); design-history §53, memory-cards.md items 10–13. Owner: run those on Windows, then tag `v9.1.0`. 9.0.0 published: Memory Cards replace the Audience Dock: `src/memory.py`, `/api/memory`, `live.memory`, `vcam/chatcard.py` layouts (beside default / below / over; the picture shrinks), overlay.js `.stage-root`, Studio pane + corner popup (`app/js/memory.js`), pinned cards in `kc-memory.json`; crash fixes (dock removed, capture.py one WNDPROC); design-history §52, docs/architecture/memory-cards.md. Owner: run its real-PC checklist, then tag `v9.0.0`. 8.9.0 published: Safe Next (`KCScenes.upNext`, the Up next strip under the Studio Canvas, warnings), Audience Dock Waiting/Shown tabs and keys, the FrameRelay chat window keeps clear of the camera inset; design-history §51. Owner chose 1 and 2 of the four 8.9 candidates; the run-through timer and Take it home page wait. Owner: tag `v8.9.0`. 8.8.1 published: the Audience Dock opened off the right edge of displays scaled above 100 % (pywebview scales x/y/size; dock rects are now screen pixels placed after showing) and could not take typing when pinned (focus=True now). Owner: tag `v8.8.1`, then rerun the dock checklist. 8.8.0 published: the Audience Dock (Live tools → Audience Dock): Capture turns a copied chat message (Ctrl+C) into a card, Show/Pin/Hide puts it on FrameRelay as `live.audience` with a server timer; the dock is click-through (Ctrl+Shift or the handle's pin to use it), hidden from capture, 85/20/100 % (`src/dock.py`); new `src/audience.py`, `src/capture.py`, `/api/audience`, `/api/app/dock`; design-history §50 and docs/architecture/audience-dock.md (owner: run its real-PC checklist on Windows before tagging `v8.8.0`). 8.7.0 tagged: the Spotlight as a soft see-through disc (style disc/ring, settings in Annotate and Settings → Transitions), How it works with five days incl. Point it out, See it work touring its tabs; design-history §49. Owner: tag `v8.7.0`. 8.6.0 published: Quick Start imports .frame files through the Settings import, the Teleprompter bar arrow, Help Center with topics, sign-out to framedecks.com, Plan card hierarchy, wider pages; design-history §48. 8.5.0 published: several meetings per workspace (meeting record `meetings`, a Frame's `group` names its meeting, the PC shows one at a time via `Scenes.order`; design-history §47), a right-side flowchart timeline on the website Plan, .frame per meeting. Owner: run `hosted/supabase/migrations/0012_meetings.sql` in Supabase if not yet. 8.4.0 published: .frame Use this plan with an integrity check and a field-by-field import check, Resync Linked PCs, Meeting Details of name/date/notes, Help step-by-step guide (re-run tests/visual/help-shots.mjs when a screen in it changes; hosted/tests/help-guide.test.mjs checks its labels). 8.3.0 published: the website Plan in five guided steps with a drag-and-drop timeline, Preview, Choose Animation and media kept in the browser that travels in the .frame file; check it with tests/visual/plan-flow.mjs after a website build. 8.2.0 published: Teleprompter controls only in its top bar with upload and Each Frame / Whole meeting scripts, Annotate Spotlight, one transition per effect plus Burst, .frame files (website Export for Service PC, PC Import/Export Frame File; docs/reference/frame-file.md), header Sync chip; 8.1.0: Teleprompter transparency + pin, looks, one Content view, website-matching restyle; 8.0.0 published; 7.1.2 published: release guards after the production audit; 7.1.1 no hidden PowerShell/netsh/taskkill; 7.1 workspace looks; 7.0 proprietary + framedecks.com downloads; owner steps under 7.0 and the audit): the maintainer guide is now [PROJECT_GUIDE.md](PROJECT_GUIDE.md); current references were updated. The continuity files now live in `docs/continuity/`. Windows batch launchers are under `tools/launchers/` and resolve the repository root before running. Release `v6.11.2` (repository layout and trust fixes, no desktop change; pilot install on a real PC and SHA-256 check still the owner's) was tagged after `v6.11.1`, which is published; the FrameDecks README and release header refresh merged in
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
- `APP_VERSION` 6.13, `docs/releases/archive/release-notes-before-26.11.md` (Known Issues: run 0010), CHANGELOG (the framedecks.com entry moved
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
`docs/releases/archive/release-notes-before-26.11.md`, CHANGELOG, design history section 35 and the README/release header (Version 6.12).
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
     - Removed after 26.11.57 (owner, 16 November 2026): `src/ai.py`, its endpoints and the Suggest questions buttons are gone.
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
   it), **version 6.11** (`src/server.py`, `docs/releases/archive/release-notes-before-26.11.md`, header picture, CHANGELOG): **built**.
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
  guard). Version 6.11.1, release notes `docs/releases/archive/release-notes-before-26.11.md`, About header recaptured.
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
