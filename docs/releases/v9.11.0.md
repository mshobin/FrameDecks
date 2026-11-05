## FrameDecks v9.11.0

FrameDecks now hears about changes the moment they happen instead of asking every few seconds. A press on the
website's Live page reaches the screen right away, every time, and plans edited on the website arrive on the PC
straight away. It also uses far less internet and puts far less load on your workspace: about 85 to 95 percent fewer
requests. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.10.3 and
earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

## What's New
- **Live push.** A linked PC is told when a phone sends a command, when the workspace changes and when someone opens
  the Live page. It listens only while it is needed (presenting, in use, or watched) and rests otherwise, checking in
  once a minute.
- **The Command Center's chips fold away** under the search bar behind a small arrow, as the Teleprompter's top bar
  does: point at the arrow to see Prepare, Engage, Control and More, click it to keep them open (remembered), click
  again to fold them. **Alt+1** to **Alt+4** still open a chip at once.
- **The Live page reads only when something changed**, and wakes a resting PC when you open it. Its badge now says
  **Online**, **Waking up…** (usually under a minute) or **Not connected**.

## Enhancements
- **A shorter welcome**: three pages instead of five (Frames, Decks and Content now share one page), and the counter
  matches the bars: Step 1 of 3.
- **A slimmer Up next** in the Studio: one line beside a small picture, so the canvas keeps its room. Warnings still
  show first.
- **Clearer website buttons**: **Open Workspace** for people who already have one, and **Start a free workspace**
  for new people (they were Sync Workspace and Save Workspace). On the PC, **Sync Workspace** keeps its name: it
  connects this PC to your workspace.
- **The website on a phone** keeps the FrameDecks name in its header, and the cookie notice is one slim line at the
  bottom.
- Settings → Workspace Sync shows how this PC gets updates: **Live connection on**, **Resting** or **Regular checks**.
- The workspace owner can switch live push off for everyone with one line in the database, without a new version.

## Fixes
None in this version.

## Performance Improvements
- A PC that is open but not in use asks about 60 times an hour instead of about 420.
- Running a service from a phone uses about 400 to 600 requests an hour instead of about 6,300.
- No new software on the PC: the connection uses Windows' own encryption and proxy settings.
- Folded, the Command Center draws only its bar; unfolding moves by position and fade alone (no frame over 17 ms on a
  simulated older PC).

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Live push needs the workspace's database updated once (migration 0016). Until then everything works as in 9.10.
- On networks that block long-lived connections, FrameDecks goes back to checking every few seconds by itself.
