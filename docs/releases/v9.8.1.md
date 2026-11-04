## FrameDecks v9.8.1

Spotlight stays out of the way. After installing, opening or reopening FrameDecks, the Spotlight search no longer
appears by itself: it opens only when you press its shortcut (Alt+Space) or choose Search in the tray. This version
also brings clearer legal pages, a Security page that lists every protocol FrameDecks uses, and fresh Help pictures
for the new Sync Workspace page. Download from **framedecks.com/download**, or let FrameDecks update itself. It
installs over 9.8.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

## What's New
- **Security, in the open.** The Security page on framedecks.com now lists the protocols and controls in one table:
  - HTTPS (TLS 1.2 or later) with HSTS on every page;
  - the one-time link (OAuth 2.0 with PKCE, single use, 10 minutes) and short-lived signed sessions;
  - Trusted Device tokens (256-bit, kept in the cloud only as a SHA-256 hash, 180 days);
  - row-level security, AES-256 encryption at rest and encrypted, integrity-checked backups;
  - how linked PCs, the phone remote and updates are protected, and the limits we know of.

## Enhancements
- The Privacy, Terms, Cookies and Vulnerability Disclosure pages use the new words: your workspace, the one-time
  link, Trusted Devices and Manage Devices. What you agreed to is unchanged.
- The Cookies page lists the new storage used by Trust This Device.
- Help: the first website step shows the Sync Workspace page.

## Fixes
- The Spotlight search no longer opens with the program after installing or when reopening it. It is now made only
  the first time you ask for it, and hides itself again if Windows tries to show it.

## Performance Improvements
- The program starts with one window fewer: Spotlight is created only when you first open it.

## Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Links are emailed, so the first time on a new device needs your inbox. After that, a Trusted Device opens by itself.
