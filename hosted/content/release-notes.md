## FrameDecks v9.3.0

A security and reliability release that completes the November 2026 review. On screen, little changes: private chat
messages stay off the phone, and the team owner can hand a team to someone else. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.2.0 and earlier and keeps all your
meetings, members, settings, pinned Memory Cards and recordings.

## What's New
- **Make owner.** On the website, a team's owner can hand the team to another member (Members → **Make owner**). The
  old owner stays in the team as an admin. Before you delete your account, use it to pass on a team you share.

## Enhancements
- **Private messages stay on the PC.** A private chat message in Capture Memory (for example a Zoom message sent to
  you privately) shows on the phone remote as "Private message. Read it on the PC." Its sender and actions are still
  there. Once you put it on screen, the phone shows its text like everyone else sees it.
- **The camera driver now lives in a protected folder.** FrameDecks vCam is installed in Program Files, where only an
  administrator can change it. Windows asks for permission only when the camera itself changed in an update, not
  with every update.
- **Linking a PC is harder to block.** One network can ask for only a few link codes at a time, so nobody can stop
  other churches linking their PCs.
- **The link page names your PC as FrameDecks knows it**, not as the link says.
- **Edits are never lost in sync.** When a setting or list item was changed on two computers, the version that was
  replaced is now also kept on the PC.
- **Deleting your account removes your name** from remote commands and records you changed.
- FrameDecks' own pages and the website now carry a security policy that tells the browser what they may load. It
  only reports for now, so nothing can stop working.
- PowerPoint files you add are turned into slides with their macros switched off.
- Database backups are checked for changes before they are restored.

## Fixes
- A change from the tray (such as Hide all) can no longer be overwritten by a phone pressing Next at the same moment.
- A badly formed request to the PC now gets a clear answer instead of a dropped connection.
- A very long word with no spaces no longer slows down a card on the camera.
- An Excel file that claims to be enormous opens quickly, and a file far larger than any Frame file is refused before
  it is read.

## Performance Improvements
- With several screens open (Studio, phone remote, Teleprompter), each change is prepared once for all of them instead
  of once per screen, and no screen waits for another while it is sent.
- FrameDecks vCam no longer makes a new copy of the picture for every frame, which gives the PC less work during a
  meeting.
- A linked PC with nothing waiting no longer writes to the cloud every 15 seconds.
- The website loads the About page's styles only when you open it.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.
