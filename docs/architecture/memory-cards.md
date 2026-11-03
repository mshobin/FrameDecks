# Capture Memory: Memory Cards as chat bubbles on FrameDecks vCam (9.0, 9.1)

> **9.1:** the cards are drawn as **chat bubbles only** (no window, title bar or panel), each popping open from its
> avatar; several selected cards are shown together in the order they were copied; a copied conversation becomes one
> card per message (`memory.split`); floating bubbles keep clear of every card on screen (`chatcard.stack`); the phone
> remote has Capture Memory (`/api/remote/memory`, `app/js/remote-memory.js`); and the camera is called
> **FrameDecks vCam**. Where this page says "chat overlay", read "the bubbles".

What you copy from a chat or an assistant (Teams, Zoom, Google Meet, Webex, Slack, Discord, ChatGPT, Claude, Copilot,
a browser) becomes a **Memory Card** in the chat overlay on the FrameDecks vCam. It replaces 8.8's Audience Dock: no
dock, no handle, no click-through window.

## 1. What the presenter sees and does

| Where | What |
|---|---|
| **The chat overlay** (on FrameDecks vCam; also on the Share Window and the overlay pages if chosen) | The 8.8 chat window design, kept: a title bar with a live dot, *Live chat* and the app; the cards as bubbles with initials, a title and the text, newest at the foot. A new card shows typing dots, then its text. |
| **The popup** (a small card in the screen corner, installed app) | The card just copied: title, preview, **Show**, **Pin**, ✕. It never takes the keyboard from the meeting and screen sharing leaves it out. It goes after a few seconds; with the pointer on it, it stays. |
| **The Studio's Memory Cards pane** (under Decks) | Capture on/off, the cards (title, preview, Show, Pin, Hide, Delete), a box to type a note, and the settings (⚙). Folded, it is one line with the Capture switch. Live tools → **Capture copies**, the tray and the command palette turn Capture on and off too. |

Card behaviour:

- **New card** (Capture on, Ctrl+C): into the chat overlay at once (*Show a card as soon as it's copied*, on by
  default). A private Zoom message waits for Show.
- **Show**: into the chat overlay (again) with its full text; on a card already there, it switches between the full
  text and the first lines.
- **Pin**: stays in the chat overlay, and is saved (`kc-memory.json` in the data folder) so it is there after a
  restart. Up to 12 pinned cards.
- **Unpinned**: leaves the chat overlay after its seconds (3 to 120, default 12). It stays in the pane.
- **Hide**: out of the chat overlay (and unpinned). **Hide all / Esc** empties the chat overlay until the next card
  or Show.
- At most four cards are in the chat overlay at once: the pinned ones, then the newest.

## 2. Layout: no overlaps

Settings → *On FrameDecks vCam*:

| Layout | The video | The overlays (cards, lower thirds, branding) | The bubbles |
|---|---|---|---|
| **Beside the video** (default) | Keeps its size | Laid out in the left 70 % (or the right: *Side*), at 70 % of their size | On top of the video in the right 30 % (or left), clear of the camera inset |
| **Below the video** | Keeps its size | Laid out in the top 72 %, centred | On top of the video along the bottom, side by side |
| **Over the picture** | Keeps its size | Stay where they are | Float at the edge, clear of the cards, lower thirds, branding and the camera inset (up or down the edge, else the other edge) |

The video and the camera inset (picture-in-picture) are never resized (9.1, owner's request): on the camera the
compositor draws the verse / question / birthday cards, and the program its text Content, into that part of the frame
(`chatcard.overlay_rect`, `ProgramFX.overlay_area`), so they are laid out and sized for it. They move back when the last
bubble goes. All sizes are measured from the picture, so the layout scales with the camera's resolution (720p, 1080p,
4K) and works in every app that takes FrameDecks vCam (Teams, Zoom, Google Meet, Webex, Discord, OBS). When a layout
has no room for every bubble, the oldest unpinned ones are left out first, then the rest show fewer lines.

The Studio preview shows the same layout (the overlays' `.stage-root` scales; the preview video behind it does not).
The OBS / browser overlay pages float the bubbles (*Over*) because they cannot know where the video under them is;
they show them only with *Also on the Share Window and overlay pages*.

## 3. Architecture

```
 Ctrl+C in any app ──► capture.py (Windows clipboard listener, only while Capture is on)
                         · skips password managers' secrets and FrameDecks' own copies
                         · the app in front + the web page a browser copied from
                                       ▼
 memory.py   Memory: parse (who wrote it), title, source app, duplicates, pinned cards on disk,
             overlay(seconds) → the cards in the chat overlay now and when the next one leaves
                                       ▼
 server.py   /api/memory (GET long-poll, POST actions) · memory_sync() → live.memory {cards, layout, side, share}
             and a timer for the next unpinned card · Hide all in the Studio → MEMORY.hide_all()
                                       ▼
 ┌──────────────────────────────┬────────────────────────────────┬──────────────────────────────┐
 │ vcam/program.py + chatcard.py │ overlay.js / overlay.css       │ memory.js                    │
 │ the overlays into the rest of │ .stage-root (the overlays)     │ the Studio pane and the      │
 │ the frame; bubbles on top     │ scales; .chat-list bubbles     │ corner popup (desktop_app)   │
 └──────────────────────────────┴────────────────────────────────┴──────────────────────────────┘
```

The camera draws the chat window on the program's drawing thread (one picture per change of cards, cross-faded) and
blends it each frame; the Share Window gets the picture without it unless it is shared.

## 4. Stability: the Illegal Instruction crash (0xC000001D)

The owner saw FrameDecks close with *Illegal Instruction (0xC000001D)* while dragging the Audience Dock's handle.
Findings:

1. **The capture window's callback could be freed** (`capture.py`). Windows keeps the window procedure of the first
   `RegisterClassW("FrameDecksCapture")`. Each later start made a new ctypes callback and let the previous one be
   garbage-collected, so after Capture was turned off and on Windows called freed memory. Executing freed memory is
   reported as an access violation or an illegal instruction, depending on what is there. **Fixed:** one callback
   for the whole program, routing each message to the watcher that owns the window
   (`tests/test_memory.py` checks it).
2. **The dock's window juggling.** The dock thread changed the WebView2 window's extended styles (`WS_EX_LAYERED`,
   `WS_EX_TRANSPARENT`, opacity) up to 30 times a second from another thread, moved the handle window with
   `SetWindowPos` while Windows ran the drag's modal move loop, and started that loop by sending
   `WM_NCLBUTTONDOWN` to the dock from the handle. WebView2 inside a layered window, with its styles changing
   during a move loop, is a fragile combination; I could not reproduce the crash without Windows, so this is the
   likely cause rather than a proven one. **Removed** with the dock: the popup is never
   dragged, never click-through, never faded, and no thread polls it.
3. **Not the cause:** the CPU-instruction checks (OpenCV picks its code paths when it runs; numpy would fail at
   start, not during a drag) and hardware acceleration (the app windows already run without the graphics card by
   default: Settings → Light on graphics card).

The other window drags (the Studio, the Teleprompter, the Share Window) use the same `mouse_move_or_size` as since
6.8, without the dock's style changes; they are on the real-PC checklist below.

## 5. Testing checklist (a real Windows PC)

1. Studio: no Audience Dock in Live tools or the tray; **Memory Cards** pane under Decks (folded: one line).
2. Capture on (pane, Live tools → Capture copies, or the tray). Copy a message in Teams, Zoom chat, Slack, Discord,
   ChatGPT, Claude, Copilot and a browser: each time the popup shows the card in the screen corner, the Zoom or
   Teams window keeps the keyboard (type in its chat), and the card appears in the chat overlay on FrameDecks vCam (Zoom's
   own preview): on top of the video at the right; the video keeps its size and a question card moves into the left part.
3. Share the whole screen in Zoom: the popup is not in the share.
4. **Show** (popup or pane): the full text; Show again: the first lines. **Pin**: gold edge, stays; restart
   FrameDecks: still there. Unpinned: gone after 12 s.
5. Settings: *Below the video*, *Over the picture* (with a large camera inset in a corner: the window moves above
   it), *Side: Left*, seconds, *Also on the Share Window*.
6. Esc in the Studio: the chat overlay empties.
7. Capture off then on again five times, copying each time: no crash (the callback fix).
8. Drag and resize the Studio, the Teleprompter and the Share Window for a minute each, with cards in the overlay:
   no crash, no stutter on FrameDecks vCam.
9. Copy a password from a password manager with Capture on: nothing happens.
10. (9.1) Show: only bubbles on FrameDecks vCam, no window or title bar; each new bubble pops open. Over the picture
    with a question card and a lower third on screen: the bubbles keep clear of both.
11. (9.1) Copy three messages of a Teams or WhatsApp conversation at once: three cards, each with its sender. Tick two
    in the pane, **Show selected**: both on screen, the first copied at the top.
12. (9.1) Phone remote (Wi-Fi): copy a WhatsApp message, paste in **Capture Memory**, **Show on screen**: on Zoom's
    preview within a second. Hide and Remove from the phone.
13. (9.1) After installing 9.1 over 9.0: Zoom, Teams, Google Meet (Chrome / Edge) and OBS list the camera as
    **FrameDecks vCam** (restart them once), and a meeting that had FrameRelay selected still uses it.

## 6. Rollback

- **Users:** turn Capture off; *Empty the chat overlay* or Esc. Nothing else changes. Pinned cards are in
  `kc-memory.json` in the data folder; deleting the file removes them.
- **A bad release:** publish the previous installer again as a newer version (9.0.1 with the 8.9.0 code), as the
  release pipeline requires. Settings added in 9.0 (`memDur`, `memShare`, `memLayout`, `memSide`, `memAuto`) are
  ignored by 8.9; a leftover `live.memory` is dropped by 8.9's state cleaning on the next save; `kc-memory.json` is
  ignored. 8.9's dock settings (`audience*`, `dockRect`) are ignored by 9.0.
- **9.1 → 9.0:** install 9.0.0 again as a newer version; the camera is registered again under FrameRelay (same ID).
  Sources `whatsapp`, `sms`, `phone` become `clipboard` in 9.0's state cleaning; nothing else is stored differently.
- **In code:** the feature is additive apart from removing the dock; reverting the 9.0 commit brings the 8.9 dock
  back. No cloud, database or synced data depends on it (`live` never syncs).
