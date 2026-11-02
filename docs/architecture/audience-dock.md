# Live Audience Capture Dock (8.8)

A floating window that sits over (or beside) any chat: Zoom, Teams, YouTube, Twitch, Facebook Live, Discord, a browser.
The presenter selects a message there and presses **Ctrl+C**; FrameDecks turns it into an Audience Card in the dock.
**Show** puts it on the FrameRelay camera (and, if chosen, the Share Window and the overlay pages).

This page is the analysis made before building it, the plan, and the checklists for testing and rolling back.

## 1. What exists today (analysed before implementation)

| Area | How it works now | File |
|---|---|---|
| Desktop windows | pywebview windows (WebView2) made by `desktop_app.py`: the Studio, the Teleprompter (`speaker.html`), the Spotlight search, the Share Window. Windows features go through ctypes in `desktop_win.py`: whole-window opacity (`fade`, `WS_EX_LAYERED`), glass, always-on-top (`set_topmost`, asynchronous so a web request never waits on a window), **left out of screen sharing** (`hide_from_capture`, `SetWindowDisplayAffinity` 0x11), move and resize from a page (`mouse_move_or_size`), system-wide shortcuts (`Hotkeys`). | `src/desktop_app.py`, `src/desktop_win.py` |
| Teleprompter | One window above Zoom and Teams, pinned, five transparency levels, hidden from capture; the page asks the program for window actions with `KCWindow.call` (POST `api/app/win`). | `app/speaker.html`, `app/js/speaker.js`, `app/js/window-chrome.js` |
| State | One JSON document (`state`) held by `server.py`; pages long-poll `GET /api/state` and post the whole document with `baseRev` (a conflict answers 409 with the latest, and the page redoes its change). Python changes it with `update_state(change)` (the tray's Hide all). `live` is this PC's own: never synced to the cloud (`sync_entities.py`). Pages normalise the document when they save (`KCScenes.normalizeInto`): any new live field must be kept there or the next save drops it. | `src/server.py`, `app/js/store.js` |
| FrameRelay camera | `Compositor` builds each frame; `ProgramFX` (in `_finish`) adds text layers, transitions, ink, the Spotlight and Blackout. Text layers come from `live_text(st, "vcam")`, are drawn by `CardDrawer` (the navy and gold question card) on a background thread and blended in with a 0.35 s fade. | `src/vcam/compositor.py`, `src/vcam/program.py`, `src/vcam/cards.py` |
| Share Window | Shows the camera's final frame (`compositor.present`, `/api/present.mjpg`): whatever FrameRelay shows, it shows. | `src/vcam/compositor.py`, `src/server.py` |
| Overlay pages | `overlay.js` `TextLayers` draws the same card in HTML (projector, OBS, stage, the Studio Canvas preview) from `KCScenes.liveText`, fading in and out (`.card.out`). | `app/js/overlay.js`, `app/css/overlay.css` |
| Hide all (Esc) | `KCScenes.hideAll(n)` clears the cards and `live.on`; the tray's Hide all does the same in Python. | `app/js/store.js`, `src/desktop_app.py` |

## 2. Feasibility

- **Click-through, always on top, see-through, hidden from sharing:** all but click-through already exist; click-through is one more
  window flag (`WS_EX_TRANSPARENT` on the layered window). It is applied to the dock's top-level window, so the WebView2
  inside it lets clicks through as well (to confirm on a real PC).
- **No focus stealing:** the dock is made with `focus=False` and `WS_EX_NOACTIVATE` while it lets clicks through.
- **Ctrl+Shift to use the dock:** a light poll (about 30 times a second, only while the dock is open) of
  `GetAsyncKeyState` and `GetCursorPos`; no keyboard or mouse hook (hooks look like a keylogger to antivirus).
- **Clipboard:** Windows' own clipboard listener (`AddClipboardFormatListener`, `WM_CLIPBOARDUPDATE`) on a message-only
  window, only while Capture is on. It honours the markers password managers put on secrets
  (`ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory` = 0, `Clipboard Viewer Ignore`).
- **The card on screen:** the shown card becomes one more text layer, so the camera and the overlay pages draw it with the
  code that already draws text layers; the timer is a server-side timer that clears it.
- **"Also show on Share Window":** the Share Window shows the camera's frame, so when the option is off the program keeps
  a copy of the frame from just before the card is drawn and gives that to the Share Window (only while the card is
  shown and the Share Window is open).

Verdict: feasible with the existing architecture; no new packages, no new services, nothing in the cloud.

## 3. Architecture

```
 Zoom / Teams / browser / Discord chat ── select, Ctrl+C ──► Windows clipboard
                                                                   │
 src/capture.py   ClipboardWatcher (message-only window, only while Capture is on)
                  · skips password managers' secrets and FrameDecks' own copies
                  · source = the app in front (+ the web page address a browser copies)
                                                                   ▼
 src/audience.py  Audience: parse "From Sarah to Everyone:", "Sarah: …", name line + message;
                  drop empty, too long, duplicate (same text within 15 s or already queued);
                  the queue (this PC only, in memory: gone when FrameDecks closes)
                                                                   ▼
 src/server.py    GET /api/audience (long-poll), POST /api/audience (show, pin, hide, edit, delete…)
                  Show: live.audience = {id, name, text, src, at, dur, share} (update_state); a timer clears it
                                                                   ▼
 ┌────────────────────────────┬────────────────────────────────────┬─────────────────────────────────┐
 │ app/audience.html (dock)   │ vcam/program.py: the card on       │ overlay.js: the card on the     │
 │ queue, Currently live,     │ FrameRelay (fade, countdown line); │ overlay pages and the Studio    │
 │ notice, settings           │ the Share Window gets the frame    │ Canvas (when "Also show" is on, │
 │                            │ without it unless "Also show"      │ and always in the preview)      │
 └────────────────────────────┴────────────────────────────────────┴─────────────────────────────────┘
 desktop_app.py   the dock window + a small handle window (never click-through), a controller thread:
                  click-through ⇄ interactive (Ctrl+Shift held, or pinned from the handle), opacity
                  85 % / 20 % under the cursor / 100 % interactive, the handle follows the dock, size and place saved
```

## 4. UI design

**Dock** (a narrow column, 340 × 520 by default; any size):
- Header: *Audience*, the **Capture** switch, a status line (*Capturing · press Ctrl+C on a message* / *Capture is off*)
  and the hint *Hold Ctrl+Shift to use the dock*.
- Notice: *✓ Audience Question Captured* slides in under the header for 2 s (also *Already in the queue*).
- **Currently live**: the card (💬 name, message), a thin gold countdown line (or *Pinned*), **Hide**.
- **Queue**: newest first; each card has the source icon (Zoom, Teams, YouTube, Twitch, Facebook, Discord, Clipboard),
  an editable name and message, **Show**, **Pin**, **Delete**; new cards slide in.
- Settings (the handle's gear): seconds on screen (default 12), *Also show on Share Window*, *Clear the queue*.
- In click-through mode the dock is 85 % opaque and fades to 20 % while the pointer is over it, so the chat beneath is
  readable; interactive, it is fully opaque.

**Handle** (a small bar on the dock's top edge, at its right, always clickable): ⠿ drag · ⤡ resize · 📌 keep the dock
clickable (needed to type in a card) · ⚙ settings · ✕ close. Opening the settings keeps the dock clickable until Done.

As built, the dock also has a box to type a question (the same queue, source *Clipboard*), and in a browser a ⚙ button
in its header (no handle there).

## 5. Affected files

New: `src/audience.py`, `src/capture.py`, `src/dock.py` (the window's per-tick decisions, tested without Windows),
`app/audience.html`, `app/audience-handle.html`, `app/js/audience.js`, `app/css/audience.css`, `tests/test_audience.py`,
`tests/audience.test.js`, `tests/visual/audience.mjs`.
Changed: `src/server.py` (endpoints, settings, the timer), `src/desktop_app.py` (the windows and the controller, the
tray), `src/desktop_win.py` (click-through, no-activate, keys, cursor, window rectangle), `src/vcam/program.py` and
`src/vcam/compositor.py` (the card on the camera; the Share Window's frame), `app/js/store.js` (`live.audience`,
`liveAudience`, Hide all), `app/js/overlay.js` and `app/css/overlay.css` (the card on the overlay pages),
`app/dashboard.html` and `app/js/palette.js` (Live tools → Audience Dock, the command palette), docs.

## 6. Risks and Windows limitations

| Risk / limit | Mitigation |
|---|---|
| A click-through window cannot be clicked | Ctrl+Shift held, the handle's pin, the handle itself is never click-through |
| Capturing something private (a password, a private message) | Capture is off by default and shown in the dock; password managers' markers are honoured; Zoom's "(privately)" / "Direct Message" copies are marked and need a second Show |
| The sender's name is not in the copied text | Parsing is a best effort; the name is editable; "Audience" when unknown |
| The clipboard is briefly locked by another program | Read retries for about 0.2 s |
| WebView2 inside the click-through window | Verified on a real PC (testing checklist) |
| Full-screen Zoom above the dock | The dock is topmost; exclusive full-screen apps may still cover it |
| Showing a person's words on camera | The presenter chooses each one; Delete removes it at once; nothing is stored after FrameDecks closes |
| macOS / Linux | The dock page works in a browser and accepts typed questions; clipboard capture and click-through are Windows only |

## 7. Estimate

About 3–4 weeks of work in the original assessment; built here in one pass, then checked with unit tests (capture
parsing and filters, the queue, the state), a browser test of the dock and the overlay pages, and the program's own
visual and accessibility tests. The Windows-only parts (clipboard listener, click-through, Ctrl+Shift, focus) need the
testing checklist below on a real Windows PC.

## 8. Testing checklist

Automated (every push): `tests/test_audience.py` (parsing, sources, duplicates, the queue, the API, the timer, the
card on the camera, the Share Window frame, Blackout, the dock's looks, handle and saved place), `tests/audience.test.js`
(`live.audience` kept on save, cleaned, `liveAudience`, Hide all). With a started program:
`node tests/visual/audience.mjs` (the dock and the overlay pages in a browser, accessibility in dark and light).

On a real Windows PC:

1. Live tools → **Audience Dock** opens the dock and its handle; the Studio keeps focus.
2. Share the whole screen in Zoom: the dock and the handle are not in the share.
3. Move the pointer over the dock: it fades to about 20 %; clicks select text in the Zoom chat underneath.
4. Hold **Ctrl+Shift**: the dock becomes fully opaque and clickable; release: clicks pass through again.
5. Handle: drag moves the dock, ⤡ resizes it, 📌 keeps it clickable (type in a card), ⚙ opens settings, ✕ closes.
6. Close and reopen: same place and size.
7. Capture on; in Zoom select a message, Ctrl+C: *✓ Audience Question Captured*, a card with the Zoom icon.
   Repeat in Teams, Chrome (YouTube, Twitch, Facebook), Discord. Note what the name parser finds for each.
8. Copy the same text twice: one card (*Already in the queue*). Copy a password from a password manager: nothing.
9. Capture off: Ctrl+C anywhere adds nothing.
10. **Show**: the card fades in on the FrameRelay camera (in Zoom's own preview) with a countdown line and fades out
    after 12 s. **Pin**: it stays. **Hide**: it fades out. Showing another replaces it. **Esc** in the Studio hides it.
11. Share Window open: the card is not there unless *Also show on Share Window* is on.
12. Zoom keeps keyboard focus throughout (type in the Zoom chat while the dock is open).
13. CPU with the dock open and idle: no noticeable change (the poll is light).

## 9. Rollback plan

- **Users:** close the dock (✕, or Live tools → Audience Dock). Capture stops with it; nothing else changes. The queue is
  in memory only and `live.audience` is cleared by Hide all, so no data needs cleaning.
- **A bad release:** publish the previous installer again as a newer version (8.8.1 with the 8.7.0 code), as the release
  pipeline requires (`docs/deployment/release-pipeline.md`). Settings added by 8.8 (`audienceDur`, `audienceShare`,
  `dockRect`) are ignored by older versions; a leftover `live.audience` is dropped by 8.7's state cleaning on the next save.
- **In code:** the feature is additive. Reverting its commit removes the dock, the endpoints and the card; no stored
  data, migration or cloud change depends on it.
