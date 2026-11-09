## FrameDecks v26.11.30

Safer and lighter, from the 26.11.29 release check. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over every earlier version and keeps all your meetings, members, settings, notes, pinned Memory
Cards and recordings.

## What's New
- **If your plan file is ever damaged, you are told.** FrameDecks already kept the damaged file and opened your newest
  daily backup; now the Studio says so once when it opens, with **Details** (Settings → Diagnostics), so you know to
  check any Frames added since that backup.
- **The Ready check says what to do in a hurry.** Its last line: which key blacks the screen (K), which hides
  everything (Esc), and where the Emergency screen is (Control).

## Enhancements
- **Off air reads the same to everyone.** While Go Live reads Off air, screen readers and voice control hear "Off air",
  the words on the button, with the hold instruction as its description.

## Fixes
- **No other website can show FrameDecks inside its own page.** The program's pages now refuse to be framed by another
  site, so a page you visit while FrameDecks runs cannot hide the Studio under something else and steer your clicks.
- **The content security rules are now enforced, not just watched.** Any script that is not part of FrameDecks is
  blocked on every program page.
- **The Share Window no longer logs an error** when the camera engine is not running: it goes straight to the overlays.

## Performance Improvements
- **The Studio asks for its status once every 3 seconds instead of seven times.** About 20 status requests a minute
  instead of 129 while it is in front; a little kinder to laptops on battery.
- **Many screens at once wait less.** The program accepts a longer queue of connections, so a burst of screens and
  phones is never held back about a second.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Each release is checked with Microsoft Defender before it is published.
