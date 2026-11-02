## FrameDecks v8.8.0

The Audience Dock: put a viewer's chat message on screen with Ctrl+C. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 8.7.0 and earlier and keeps all your meetings, members, settings and
recordings.

## What's New
- **Audience Dock.** Live tools → **Audience Dock** (also in the tray and the command palette) opens a narrow window that
  floats above Zoom, Teams or a browser chat. Clicks pass through it to the chat underneath, it never takes the
  keyboard from your meeting, and it is left out of screen sharing and recordings.
- **Capture with Ctrl+C.** Turn on **Capture**, select a message in any chat (Zoom, Teams, YouTube, Twitch, Facebook
  Live, Discord or anything else) and press **Ctrl+C**. The message becomes a card in the dock with
  *✓ Audience Question Captured*: no pasting. FrameDecks fills in the sender when the copied text says who wrote it
  (Zoom's *From Sarah to Everyone*, a name line above the message, or *Sarah: message*) and marks the app it came from.
  Empty copies and repeats are ignored.
- **A live chat window on screen.** The message appears as its own chat window, not like the question cards: a
  title bar with a pulsing live dot, *Live chat* and the app it came from, and a chat bubble with the sender's initials
  in a coloured circle, their name and the message. It opens like a real chat: the window unfolds from the edge, typing
  dots appear, then the message unrolls. It sits on a **chat rail at the right edge** (or the left), a little above
  the middle of the picture, so it stays clear of the question, scripture and lower-third cards at the bottom, the
  birthday card at the top, Branding badges in the corners and a camera inset in a bottom corner.
- **Opens when you copy.** A message copied from a chat app goes on screen at once (**Show as soon as it's copied**, on
  by default). Private messages and copies from other programs wait for **Show**.
- **Show, Pin, Hide.** **Show** puts a card on the FrameRelay camera for 12 seconds with a thin countdown line along
  the window's foot; **Pin** keeps it until you hide it; **Hide** (or **Esc**) slides it away. A new message replaces
  the one on screen. *Currently live* in the dock shows what is on screen. Sender and message can be edited before or
  while shown.
- **Ctrl+Shift to use the dock.** Hold **Ctrl+Shift** and the dock becomes fully visible and clickable; let go and clicks
  pass through again. The small handle on the dock's top edge is always clickable: move, resize, **📌** keep the dock
  usable (to type in a card), **⚙** settings and **✕** close.

## Enhancements
- The dock is 85% visible, and fades to 20% while the pointer is over it so the chat beneath stays readable. It
  remembers where it was and its size.
- Settings in the dock: seconds on screen (3–120, default 12), **Show as soon as it's copied**, **Place on screen**
  (right or left edge; the window on screen moves at once) and **Also show on Share Window** (off: the chat window is
  on FrameRelay only; on: also on the Share Window and the overlay pages). The Studio's preview always shows it.
- Hide all (**Esc** in the Studio, the tray's Hide all overlays) hides the audience card too.
- You can also type a question into the dock.

## Fixes
- No separate fixes in this version.

## Performance Improvements
- The clipboard is watched only while Capture is on, with Windows' own clipboard notice: no polling, no keyboard hook.
- The dock checks the keys and the pointer about 30 times a second while the pointer is near it and 10 times a second
  otherwise, only while the dock is open.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Clipboard capture, click-through and Ctrl+Shift are Windows only. In a browser the dock opens as a pop-up and takes
  typed questions.
- The sender's name is found only when the copied text includes it; otherwise the card says *Audience* and the name can
  be typed in.
- Copies that password managers mark as private are never captured. Zoom's private messages are marked **Private** and
  need a second click to show.
- Exclusive full-screen apps may cover the dock.
