# Memory Cards in the FrameRelay chat overlay (9.0)

What you copy from a chat or an assistant (Teams, Zoom, Google Meet, Webex, Slack, Discord, ChatGPT, Claude, Copilot,
a browser) becomes a **Memory Card** in the chat overlay on the FrameRelay camera. It replaces 8.8's Audience Dock: no
dock, no handle, no click-through window.

## 1. What the presenter sees and does

| Where | What |
|---|---|
| **The chat overlay** (on FrameRelay; also on the Share Window and the overlay pages if chosen) | The 8.8 chat window design, kept: a title bar with a live dot, *Live chat* and the app; the cards as bubbles with initials, a title and the text, newest at the foot. A new card shows typing dots, then its text. |
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

Settings → *On FrameRelay*:

| Layout | The picture | The chat overlay |
|---|---|---|
| **Beside the video** (default) | The whole picture (video, question and scripture cards, lower thirds, branding, drawings, the camera inset) shrinks to the left 70 % (or the right: *Side*) | A full-height column on the right (or left). Nothing can overlap: everything else moved as one. |
| **Below the video** | Shrinks to the top 72 %, centred | A strip along the bottom, the cards side by side |
| **Over the picture** | Keeps its size | The 8.8 floating window at the edge, above the middle, clear of the bottom cards, the birthday card, corner badges and the camera inset (it moves above the inset, or to the other edge) |

The shrink is animated (0.45 s) when the first card arrives and when the last one goes. All sizes are measured from
the picture, so the layout scales with the camera's resolution (720p, 1080p, 4K) and works in every app that takes
the FrameRelay camera (Teams, Zoom, Google Meet, Webex, Discord, OBS). When a layout has no room for every card, the
oldest unpinned ones are left out first, then the remaining cards show fewer lines.

The Studio preview shows the same layout. The OBS / browser overlay pages float the chat overlay (*Over*) because
they cannot shrink the video under them; they show it only with *Also on the Share Window and overlay pages*.

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
 │ FrameRelay: squeeze the       │ .stage-root shrinks (beside /   │ the Studio pane and the      │
 │ picture, draw the chat window │ below), .chatwin with bubbles   │ corner popup (desktop_app)   │
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
   Teams window keeps the keyboard (type in its chat), and the card appears in the chat overlay on FrameRelay (Zoom's
   own preview): beside the video, the picture shrinking smoothly to the left.
3. Share the whole screen in Zoom: the popup is not in the share.
4. **Show** (popup or pane): the full text; Show again: the first lines. **Pin**: gold edge, stays; restart
   FrameDecks: still there. Unpinned: gone after 12 s.
5. Settings: *Below the video*, *Over the picture* (with a large camera inset in a corner: the window moves above
   it), *Side: Left*, seconds, *Also on the Share Window*.
6. Esc in the Studio: the chat overlay empties.
7. Capture off then on again five times, copying each time: no crash (the callback fix).
8. Drag and resize the Studio, the Teleprompter and the Share Window for a minute each, with cards in the overlay:
   no crash, no stutter on FrameRelay.
9. Copy a password from a password manager with Capture on: nothing happens.

## 6. Rollback

- **Users:** turn Capture off; *Empty the chat overlay* or Esc. Nothing else changes. Pinned cards are in
  `kc-memory.json` in the data folder; deleting the file removes them.
- **A bad release:** publish the previous installer again as a newer version (9.0.1 with the 8.9.0 code), as the
  release pipeline requires. Settings added in 9.0 (`memDur`, `memShare`, `memLayout`, `memSide`, `memAuto`) are
  ignored by 8.9; a leftover `live.memory` is dropped by 8.9's state cleaning on the next save; `kc-memory.json` is
  ignored. 8.9's dock settings (`audience*`, `dockRect`) are ignored by 9.0.
- **In code:** the feature is additive apart from removing the dock; reverting the 9.0 commit brings the 8.9 dock
  back. No cloud, database or synced data depends on it (`live` never syncs).
