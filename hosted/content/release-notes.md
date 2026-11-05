## FrameDecks v9.10.3

Linking a new PC to your workspace no longer depends on the website answering first: FrameDecks now knows where your
workspace lives by itself, and the website is only the backup. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.10.2 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings. PCs that are already linked carry on exactly as before.

## What's New
None in this version.

## Enhancements
- **Workspace Sync → Connect** finds your workspace straight away, without first asking framedecks.com for its
  address. If framedecks.com cannot be reached, the PC still starts linking; you approve it on the website as before.
- The address and the public key it uses are the same two public values every visitor's browser receives from the
  website. Only the public key can ever be built in: a secret key is refused by the build.

## Fixes
None in this version.

## Performance Improvements
- Linking starts without one round trip to the website.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Approving a new PC still happens on the website (framedecks.com/connect), by design: it keeps an unknown PC from
  joining your workspace.
