## FrameDecks v9.1.2

A security and reliability update. Nothing on screen changes. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.1.1 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings.

## What's New
- No new features in this release.

## Enhancements
- Camera chat bubbles now show **WhatsApp**, **Messages** or **Phone** as the app, as the overlay pages already did.

## Fixes
- **Media file names.** A picture, video or PDF in a plan is now always just a file name in your Content folder.
  A plan arriving from the phone remote, a linked PC or an imported file can no longer point FrameDecks at a file
  elsewhere on your PC, or make Windows connect to another computer.
- **Phone remote PIN.** Wrong PINs sent all at once can no longer get past the lockout. After every five wrong PINs
  the wait doubles (up to an hour) until the right PIN is entered, and many wrong PINs from different devices slow
  everyone down.
- **Wi-Fi devices.** A device on the network that has not entered the PIN can send only small requests and hold only
  a few connections, and idle connections are closed, so one misbehaving device cannot slow FrameDecks down.
- **Settings files.** Settings, Studio scenes and the remote's sign-ins are saved so that a power cut or a full disk
  cannot leave them empty or half written.
- **Copied chats.** Copying a message with very long runs of spaces could keep FrameDecks busy for seconds; it is now
  read at once.
- **Imported plans.** A Frame or item id with quotes or brackets in an imported file no longer breaks selecting or
  renaming it.

## Performance Improvements
- Copied chat text is read up to a thousand times faster on unusual input.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- After 20 wrong PINs from one device it waits 8 minutes, and the wait keeps doubling (up to an hour) until the
  right PIN is entered. Check the PIN in **Settings → Phone & iPad Remote**.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.
