## FrameDecks v26.11.2

The top bar now fits every window, from a small laptop to a maximized wide screen, in the main window and in the
Teleprompter. Follow my voice listens whenever the Teleprompter is in front, and the Command Center opens cleanly.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over every earlier version and
keeps all your meetings, members, settings, notes, pinned Memory Cards and recordings.

## What's New
- **A top bar that fits the window**: the buttons always sit on one row and line up with the window's edges. As the
  window gets narrower they tidy themselves a step at a time (shorter words first, then icons only), and only in a
  small window do the live controls take a second row, laid out on purpose. The window buttons (minimize, maximize,
  close) always stay at the top right.
- **The Teleprompter's top bar does the same**, at any size of its window: the clock, the Frame and the window buttons
  stay on the first row, and the buttons below turn into icons when space is short.

## Enhancements
- **Follow my voice listens whenever the Teleprompter is above every other window**: pinned, as before, or simply the
  window in front (the one you clicked last). Unpinned, click another window and it lets the microphone go; click the
  Teleprompter and it carries on.
- The first time you use Follow my voice it now downloads only the language model (about 40 MB instead of 53 MB):
  the speech engine comes with the installer.

## Fixes
- The main window's top bar no longer runs past the right edge when maximized, which left the page scrolled sideways
  with an empty strip under **Hide all**.
- The window buttons no longer drop onto a row of their own when FrameDecks opens in a normal-size window.
- The Command Center no longer shows a large empty box for a moment before its bar the first time you press its
  shortcut.

## Performance Improvements
- The top bar measures itself only when the window is resized or its buttons change, at most once per drawn frame:
  nothing runs at rest (checked on a simulated older 4 GB PC).

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Until it is, each release is checked with Microsoft Defender before it is published, and the installed program no
  longer downloads any program code of its own.
