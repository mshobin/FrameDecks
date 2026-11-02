## FrameDecks v8.2.0

A cleaner Teleprompter, a Spotlight for the word you are talking about, a Burst transition and .frame files that take a
whole plan to a service PC without internet. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over 8.1.0 and earlier and keeps all your meetings, members, settings and recordings.

## What's New
- **Teleprompter: only your words on screen.** Every control now sits in the Teleprompter's top bar, which folds
  away: Scroll, speed, font size and the other text settings, **✎ Write Script**, **Next Frame ▸**, transparency and
  Pin. The script area shows the script and nothing else, and the text uses the whole window at every font size.
- **Upload a script.** **⇪ Upload** in the Teleprompter bar reads a .txt, .md or Word (.docx) file. Word headings,
  bullets and bold are kept.
- **One script or one per Frame.** Choose **Each Frame** (as before: the script follows the live Frame) or **Whole
  meeting** (one script for the whole meeting).
- **Spotlight.** Annotate → Spotlight (key S, or press Ctrl twice): click a word on the picture and a glowing circle
  grows around it, pulses, then opens out with a few sparks and fades. Choose its colour, size, length and strength.
  It shows in Zoom and Teams (FrameRelay), recordings and the overlay pages.
- **Burst transition.** The old Frame breaks into dust that drifts away and uncovers the next one. Choose how fine the
  dust is, which way it drifts, its colour and its strength.
- **.frame files.** On framedecks.com, Plan → **Export for Service PC** saves the whole plan in one file. On the
  service PC, Settings → Data / Backup → **Import Frame File…** adds it after your Frames or replaces them (after a
  backup). A PC can export one too, with its pictures, videos, audio and slides.
- **Sync status.** A PC linked to a workspace shows **Synced**, **Syncing**, **Offline** or **Sync failed** in the
  header.

## Enhancements
- Transitions: one of each kind. The list is Cut, Fade, Dip to Black, Dip to White, Blur Fade, Zoom, Slide, Push,
  Wipe and Burst. Frames that used Dissolve, Cinema or Church now use Fade; Slide Right uses Slide; Soft Scale uses
  Zoom. They look the same as before.
- Settings → FrameDecks account says Synced, Syncing, Offline or Sync failed, and when offline, how to use a .frame
  file instead.

## Fixes
- None in this release.

## Performance Improvements
- Burst and Spotlight are drawn only while they play: about 12–20 ms and 6 ms a frame at 1080p, nothing otherwise.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- A .frame file made on framedecks.com holds no pictures or videos (they are kept off the cloud). Add them on the PC,
  or export the .frame file from a PC that has them.
- With "Light on graphics card" on (the default), the Teleprompter fades as a whole, text included. For solid text over
  a see-through background, turn it off in Settings → General → Performance and restart FrameDecks.
