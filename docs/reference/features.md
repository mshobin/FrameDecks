# FrameDecks: feature documentation (v9.5)

## v9.5 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Welcome to FrameDecks** | A full-screen, four-page introduction on the PC (never on the phone remote): Adding Frames, Adding Decks, Adding Content, Finish. Each page has a short title, one sentence and three steps beside a picture of the Studio that builds itself; pages glide and sharpen into place (fade only under reduced motion). Next / Back, the arrow keys and the page dots move; **Skip** closes it. Finish offers a ready-made meeting (when the PC has only the two starter Frames) and an earlier version's data (when one is found). Shown once per PC until finished or skipped, including after an update or a reinstall (`onboarding` in kc-app-settings.json); **Settings → About → Welcome tour** and the palette open it again. Replaces the first-run *Welcome to FrameDecks / Start fresh* dialog and the Setup guide opening by itself | `app/js/onboarding.js`, `app/css/onboarding.css`, `app/js/app-bridge.js`, `src/server.py` (`_valid_onboarding`) |
| **+ Deck** | The Decks list's add button reads **+ Deck** (was **+ Content**): Frame > Deck > Content everywhere | `app/dashboard.html` |
| **KJV and World English Bible** | Fetched without a key (public domain, bible-api.com), saved for offline use like the ESV; also from the Meeting Workbook when a reference ends in KJV or WEB | `src/server.py` (`OPEN_BIBLES`, `_open_bible_lookup`), `app/js/scripture.js`, `app/js/meeting-book.js` |
| **Church Service Quick Start** | Countdown, welcome, announcements, the reading, the message, a blessing and thank you | `app/js/store.js` (`QUICK_START`) |
| **Neutral defaults** | New cards are labelled **Scripture** and **Question** (were Focus Verse and Discussion Question; saved Frames keep their labels); sample text without "this week"; example roles Leader / Host; the AI drafts questions for any meeting around a passage | `app/js/store.js`, `app/js/frame-lists.js`, `app/js/members.js`, `src/ai.py` |


## v9.4 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Remote: run the whole meeting** | A fixed stage (live picture with Spotlight and Draw, *Frame n of m*, the Frame's name and what it shows, chips, Previous / Next with the next Frame's name, Hide all) and five tabs: **Show** (questions / scriptures / slides steppers, Question / Both / Scripture, video play / pause / from the start, every Deck with an eye), **Plan** (Frame > Deck > Content, 1 · 1.1 · 1.1.1; tap any to show it), **Tools** (Draw, Spotlight, Teleprompter, Freeze, Black screen, Clear drawings), **Memory** (Capture Memory), **Meeting** (details, Switch meeting, PC status, Disconnect). Portrait: tabs at the bottom; landscape and tablets: picture left, tabs right. Remembers the last tab | `app/remote.html`, `app/js/remote.js`, `app/css/remote.css`, `src/server.py` (`remote_studio_action` op `media`, `remote_studio_info` `media`) |
| **Spotlight follows the pointer** | With the Spotlight tool, the spotlight follows the mouse over the Studio picture (or a finger dragged on the remote's picture) on FrameDecks vCam and the overlay pages, and fades when it leaves; a click (or tap) still circles a word for a few seconds | `src/server.py` (`/api/pointer`, `pointer_set`, `live.follow`), `src/vcam/spotlight.py` (`Follow`), `src/vcam/program.py`, `app/js/annotate.js`, `app/js/overlay.js`, `app/css/overlay.css` |
| **Meeting plan in the Workbook** | See the Meeting Workbook row below: one table, Frame > Deck > Content, numbered by itself | `src/meeting_form.py`, `app/js/meeting-book.js` |
| **Import from Excel in Quick Start** | Under *Import from a file*, and in the meeting menu; same import as Settings | `app/js/workspace.js` |


## v9.1 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Chat bubbles only** | Show puts a Memory Card on FrameDecks vCam as a chat bubble on top of the video (the video is never resized; beside / below, only the other overlays are laid out in the rest of the picture: `chatcard.overlay_rect`, `ProgramFX.overlay_area`, the compositor) (initials on the sender's colour, name, app, message) with no window, title bar or panel. A new bubble pops open from its avatar (0.42 s, small overshoot); a leaving one fades; the rest glide. Up to six, in the order copied. Floating bubbles (*Over the picture*) keep clear of the camera inset and every card on screen | `src/vcam/chatcard.py` (`bubble`, `draw`, `stack`, `pop`), `src/vcam/program.py` (`_memory`, `_avoid_rects`), `src/vcam/overlay.py` (`visible`), `app/js/overlay.js`, `app/css/overlay.css` |
| **Several chats** | A copied conversation (WhatsApp, Zoom lines, "Name: message", Teams / Slack / Discord blocks) becomes one card per message with its sender. Tick cards in the Studio's **Capture Memory** pane and **Show selected**: together, in copy order | `src/memory.py` (`split`, `show_many`), `app/js/memory.js` |
| **Capture Memory on the phone remote** | Paste a message copied on the phone and **Show on screen**; every card with Show, Hide, Remove; several selected shown together. Capture and settings stay on the PC | `app/js/remote-memory.js`, `app/remote.html`, `app/css/remote.css`, `src/server.py` (`/api/remote/memory`, `REMOTE_MEMORY_ACTIONS`) |
| **FrameDecks vCam** | The virtual camera's name in every app's camera list and in FrameDecks, the installer, website and guides (FrameRelay before 9.1). Same camera ID: the installer registers it again under the new name | `packaging/build_vcam.py`, `src/vcam/sink.py`, `packaging/installer.iss` |


## v9.0 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Memory Cards** | Capture on (Studio pane, Live tools → Capture copies, tray, palette) and Ctrl+C in Teams, Zoom, Meet, Webex, Slack, Discord, ChatGPT, Claude, Copilot or a browser: a card (title = who wrote it or the first words; the text; the app) goes into the FrameDecks vCam chat overlay with typing dots then its text (*Show a card as soon as it's copied*, default on; private Zoom messages wait). **Show**: in the overlay with its full text (again: Less). **Pin**: stays, and after a restart (`kc-memory.json`, up to 12). Unpinned: leaves after `memDur` seconds (3–120, default 12). Hide; Hide all / Esc empties the overlay until the next card. Up to four in the overlay: pinned, then newest | `src/memory.py`, `src/capture.py`, `src/server.py` (`/api/memory`, `memory_sync`) |
| **Chat overlay layouts** | *Beside the video* (default; the whole picture shrinks to the left 70 %, the chat column on the right or left), *Below the video* (picture to the top 72 %, cards side by side), *Over the picture* (floating window clear of the camera inset). Animated, sized from the resolution; layouts drop the oldest unpinned cards, then lines, when full. Studio preview the same; OBS pages float it and only with *Also on the Share Window and overlay pages* | `src/vcam/chatcard.py`, `src/vcam/program.py`, `app/js/overlay.js`, `app/css/overlay.css` |
| **Memory Cards pane and popup** | Pane under Decks (folds to one line with the Capture switch): cards with Show, Pin, Hide, ✕; typed notes; settings. Corner popup (installed app): the cards just copied with Show, Pin, ✕; never takes the keyboard, hidden from screen sharing, never dragged | `app/js/memory.js`, `app/memory-popup.html`, `app/css/memory.css`, `src/desktop_app.py` |


## v8.9 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Up next (Safe Next)** | A strip under the Studio Canvas (never over it): the Frame **Next** puts on screen (after the live Frame; before anything is live, after the selected one), as a small live picture (the canvas preview page, only while shown and the window is visible), its name, *Frame n of m*, its transition, and up to four lines of what appears. ⚠ lines: shows nothing; black screen / emergency screen still on; a picture, video or PowerPoint without its file. **Hide preview** / **Show preview** (remembered, `kc-upnext`). The Next button's tooltip names the next Frame | `app/js/store.js` (`Scenes.upNext`), `app/js/workspace.js` (`renderUpNext`), `app/dashboard.html`, `app/css/theme.css` |
| **Audience Dock: Waiting / Shown** | Shown messages move to **Shown** (the meeting's history; Show again from there); **Waiting** holds what is still to come | `app/js/audience.js`, `app/audience.html` |
| **Audience Dock: keys** | ↑ ↓ choose, Enter show, P pin, H / Esc hide, Del delete, N new question (when the dock has the keyboard) | `app/js/audience.js` |
| **Chat window clear of the camera inset** | On FrameDecks vCam the chat window moves above a camera inset it would cover, or to the other edge (side-by-side layout) | `src/vcam/chatcard.py` (`place`), `src/vcam/compositor.py` (`avoid`) |


## v8.8 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Audience Dock** | Live tools → **Audience Dock**, the tray or the command palette. A narrow window above Zoom, Teams or a browser chat: clicks pass through it (click-through), it never takes the keyboard, it is left out of screen sharing and recordings. 85 % visible, 20 % while the pointer is over it, fully visible and clickable while **Ctrl+Shift** is held or the handle's **📌** is on. The handle on its top edge is always clickable: ⠿ move, ⤡ resize, 📌 keep usable, ⚙ settings, ✕ close. Place and size remembered (`dockRect`). In a browser: a pop-up that takes typed questions | `app/audience.html`, `app/audience-handle.html`, `app/js/audience.js`, `src/dock.py`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Capture (Ctrl+C)** | With **Capture** on, a copied chat message becomes a card (*✓ Audience Question Captured*). Sender found from Zoom's *From X to Y:*, a name line or *Name: message*; source app from the program in front (Zoom, Teams, Discord) or the page a browser copied from (YouTube, Twitch, Facebook, Teams, Zoom); empty, too long (over 2,000 characters) and repeated copies ignored; password managers' private copies never read. Zoom private messages are marked **Private** and need a second click. The queue is in memory only (up to 100 cards) | `src/capture.py`, `src/audience.py`, `src/server.py` (`/api/audience`) |
| **Audience chat window on screen** | Its own design, not the question card: a chat window (title bar with a pulsing live dot, *Live chat* and the source app; a bubble with the sender's initials in a coloured circle, name and message). Opens in three beats: unfolds from the edge (0.42 s), typing dots, then the message unrolls (by 1.4 s); slides away when hidden. Place: a chat rail at the right edge (or left, **Place on screen**), centred at 42 % of the height and kept between 12 % and 62 %, clear of the bottom cards, the birthday card, corner badges and a camera inset. **Show as soon as it's copied** (on by default) shows a chat app's message at once; private messages and copies from other programs wait for **Show**. **Show** (12 s by default, 3–120, a thin gold countdown line), **Pin**, **Hide** / **Esc**; a new message replaces it; edits follow on screen. On FrameDecks vCam always; on the Share Window and overlay pages only with **Also show on Share Window**; always in the Studio preview. Hide all clears it | `src/vcam/chatcard.py`, `src/vcam/program.py`, `src/vcam/compositor.py`, `app/js/store.js` (`liveAudience`), `app/js/overlay.js`, `app/css/overlay.css` |


## v8.6 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Import from Quick Start** | The Quick Start dialog has **Import a Frame file…**, and the ✨ Meeting menu's import accepts .frame files as well as single exported Frames (.json). A .frame file goes through the same import as Settings → Data / Backup (the same check, **Use this plan** / **Add after my Frames**, media, the import check). A wrong, newer or damaged file is refused with a plain message in the dialog | `app/js/workspace.js` (`importFrameFile`), `app/js/frame-file.js` |
| **Teleprompter arrow** | A small arrow at the top of the Teleprompter is always visible; pointing at it (or the top edge) slides the bar down, and the arrow sits under the bar's edge, turned up; choosing it keeps the bar open | `app/speaker.html`, `app/css/speaker.css`, `app/js/speaker.js` |
| **Help Center** | framedecks.com/help: topics on the left (Getting Started, Studio, Frames, Teleprompter, Account, Billing, Troubleshooting, Contact Support), the chosen one on the right, highlighted; on a phone, a topic button above the content. The step-by-step guide is under Getting Started | `hosted/src/components/help-center.tsx` |
| **Sign out** | Ends the session, clears it from the browser (even without internet) and goes to framedecks.com; says so if the browser cannot be signed out | `hosted/src/lib/sign-out.ts` |
| **Plan cards** | The Frame's name first, then tags (Content count, animation, Script / No script yet, On screen), Content as tiles, actions in a footer; steps in one row when there is room | `hosted/src/components/meeting-form-panel.tsx`, `hosted/src/app/plan.css` |

## v8.5
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Several meetings** | A workspace holds several meetings, each with its own name, date, notes and Frames (the meeting record's `meetings`; a Frame's `group` names its meeting, and a Frame with no matching group belongs to the first). Website Plan: the meetings at the top (date and Frame count), **New meeting**, **Rename**. Needs `0012_meetings.sql` in Supabase; before it, the website plans one meeting and says so | `hosted/src/lib/meetings.ts`, `hosted/src/components/frame-flow.tsx` (`MeetingBar`) |
| **One meeting at a time on the PC** | The **Meeting** list above the Frames chooses the meeting this PC shows (this PC's own choice, not synced); **New** and the pencil (rename). Next, Previous, the phone remote and the Teleprompter follow only that meeting's Frames; new Frames and Quick Start go into it. The companion's Live page lists the meeting shown | `app/js/store.js` (`Scenes.order`, `switchMeeting`), `app/js/workspace.js` |
| **Timeline** | On the website Plan, a timeline beside the plan (under it on a phone): the meeting, then each Frame with number, picture, name and what it shows; drag and drop, Alt + ↑/↓, delete, **Add Frame**, **Hide timeline**; Frames glide to their new place unless the system asks for reduced motion | `hosted/src/components/frame-flow.tsx` (`FlowChart`) |
| **.frame per meeting** | **Export for Service PC** exports the chosen meeting. **Use this plan** replaces only the file's meeting when the PC has others, keeping them | `hosted/src/components/meeting-form-panel.tsx`, `app/js/frame-file.js` |

## v8.4
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Website meeting details** | Plan → **Edit details** (step 1 *Your meeting*) has only **Meeting name**, **Date** (a date picker; a date typed in an older version stays as text until changed) and **Meeting notes**. The older fields (time, location, speaker name and contact, attendees, owner, content notes, additional notes) are no longer shown but are kept; the form says "This meeting also has details from an earlier version (speaker, location and so on). They are kept." **Save details** shows **✓ Saved** and "Saved. Linked service PCs get it within about a minute." The Excel Meeting Workbook on the PC is unchanged | `hosted/` (Plan) |
| **.frame import: Use this plan** | **Import Frame File…** asks **Use this plan** (the main button: the PC shows exactly what is in the file, the same Frames, ids, order, words, scripts, transitions, meeting name, date, notes and Teleprompter script; the PC's Frames are kept in a backup first), **Add after my Frames** (keeps the PC's Frames and adds the file's at the end; only when the PC has Frames) or **Cancel**. Before 8.4 adding was the default, so a plan could look different from the website. See [The .frame file](frame-file.md) | `app/js/frame-file.js` |
| **.frame integrity and import check** | Files declare what they hold (`integrity`: Frames, Content, questions and readings, files used, files included). A file that is cut short or was changed by hand is refused before anything changes. After an import, every Frame is compared with the file; the **Frame files** box shows "✓ Checked against the file: … Everything matches." or each difference marked ⚠, and "⚠ Not on this PC yet: …" for files the Frames use that are not on the PC. A PC's export also carries its Teleprompter text and Spotlight settings (`settings`), applied on import. The website's **Export for Service PC** says what is in the file and lists the files not in it | `app/js/frame-file.js`, `hosted/src/lib/frame-file.ts` |
| **Resync Linked PCs** | On a linked PC, **Resync Linked PCs** replaces **Sync now** in Settings → FrameDecks account, the **Sync** chip's panel (status, workspace, last successful sync, **Resync Linked PCs**, **Sync settings**) and the command palette. It shows **Syncing…**, then "Sync complete: N changes received, N sent.", "No changes found. This PC already has the latest plan." or "Sync failed: …". The line above says "Last successful sync: …". Automatic sync still runs every minute | `app/js/account.js`, `app/js/meeting.js`, `app/dashboard.html` (`h-sync`), `app/js/palette.js` |
| **Step-by-step guide** | framedecks.com/help starts with a **Step-by-step guide**: two tabs, **Website** and **Service PC**, eight steps each (sign in, create a meeting, add Frames, write or upload scripts, transitions and drawing, preview, sync/export/import, run the meeting), each with a screenshot zoomed on the place to click (tap for the whole screen), and a search box. PC: **Settings → Help → Step-by-step guide** or the command palette | `hosted/src/lib/help-guide.ts`, `app/js/settings.js`, `app/js/palette.js` |

Rows below that mention **Replace my Frames**, **Sync now** or the website's speaker, time and location fields
describe earlier versions; the table above is current.

## v8.2 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Teleprompter: controls in the top bar** | Every control is in the collapsible top bar; the script area shows only the script text (no buttons, labels or overlays), filling the whole window width and height at every text size. Row 1: Time, Frame, **Next Frame ▸** (puts the next Frame on screen), Timer, Transparency, Pin, Keep open / Hide bar, window buttons. Row 2: **▶ Scroll** (play / pause), speed, A− / A+ and the other text settings, **✎ Write Script**, **⇪ Upload** and the script mode | `app/speaker.html`, `app/js/speaker.js`, `app/js/teleprompter.js` |
| **Teleprompter: Upload and script mode** | **⇪ Upload** loads a .txt, .md or Word (.docx) file; Word headings, bullets and bold are kept; up to 20,000 characters; asks before replacing an existing script. **Each Frame** (one script per Frame, following the live Frame, as before) or **Whole meeting** (one script, kept in the meeting details as `meeting.script`, with `meeting.scriptMode`) | `app/js/speaker.js`, `app/js/script-file.js`, `app/js/store.js` (`meeting`) |
| **Annotate → Spotlight** | Tool key **S**, or press **Ctrl** twice quickly with the pointer over the Studio Canvas (also when not annotating). Click a word: since 8.7 a soft see-through disc (style **Soft disc**, white, bigger) lands with a ripple, breathes, then closes softly; style **Gold ring** is the 8.2 glowing circle with sparks. Click empty space to spotlight a point. Shows on FrameDecks vCam (Zoom, Teams), recordings and the overlay pages. The Spotlight panel (and **Settings → Transitions → Spotlight (Ctrl twice)**) sets the style, colour, **Size**, **Length** (1–15 s) and **Strength**, with **Try it**; remembered on the PC. Not the same as the Spotlight search (Alt+Space) | `app/js/annotate.js`, state `live.spot` |
| **Transitions: one per effect** | Cut, Fade, Dip to Black, Dip to White, Blur Fade, Zoom, Slide, Push, Wipe, Burst. Older choices are moved automatically: Cross Dissolve, Cinema Fade and Church Service Fade → Fade; Slide Right → Slide; Soft Scale → Zoom. Saved Frames, profiles and Excel files keep working | `app/js/store.js` (`TX`, `TX_ALIAS`) |
| **Burst transition** | The Frame on screen breaks into dust that drifts away and uncovers the next Frame (about 1.4 s). **Settings → Transitions → Burst**: Dust (Light / Medium / Fine), Drifts (Right / Left / Up / Down / Outwards), Strength, Dust colour or **The picture's own colours** | `app/js/workspace.js` (`renderTransitions`), `app/js/store.js` (`fx.burst`) |
| **.frame files** | One file with the whole plan, to move it to a service PC without internet. framedecks.com: Plan → **Export for Service PC**. PC: **Settings → Data / Backup → Import Frame File…** (Use this plan, with a backup first / Add after my Frames / Cancel) and **Export Frame File** (with the pictures, video, audio and slides, up to 300 MB); also in the command palette. Replaces the Excel workbook for moving a plan; Excel import of question and verse lists stays. See [The .frame file](frame-file.md) | `app/js/frame-file.js`, `app/js/palette.js` |
| **Sync status** | A PC linked to a workspace shows a **Sync** chip in the header: **Synced** (green), **Syncing**, **Offline** (no internet; changes wait and go up later; presenting is not affected), **Sync failed** (red; Settings → FrameDecks account says why). The same word shows in Settings → FrameDecks account. Sync carries everything except media, which never goes to the cloud | `app/dashboard.html` (`h-sync`), `app/js/meeting.js`, `app/js/account.js` |

Rows below that mention the Teleprompter's floating toolbar, Cross Dissolve, Cinema Fade, Church Service Fade, Slide
Right or Soft Scale, or sharing a meeting through the Excel workbook, describe earlier versions; the table above
describes the app as it is now.

## v8.1 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Teleprompter: transparency and pin** | The Teleprompter's top bar also has **Transparency** (Solid, 20%, 40%, 65%, 85%: how much of Zoom or Teams shows through) and **Pin** (*Pinned* = stays above Zoom, Teams and PowerPoint; click to unpin). Both are remembered. Installed app only, not in a browser. With Light on graphics card on (the default) the whole window fades, text included; with it off, only the background is see-through and the text stays solid | `app/speaker.html`, `app/js/speaker.js` |
| **Content Settings: one view** | No more Label / Content / Display Settings / Visual Settings tabs or jump links. **Content** (its label and words) first, then sections that open on a click: **Position and size**, **Look**, **Animation**, **Show on**. Open sections are remembered on the PC | `app/js/workspace.js` |
| **Look (theme)** | Moved from Settings → General → Appearance to **Settings → Meeting & Branding → Look**. Colour cards: Gold & Navy (default), Morning Light, Chapel Stone, Deep Ocean, Forest, Quiet Mono (the same looks as framedecks.com → Branding → Look), or **Same as my workspace** (follows the website's look, light or dark included). Below: **Light or dark** (Dark / Light / Match Windows). A look switches to its own light or dark (Morning Light is light), which can be changed. Only the app window changes; the camera picture, overlays and phone remote keep their own look. Command palette: *Look: <name>* | `app/js/nav.js`, `app/js/palette.js`, `app/dashboard.html` |
| **Settings → General** | Now *Window, tray and performance*. **Your details & email wording** (name, email, group name, greetings, signature, default subject / body, separator) is no longer on the screen | `app/dashboard.html` |
| **Restyled window** | The desktop window matches framedecks.com: a soft background light, rounder cards with a faint gold edge, gold-gradient main buttons and larger page titles. No change in behaviour | `app/css/theme.css` |

Rows below that mention Settings → General → Appearance, the Teleprompter overlay's transparency, or the Label /
Display Settings / Visual Settings groups describe earlier versions; the table above describes the app as it is now.

## v8.0 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **One Teleprompter** | One window (`speaker.html`) that stays on top of Zoom and Teams and is left out of screen sharing and recordings (Windows 10 2004+). Opened from Live tools → Teleprompter, **R**, the command palette (*Teleprompter on / off*), Spotlight or the tray (**Teleprompter**). Follows the Frame on screen (the first Frame before going live). The script takes nearly the whole width, with a floating toolbar that fades (Play / Pause, speed, A− / A+, line spacing, contrast, Mirror (M), edit). The top bar is hidden by default: it appears when the pointer reaches the top edge or with the small ▾ button, and shows only **Time**, the current **Frame** (name · n of m) and a **Timer** (Start / Pause, Reset), plus **Keep open** / **Hide bar** and the window buttons. Removed: the docked Teleprompter (Left / Right / Bottom / Float, *In this window*), the see-through Teleprompter overlay (*Over Zoom*, Shift+R, the Solid / Presenter / Meeting / Conference / Ghost modes, frosted glass, compatibility transparency and their Window and tray settings), *Own window*, and the old window's **On screen & next** panel, status chips and This Frame clock. The phone remote's Teleprompter is unchanged. Since 8.1, transparency and pin are in the Teleprompter's top bar (see v8.1 above) | `app/speaker.html`, `app/js/speaker.js`, `app/js/teleprompter.js`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Compact Frames** | Each Frame is a compact card. The right-click menu has one **Duplicate Frame** (Ctrl+D), which puts the copy right after the Frame; the other Duplicate choices (& edit question, keep the question, with options, as template, structure only, Create variant, to group) are gone, and *Make one Frame per question / verse* left the menu | `app/js/workspace.js` (`sceneMenu`) |
| **Frame settings** | Name, Teleprompter script (with **Open the Teleprompter**), **Move to the next Frame after N seconds** and a **Duplicate Frame** button. **Advanced** holds Group, Transition into this Frame + Length (ms), Branding, Favourite, Template, Save as template, One Frame per question / per verse, and the history (Created, Changed, Copied from, Original Frame). No more Frame / Timing / History groups | `app/js/workspace.js` (`sceneForm`) |
| **Decks** | The section under the Frames list is called **Decks** (was *Content*); **+ Content** adds to it and the items are still called Content. The ready-made Discussion topic, Icebreaker and Poll (show of hands) Content and their Library entries are removed; Frames that have them keep them | `app/dashboard.html`, `app/js/workspace.js`, `app/js/store.js` (Library) |
| **One Studio** | No Prepare / Run switch and no Run view (Up next panel, Before you start panel, keys list). Previous, Next, Go Live, Hide all and Live tools are always in the top bar. The Share Window is unchanged | `app/js/service.js`, `app/dashboard.html` |
| **Practice mode removed** | Practice mode and the Setup guide's Rehearse step are gone. To try things out, use Live tools → Black screen | `app/js/service.js` |
| **FrameDecks vCam: picture quality** | **Picture quality** (folded) has three groups: **Quick setting** (Setting, Strength of the look, Zoom in); **Light and colour** (Brightness Automatic / Set it myself with Shutter speed and Light boost; Colour Automatic / Set it myself with Warm ↔ cool; Bright window behind you; Flickering lights; **Fine-tune light and colour** with **Put these back to normal**); **More webcam options** (Webcam picture, Smoothness, Dark areas / Fix grey blacks). **Diagnostics** is its own folded box: a one-line answer (*Everything looks normal.* or what to try), with **Technical details (for support)** folded | `app/js/vcam-panel.js` |
| **Setup guide wizard** (9.5: on request only, from Settings → About → Guided tour or the palette) | One step at a time, with a progress bar and *Step n of 6*; **Back** / **Next** (Next only when the step is detected as done), **Do this later**, **Skip this step** on optional steps, a status line and **Something not working?** tips. Steps: Welcome, How people will see it, Your phone as a remote (optional), Connect to FrameDecks (optional), Make your first Frame, Ready (the ready checks, each problem with a fix button). The finish screen offers **Open the Studio** | `app/js/guide.js`, `app/js/guide-steps.js`, `app/js/service.js` (`KCServiceChecks`) |
| **One phone remote** (8.0; replaced by the 9.4 remote above) | One scrolling view for everyone after the PIN sign-in. Top bar: the meeting name, **Connected** and **Hide all** (solid red while something is on screen). **On screen now**: the live picture with a badge (Off air / On screen / Black screen / Frozen / Emergency), *Frame n of m*, the Frame's name and what it shows, FrameDecks vCam and Recording chips. **Previous** / **Next** (gold; *Start* before anything is live). A card for the Frame's questions, scriptures or PowerPoint slides: chips to choose which, round ◀ ▶ arrows, *Question 2 of 5*, and a Question / Both / Scripture switch when the Frame has both. Four tools: **Teleprompter** (the script full screen, **Done** closes it), **Draw**, **Freeze**, **Black screen** (*Show picture* while on). **All Frames**: every Frame as a card, tap to put it on screen (Live and Next tags). **Disconnect this device** at the bottom. On tablets the Frames list sits beside the controls. Removed: the Simple / Advanced layouts and the *This device* (⋯) sheet, the Live / Frames / Content tabs, Frame search, the Content list (show / hide eyes, Hide Content), the transition picker, Run-through, the Auto toggle, the Emergency button (still on the PC), the Frame actions sheet and the tablet's Next-Frame preview | `app/remote.html`, `app/js/remote.js`, `app/css/remote.css` |

Rows in the tables below that mention the docked Teleprompter, the Teleprompter overlay or the Teleprompter
window's side panel, Practice mode, Run, the Discussion topic / Icebreaker / Poll presets, the Duplicate options or
the Frame / Timing / History groups, or the Simple / Advanced remote, describe earlier versions; the table above describes the app as it is now.

## v6.9 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Meeting Workbook: Dashboard + Meeting Form** | Two tabs only. **Meeting Form**: one guided page in numbered sections (1 · Meeting details, 2 · Speaker, 3 · Attendees, 4 · Presentation, 5 · Meeting plan, 6 · Additional notes); 9.4: the Meeting plan is one table in the app's order, Frame > Deck > Content (Level column; No. numbers itself 1 · 1.1 · 1.1.1), 400 rows behind Excel's **+** button. **Dashboard**: formulas only, never imported: status pill, This meeting, counts, Meetings tiles, Readiness (x / 6), Quick actions, Content mix chart, Recent meetings log | `src/meeting_form.py`, `tools/make_meeting_workbook.py`, `app/templates/FRAMEDECKS-Meeting-Workbook.xlsx` |
| **Meeting Form import** | Finds the details by their labels and the Meeting plan by its header row (No. · Level · Type · Name…), so a hand-made form in the same style imports too; the Level column (or only the numbers 1 · 1.1 · 1.1.1) gives the structure. Problems read *Meeting Form · Meeting plan · row 26: …*. Forms from 6.9-9.3 (four tables starting at **Frame #**), Workbooks from 6.5–6.8 (one sheet per list) and the 6.2 one-sheet template still import | `app/js/meeting-book.js`, `app/js/import-worker.js` |
| **Meeting Form export** | The program fills the template (`POST api/meeting/workbook`), so the export has the same Dashboard and Meeting Form. Without the program, or when a table is longer than the form, a plain one-sheet Meeting Form. Both import again | `app/js/meeting-import.js`, `src/server.py`, `src/meeting_form.py` |
| **Meeting details** | The meeting keeps title, date, time, location, speaker (`presenter`), contact, attendees, attendee notes, owner, content notes, notes and additional notes (`extra`). Since 8.4 the website shows only title, date and notes; the others are kept | `app/js/store.js` (`meeting`) |
| **A tidier command bar** | No search box (use the command palette, Ctrl+K / Ctrl+Space, or Spotlight, Alt+Space). No Presentation Mode (and no **P** shortcut for it). No **Hide the app window** button in the Studio (Minimize and the tray do this). **Hide all** shows its **Esc** key inside the button; the **Program** menu always opens as a drop-down. The bar no longer overflows on narrow, maximized, ultra-wide or high-DPI windows: under 1140 px wide it wraps to two rows | `app/dashboard.html`, `app/css/theme.css` |

Rows in the tables below that mention the header search box, Presentation Mode or the five-sheet workbook describe
those versions; the table above describes the app as it is now.

## v6.8 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Teleprompter overlay (Meeting Leader mode)** | Program → Teleprompter overlay (Shift+R), the tray (**Teleprompter**), Spotlight, the palette, or **Overlay** in the docked Teleprompter's header. A see-through window over Zoom, Teams or Meet. Modes (keys 1–5): Solid 0 %, Presenter 20 %, Meeting 40 % (default), Conference 65 %, Ghost 85 %; the letter outline grows as it gets more see-through. Frosted glass (Acrylic on Windows 11 22H2+, blur on Windows 10). Stay on top (📌, P), remembered. Left out of screen sharing and recordings (Windows 10 2004+). Script about 95 % of the width; a floating glass toolbar fades after about 3 s (Play / Pause, speed, A− / A+, line spacing, contrast, Mirror (M), top, edit, transparency, frost, pin, Exit (Esc)); a thin ribbon to drag and resize. Follows the Frame on screen (the first Frame before going live). With Light on graphics card on, the window fades as a whole; Compatibility transparency forces that | `app/prompter.html`, `app/js/prompter.js`, `app/js/teleprompter.js`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Modern window** | No Windows title bar: the app's top bar is the ribbon (drag to move, double-click to maximize); Snap and edge resizing kept. Minimize, Maximize / Restore and Close at the top right of every window. Settings → General → Window and tray → **Modern window** off brings the title bar back (restart) | `src/desktop_win.py`, `src/desktop_app.py`, `app/js/window-chrome.js` |
| **Hide to tray** | Minimize asks *Hide application to system tray?* (Hide To Tray / Stay In Taskbar, Remember my choice; or Settings → Minimize button). In the tray the camera, overlays, phone remote and shortcuts keep working. Tray menu: Open App, Teleprompter, Search, Settings, More (Look, Frame, Stop screen share, Hide all overlays, Presentation window, Phone remote), Exit; a click opens the app | `src/desktop_app.py`, `app/js/window-chrome.js` |
| **Spotlight** | A system-wide shortcut (default Alt+Space; Ctrl+Alt+Space if another program has Alt+Space; also Ctrl+Space, Ctrl+Shift+Space, Win+Shift+K or Off). Opens centred on the screen with the mouse, above everything, even from the tray. The command palette's search; Go Live, Next / Previous Frame, Hide all, Blackout, Freeze, Teleprompter window and overlay run without bringing the main window back. Empty search: Recent, Frequently used, Suggested. Esc or clicking away closes it | `app/spotlight.html`, `app/js/palette.js`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Teleprompter window** | The script takes the whole width; **On screen & next** slides the side panel in on request (hidden by default, remembered); floating toolbar like the overlay; the ribbon has the window buttons | `app/speaker.html`, `app/js/speaker.js`, `app/js/teleprompter.js` |
| **Command palette** | A **Teleprompter overlay** command, and **Frequently used** items | `app/js/palette.js` |
| **Settings → General → Window and tray** | Modern window, Minimize button, Spotlight shortcut (with a status line), and the overlay's Transparency, Frosted glass, Stay on top and Compatibility transparency | `app/js/app-bridge.js` |

Section 4 below describes the window as it was in 6.4–6.7. With **Modern window** on (the default since 6.8), the
Windows title bar is replaced by the app's ribbon, as in the table above.

## v6.7 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Inline editing** | No pop-up windows. Double-click a Frame's or Content's **name** to rename it (or F2); double-clicking elsewhere on a Frame row still Goes Live. In a Frame's question / scripture list, double-click the label or text. On the Studio Canvas, double-click any card (question, scripture, announcement, prayer, discussion topic, icebreaker, poll, lower third, timer) to edit its body, or its label (top line) to edit the label. Enter saves, Shift+Enter new line, Esc cancels, clicking away saves | `app/js/editable.js`, `app/js/preview-edit.js`, `app/js/frame-lists.js` |
| **New Content presets** | **+ Content → Discussion topic, Icebreaker, Poll (show of hands)**: text cards with a ready label and sample text. The Poll is display only (no voting devices, nothing counted). Also in the Content Library, under Discussion Questions | `app/js/workspace.js` (`TEXT_PRESETS`), `app/js/store.js` (Library) |
| **No answers or presenter notes on screens** | Removed from the main app, the Teleprompter window, the phone remote and Content Settings. Old data is kept, not deleted | `app/js/frame-lists.js`, `app/js/speaker.js`, `app/js/remote.js` |
| **Content Settings order** | **Label**, **Content**, **Display Settings** (with **Animation** and **Show on**), **Visual Settings**; Media for pictures, video and PowerPoint | `app/js/workspace.js` (`GROUPS`) |
| **Teleprompter** | The Frame's **Teleprompter script** (was Leader notes; up to 20,000 characters; `# Heading`, `- bullet`, `**bold**`, `*italic*`, `[PAUSE]`, `---`). Program → Teleprompter (R) docks it Left / Right / Bottom or Float, resizable, **Follows: Live / Selected**. Scroll play / pause (Space), five speeds, A− / A+, line spacing, high contrast, Focus mode (F), Home, arrow / Page keys, wheel and touch. Cue line: Frame i of n, LIVE, next Frame, next question or scripture. Never on any output | `app/js/teleprompter.js`, `app/js/prompter-dock.js` |
| **Teleprompter window** | Program → Teleprompter window (was Speaker View): the Teleprompter in its own window for a second screen, with clocks, a timer, what is on screen and what is next | `app/speaker.html`, `app/js/speaker.js` |
| **Phone teleprompter** | A Teleprompter panel on the Live tab of the Advanced remote; a **TELEPROMPTER** button in the Simple remote opens it full screen | `app/remote.html`, `app/js/remote.js` |
| **Branding options** | Display (Logo only / Name only / Logo + Name, optional Organization), Position (four corners or centred), Safe margin, Size (Small / Medium / Large + fine size), Opacity, Padding, Background plate (off = soft shadow). The same on the camera and the OBS pages; scales with resolution. **Remove background** makes a plain logo background transparent on the PC, with Undo | `app/js/workspace.js` (`brandForm`), `app/js/meeting-brand.js`, `src/vcam/program.py`, `app/js/overlay.js` |
| **Multi-select** | Ctrl+Click, Shift+Click or a drag box in empty list space selects several Frames or Contents. Delete / Backspace (Undo in the message; confirmation only for 5 or more), Ctrl+C / X / V, Ctrl+D, Ctrl+A, right-click menu, drag to move | `app/js/workspace.js` |
| **Command palette** | Ctrl+K or Ctrl+Space (Settings → Keyboard shortcuts → Command palette); the header search box until 6.9. Finds Frames, Content, questions, scriptures, text, templates, Library, branding, settings, members, Bible references, recent items; runs commands (Go Live, New Frame, Duplicate, Teleprompter, Export meeting, theme, Add Content…). Arrow keys + Enter; Esc closes | `app/js/palette.js` |
| **Meeting Workbook** | No Answer / Notes columns; the Frames sheet's last column is Teleprompter Script. Older workbooks still import, with answers and notes going into the Frame's Teleprompter script | `app/js/meeting-book.js` |
| **Faster start-up** | The Excel library loads only when first needed | `app/js/dashboard.js` |

## v6.5 at a glance

Some rows below changed in 6.7 (Content Settings groups, the list editor, the Advanced remote's notes); the table
above describes them as they are now.

| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Meeting → Frame → Content** | **+ Frame** makes one blank Frame. **+ Content** adds Question, Scripture, Text, Image, Video, Timer, PowerPoint or Free Content to the selected Frame | `app/js/workspace.js` |
| **Independent Frames** | Each Question / Scripture Content owns its list (`layer.c.items`) and its appearance (`layer.c.look`). Duplicate gives new ids to the Frame, every Content and every item. Older data is converted on load with ids derived from the old ones | `app/js/store.js` (`ownLists`, `freshIds`, `applyLook`) |
| **Content Settings** | One panel per selection, every setting visible in groups (Content, Appearance, Position, Timing, Animation, Media, Behavior); no Basic / Advanced | `app/js/workspace.js` (`renderInspector`) |
| **Question / Scripture lists** | Full-height list; click = current, double-click = edit in the same panel (label, text, answer, notes, transition) | `app/js/frame-lists.js` |
| **Annotate** | Pen, highlighter, arrow, line, rectangle, ellipse, text; colours, thickness, undo / redo / clear; above all Content, PowerPoint and cards on FrameDecks, the overlay pages and the phone | `app/js/annotate.js`, `src/vcam/annotate.py`, state `live.ink` |
| **Freeze / Black screen** | Hold the picture (drawings stay on top) / black picture; keys F and K | `src/vcam/program.py`, state `live.freeze`, `live.blackout` |
| **PowerPoint** | A .pptx becomes slides via the installed PowerPoint (COM SaveAs PDF); a live window keeps animations; **Show objects only** keys out a plain slide background | `src/vcam/powerpoint.py` (`pptx_to_pdf`), `src/vcam/layers.py` (`key_background`), `docs/reference/powerpoint.md` |
| **Simple / Advanced remote** | Simple (default): Frame and Content steppers, Annotate, Freeze, Black Screen. Advanced: search, notes, run-through, PowerPoint, annotation | `app/remote.html`, `app/js/remote.js` |
| **Meeting Workbook** | Five-sheet Excel template (two tabs since 6.9) with drop-downs, import with preview, export | `app/js/meeting-book.js`, `tools/make_meeting_workbook.py` |
| **No collaboration** | Team Space removed; local save, autosave, export, backups and Frame history remain | — |

The rest of this document describes the v6.4 features that are still current: the FrameDecks vCam, logo-only
branding and native desktop behaviour.


This document describes what each v6.4 feature does, how it is built and where its limits are:

- the FrameDecks vCam;
- logo-only branding;
- native desktop behaviour.

For the earlier features, see `docs/reference/meeting-workbook-and-branding.md` (v6.2), `docs/architecture/design-history.md` and the release notes in
`docs/releases/`.

---

## 1. The FrameDecks vCam

FrameDecks has its own camera for Zoom, Microsoft Teams, Google Meet, OBS and other apps that read Windows
cameras. Windows lists it as **FrameDecks**. It sends the finished picture: your webcam with optional background
blur and a Camera Look, plus the live scene (cards, text, pictures, slides, branding).

| | |
| --- | --- |
| Name in other apps | **FrameDecks** |
| Registered by | The installer, with the option **Install the FrameDecks vCam for Zoom and Teams** (asks for administrator permission once) |
| Driver files | `framedecks_vcam64.dll` and `framedecks_vcam32.dll` in `_internal\vcam\bin`. They are built from softcam (MIT licence) by `packaging/build_vcam.py` |
| Camera ID (CLSID) | `{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}`. This is the same ID as before, so apps that remembered the camera keep it |
| Settings | **Settings → FrameDecks vCam** |
| Status | The status menu in the command bar: **FrameDecks** · Off / Ready / In use |

### Upgrading from the camera's earlier name
Before 6.4 the same camera had an earlier name. Installing 6.4 does the following:
- It registers the camera again under its new name. This happens even if the option is not ticked, as long as the
  camera was already installed, because the driver file was renamed.
- Zoom, Teams, Meet and OBS show **FrameDecks** after they are restarted. They read the camera list when they
  start.
- An OBS scene that used the camera under its earlier name as a *Video Capture Device* may need that source pointed at FrameDecks once.

The app also still recognises its old name, so it never captures its own picture during the upgrade.

### Limits
- Windows only (DirectShow). Apps that read only Media Foundation cameras without the Windows 11 DirectShow bridge
  may not list it. Zoom, Teams, Google Meet in Chrome or Edge, and OBS do list it.
- One app at a time can use the webcam behind it. Choose FrameDecks in every meeting app, not the webcam itself.

---

## 2. Team Space (removed in v6.5)

Team Space (co-leaders' presence, shared notes and actions, Ask to Go Live over WireGuard) was removed in v6.5 to keep
FrameDecks a simple, single-PC app. No settings, listener or peer protocol remain. Old `kc-teamspace*.json`
files in the data folder are ignored and can be deleted. Meetings are shared by **exporting** them (Excel Meeting
Workbook or a Frame file) instead.

---

## 3. Logo-only branding

The app's own branding is the **Book + Candle** mark (`app/img/framedecks-emblem.webp`) and nothing else:
- **Command bar (dashboard header):** the mark alone, 30 px wide. There is no "FrameDecks" wordmark or text
  beside it. The name and the Meeting Name are kept for screen readers, in the mark's tooltip and in the window
  title.
- **Phone remote:** the sign-in screen shows the mark alone, and the remote's top bar shows the mark, the meeting
  name and the connection status.
- **Home-screen icons** (`app/icons/remote-*.png`): the mark on a navy tile, with no text. The Windows app icon
  (`packaging/framedecks.ico`) was already the mark alone.
- **Dialogs and overlays** show no product branding. The leader's own logo and Meeting Name (Settings → Meeting &
  Branding) still appear only where the leader puts them.
- **About page:** unchanged. It keeps its own branding and content.

The wordmark styles are no longer used in the header. `.sr-only` keeps the text available to assistive technology.

---

## 4. Native desktop behaviour

The installed app is a desktop application, not a web page in a browser:
- **Its own window (WebView2):** no address bar, tabs, browser toolbar or browser buttons.
- **Title bar:** the Windows title bar keeps **Minimize**, **Maximize/Restore** and **Close** (with Snap Layouts),
  drawn by Windows. It follows the app's theme:
  - dark or light caption on Windows 10 and 11;
  - on Windows 11, the exact colour of the command bar, so the window reads as one surface like Teams or Slack.

  The page tells the app when the theme changes (`POST api/app/window`).
- **No browser behaviour inside the window:**
  - Reload (F5, Ctrl+R), Print (Ctrl+P), Save (Ctrl+S), View source (Ctrl+U), zoom (Ctrl + + / − / 0 / wheel),
    history (Alt+← / →) and developer tools keys do nothing;
  - the browser right-click menu appears only in text boxes;
  - a file dropped outside a drop zone does not replace the page.
- **Without WebView2:** the app opens as an Edge (or Chrome) **app window** (`--app` mode, separate profile in
  `appwindow` in the data folder). It also has no address bar, tabs or browser buttons, and the same guards apply.
  Only if neither browser exists does it fall back to a normal browser tab.
- **Close (X):** asks whether to keep running in the background (so the camera, overlays and Team Space keep
  working) or quit. This is unchanged.
- A browser tab opened by hand at `http://localhost:8750` behaves like a normal web page.

A fully custom-drawn title bar was not needed. Windows' own caption, coloured to match, keeps Snap Layouts,
accessibility and the expected window behaviour.
