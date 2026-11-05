# Security at FrameDecks

*Updated 4 November 2026 · Version 2026-10-29*

FrameDecks is built so that the most sensitive part of a gathering, what is on screen, never needs the internet. The
program runs on your own PC. The website and its services carry only the plan and the people your workspace chooses
to share. This page lists the protocols and controls we use, and the limits we know of, so you can judge them for
yourself.

## At a glance

| Area | What we use |
| --- | --- |
| Transport | TLS (HTTPS) on every connection; HSTS for one year, sub-domains included |
| Opening your workspace | An emailed one-time link (OAuth 2.0 authorization code with PKCE, S256), single use, valid 10 minutes |
| Sessions | Short-lived signed access tokens (JWT) that renew with rotating refresh tokens |
| Trusted Devices | A 256-bit random device token; the cloud keeps only its SHA-256 hash; 180 days, then one new link |
| Removing a device | Its session is deleted and every request carrying it is refused before it runs |
| Access control | PostgreSQL row-level security on every table |
| Data at rest | AES-256 (database and storage, by our provider); nightly backups AES-256 with an HMAC-SHA256 integrity check |
| Keys on the PC | Windows Credential Manager |
| Updates | Downloaded only from framedecks.com hosts and checked against a SHA-256 fingerprint before installing |
| Audit | Security events and workspace changes logged, kept one year |

## Data protection

- **Local first.** Pictures, videos, PDFs, PowerPoint files, audio, the camera picture and what is on screen stay on the
  presenting PC. The program works fully offline.
- **Only what is needed online.** A workspace's plan (Frame names and words), its member list, the names of its linked
  PCs, and the names of its people's Trusted Devices. Nothing else is sent.
- **Separated by workspace.** Every table in the database has row-level security. A person sees only the workspaces
  they belong to, and only what their role (owner, admin, member) allows. Linked PCs see only their own workspace.
  Tables that hold device tokens and security events have no direct access at all: they are reached only through
  functions that check who is asking.
- **No advertising, no tracking, no selling of data.**

## Encryption

- **In transit.** framedecks.com, downloads.framedecks.com, the update service (Cloudflare) and the database
  (Supabase) accept only HTTPS (TLS 1.2 or later). Every page of framedecks.com sends
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`, so browsers refuse plain HTTP for a year.
- **At rest.** The database and its storage are encrypted at rest by our provider (AES-256). The nightly backup is
  encrypted before it leaves the backup job:
  - AES-256-CBC, with a key derived from a passphrase only the owner holds (PBKDF2, 200,000 iterations, salted);
  - an HMAC-SHA256 that shows whether the backup was changed.
- **On the PC.** The key a linked PC uses, and an ESV Bible key if you add one, are kept in Windows Credential Manager,
  not in a file.

## Opening your workspace (no passwords)

FrameDecks has no passwords and nothing to remember.

- **One-time link.** Open my workspace, Start a new one and Continue on Another Device send a one-time link to your
  email address:
  - it uses the OAuth 2.0 authorization code flow with PKCE (S256), so only the browser that asked can use it;
  - it works once, for 10 minutes.
- **Link requests are limited and logged.** Each address may ask 10 times an hour and each network 30 times an hour.
  We keep the address only as a SHA-256 hash and the network only as a hash.
- **Sessions.** Signed access tokens (JWT) last at most an hour and renew with refresh tokens that change at each
  use. Until you trust a device, the session lives only in that browser tab and ends when the tab closes.
- **Trust This Device.**
  - The browser receives a 256-bit random device token; the cloud keeps only its SHA-256 hash.
  - The device opens your workspace with no new link for 180 days. After that it asks for one link again
    (revalidation).
  - A trusted device checks its token each time it opens.
- **Removing a device.** Manage Devices removes a device at once:
  - its session is deleted, so it cannot renew;
  - a check that runs before every database request (PostgREST pre-request) refuses any request still carrying that
    session, even within the access token's last hour.
- **Disconnect this device** ends the session on that device and removes its trust.

## Linked PCs and the phone remote

- **Linking a PC.**
  - A workspace owner or admin must allow the PC in the browser, with the same check number shown on both screens.
  - The PC makes its own 256-bit key, which never leaves the PC; the cloud stores only its SHA-256 hash.
  - Link codes expire after 10 minutes. Each network may hold at most 5 waiting codes, and wrong codes are limited
    (20 an hour per person).
  - Owners and admins can unlink a PC at once on Service PCs.
- **Running a meeting from the website.** The PC fetches commands from the workspace itself, so nothing connects
  in to the PC.
  - The PC accepts only a short list of actions, from people the workspace allows, and checks that permission again
    for each command.
  - Every command is shown on the PC and kept for 7 days.
  - One switch on the PC turns it off.
- **Live push (9.11).** A linked PC is told when something changed instead of asking every few seconds.
  - It keeps one encrypted WebSocket (TLS) to Supabase Realtime, only while it is needed, on a channel named by a
    256-bit random value that only linked PCs of the workspace receive. A message on it carries no plan data, only
    what kind of thing changed; the PC then reads it with its own key, as before.
  - Unlinking a PC gives the workspace a new channel name.
  - The website's Live page listens on a private channel that only people allowed to run services can join (Realtime
    Authorization, checked by the database).
  - If the connection cannot be made, everything works as before, by asking.
- **The program's own server.** It listens on the PC itself (127.0.0.1) for everything except the phone remote.
- **The phone remote on the local Wi-Fi.** It is off until you turn it on.
  - It asks for a 6-digit PIN. After 5 wrong PINs the device waits a minute, and each further 5 doubles the wait (up
    to an hour). 100 wrong PINs from all devices in 10 minutes make everyone wait.
  - A correct PIN gives an `HttpOnly`, `SameSite=Strict` session for 30 days. New PIN ends every session.
  - The phone remote uses plain HTTP on your local network, because a certificate a phone trusts cannot be issued for
    a home or church network address. Use it on a network you trust.

## The website

- **Static pages, no third-party scripts.** framedecks.com is a static site served by Cloudflare. It loads no
  advertising, analytics or third-party scripts.
- **Security headers on every page:**
  - `Content-Security-Policy` with per-page script hashes (report-only while it is checked against real use);
  - `frame-ancestors 'none'` and `X-Frame-Options: DENY`;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - a `Permissions-Policy` that turns off location, microphone, payment and USB.
- **Only the public key in the browser.** The website and the program use only the database's public (anon) key.
  Access is decided by row-level security and by functions that check who is asking. No secret or service key is
  ever in the website or the program, and a test fails the build if one appears.
- **Pages that are never kept by a cache.** The one-time link's return page and Open Workspace are served with
  `Cache-Control: no-store`.

## Audit and accountability

- **Your own security events.** Link asked for, link opened, device trusted, device removed and trust ended are kept
  for one year. You can see your own in Manage Devices.
- **The workspace log.** Owners and admins see a log of members joining or leaving, role changes, invitations, PCs
  linked or unlinked, Trusted Devices added or removed, and workspace syncs. It is kept for one year.
- **Our provider's log.** Supabase also keeps its own authentication log.

## Updates and downloads

- **Where updates come from.** The program and its updates come only from framedecks.com and
  downloads.framedecks.com; the updater refuses any other host and any redirect away from them.
- **Fingerprint check.** Every update is checked against its published SHA-256 fingerprint before it is installed.
  If anything does not match, nothing is installed. If an update fails to install, the previous version is put back.
- **Release signing.** The release manifest can be signed with Ed25519 and checked by the program. Signing is built
  and will be switched on when the signing key is issued.
- **Code signing.** The installer is not yet code-signed, so Windows may ask you to confirm the first time.
- **How releases are built.** Every release is built by an automated pipeline from the source repository:
  - Python packages are installed only with matching SHA-256 hashes (`--require-hashes`);
  - every GitHub Action is pinned to an exact commit;
  - the PyInstaller launcher is built from source;
  - the build runs the tests and installs the result on a clean Windows machine before it is published.

## Backup and recovery

- **The database.** It is backed up every night, encrypted (above), and the backup is kept for 30 days.
- **Each plan's history.** Each plan keeps 30 days of earlier versions, so owners and admins can restore a Frame,
  including a deleted one.
- **The PC's own backups.** The program backs up its own data on the PC every day, keeping the newest 10.
  Settings → Data / Backup can make a backup at any time.
- **When the online services are down.** The program keeps presenting, and syncs again when they return.

## Known limits

We list these so nothing is hidden:

- **Shared devices.** A Trusted Device keeps its session and device token in the browser's storage. Anyone who uses
  that browser profile can open the workspace until the device is removed, so trust only devices you use yourself.
- **The local Wi-Fi.** The phone remote uses plain HTTP on the local network (see above).
- **Code signing.** The installer is not yet code-signed, and release-manifest signing is not yet switched on (see
  above).

## Responsible disclosure

We welcome reports from security researchers. Please read our Vulnerability Disclosure policy at
framedecks.com/security/disclosure, and write to **security@framedecks.com**. We do not take legal action against
good-faith research that follows that policy. If a security problem affects your data, we will tell you as the law
requires.

## Contact

- Security: security@framedecks.com
- Privacy: privacy@framedecks.com
- Everything else: hello@framedecks.com
- Machine-readable: framedecks.com/.well-known/security.txt
