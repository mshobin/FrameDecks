## FrameDecks v9.0.0

Memory Cards: what you copy from a chat or an assistant goes straight into the chat overlay on your FrameRelay camera.
The Audience Dock is gone. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over
8.9.0 and earlier and keeps all your meetings, members, settings and recordings.

## What's New
- **Memory Cards.** Turn on **Capture**, select text in Teams, Zoom, Google Meet, Webex, Slack, Discord, ChatGPT,
  Claude, Copilot or a browser, and press **Ctrl+C**. A Memory Card (a title and the text) appears in the chat
  overlay on FrameRelay, in the same chat window design as before. A new card arrives with typing dots, then its text.
- **Show and Pin.** A small card appears in the corner of your screen with **Show** and **Pin**. It never takes the
  keyboard from your meeting and screen sharing leaves it out. **Show** puts a card in the chat overlay with its full
  text. **Pin** keeps it there, and pinned cards are still there after a restart. Unpinned cards leave after 12
  seconds (you choose how long).
- **Beside the video.** By default the whole picture shrinks to the left and the chat overlay takes a column on the
  right, so it never covers you, the question and scripture cards, drawings or the camera inset. Or choose **Below
  the video** (the cards along the bottom) or **Over the picture** (a window at the edge, clear of the camera inset).
  Everything is sized from the camera's resolution, in Teams, Zoom, Google Meet, Webex, Discord, OBS and any app that
  uses the FrameRelay camera.
- **Memory Cards in the Studio.** A **Memory Cards** pane under Decks lists the cards with Show, Pin, Hide and
  Delete, takes typed notes and holds the settings. Folded, it is one line with the Capture switch. Live tools →
  **Capture copies**, the tray and the command palette turn Capture on and off.

## Enhancements
- Several cards at once in the chat overlay (up to four: pinned ones first, then the newest).
- The Studio preview shows the chat overlay where FrameRelay puts it.

## Fixes
- **Crash: Illegal Instruction (0xC000001D) while dragging.** The Audience Dock and its handle are removed, with the
  window-style changes they made many times a second while being dragged. Turning Capture off and on again could
  also leave Windows calling a released part of FrameDecks; capture now keeps one handler for the program's life.

## Performance Improvements
- The chat overlay is drawn once per change of cards and blended into the FrameRelay picture; no window polls the
  keyboard or the pointer any more.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Capturing copies is Windows only. Elsewhere, type a note in the Memory Cards pane.
- The OBS / browser overlay pages float the chat overlay over the picture: they cannot shrink the video under them.
- The card's title is who wrote it when the copied text says so, otherwise its first words.
