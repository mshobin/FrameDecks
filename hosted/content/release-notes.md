## FrameDecks v7.1.1

A safety update after Microsoft Defender quarantined FrameDecks 7.1 as a false alarm. Download from
**framedecks.com/download**. It installs over 7.1 and earlier and keeps all your meetings, members, settings and
recordings.

## What's New
- **Fewer antivirus false alarms.** FrameDecks no longer starts hidden helper programs (PowerShell, netsh or taskkill)
  in the background. Microsoft Defender treated that pattern, from a program that is not yet code-signed, as remote
  control by an attacker and removed FrameDecks 7.1 from some PCs. Everything those helpers did now goes through
  Windows' own built-in functions.

## Enhancements
- **Allow through Windows Firewall** and **Install the FrameRelay camera** ask for administrator permission with
  Windows' standard prompt.
- Updates start the installer directly. It waits for FrameDecks to close, installs, and opens the new version. If it
  cannot finish, it undoes its changes and the version you had stays.
- The installer's code-signing check, used once releases are signed, uses Windows' own signature check.
- The network type and firewall check for the phone remote run only while Settings → Phone & iPad Remote is open.

## Fixes
- FrameDecks no longer disappears after a while on PCs where Microsoft Defender quarantined it (see Known Issues to
  bring back a copy that was removed).

## Performance Improvements
- Nothing is started in the background every few minutes any more; the phone remote's network check costs nothing
  while its settings are closed.

## Known Issues
- If Microsoft Defender removed FrameDecks 7.1: Windows Security → Virus & threat protection → Protection history →
  the entry → Actions → Restore, then install 7.1.1. Until the installer is code-signed, adding an exclusion for the
  FrameDecks folder (Manage settings → Exclusions → Folder: your AppData\Local\Programs\FRAMEDECKS) avoids
  repeat alarms.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- The public-network warning in the header appears after Settings → Phone & iPad Remote has been opened once.
