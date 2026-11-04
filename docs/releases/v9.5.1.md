## FrameDecks v9.5.1

A speed update for older and lighter PCs. FrameDecks draws its windows without the graphics card by default, so
that Windows, Zoom and Teams stay smooth. On such PCs the new welcome screen could stutter. It now runs smoothly and
looks the same, and the Spotlight that follows your pointer costs the camera far less. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.5.0 and earlier and keeps everything.

## What's New
None in this version.

## Enhancements
- The welcome screen keeps its soft coloured light, its gliding pages and its moving pictures, drawn in a way that
  needs far less work.

## Fixes
- The welcome screen stuttered (about 7 frames a second) on PCs drawing without the graphics card. It now runs at a
  steady 60.

## Performance Improvements
- **Welcome screen:** smooth page changes at 60 frames a second. Left open, it now needs about a sixth of the work it
  did, because its pictures play a few times and then rest.
- **Behind the welcome:** while the welcome covers the window, the window behind it (with its live previews) is no
  longer drawn.
- **Following Spotlight:** the soft circle that follows your mouse or finger on FrameDecks vCam is five times quicker
  to draw: about 2 ms a frame instead of 11.
- A new check measures the app on a slowed-down PC without its graphics card, so later changes cannot quietly make it
  slower.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
