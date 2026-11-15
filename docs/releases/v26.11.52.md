## FrameDecks v26.11.52
A fix for presenting PowerPoint slides: adding a deck and pressing Present slides straight away could close FrameDecks.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over every earlier version and
keeps all your meetings, members, settings, notes, pinned Memory Cards and recordings.

## What's New
- None in this release.

## Enhancements
- If FrameDecks ever closes unexpectedly, it now writes down where it was (kc-crash.txt in its data folder). **Save
  support bundle** in Settings includes it, so a crash can be found and fixed.

## Fixes
- **Present slides no longer closes FrameDecks.** Right after a deck was added, its small slide pictures were still
  being made while Present put the deck on screen, and the slides window and phones asked for pictures too. Two of
  these reading the same file at once could close the program. They now take turns, and the small pictures are made
  one at a time so the slide on screen is never held up.

## Performance Improvements
- None in this release.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Each release is checked with Microsoft Defender before it is published.
