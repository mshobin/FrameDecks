# Security at FrameDecks

*Updated 29 October 2026*

FrameDecks is built so that the most sensitive part of a gathering, what is on screen, never needs the internet. The
program runs on your own PC; the website and its services only carry the plan and the people your workspace chooses
to share.

## Data protection

- **Local first.** Pictures, videos, PDFs, PowerPoint files, audio, the camera picture and what is on screen stay on the
  presenting PC. The program works fully offline.
- **Only what is needed online.** A workspace's plan (Frame names and words), its member list and the names of its
  linked PCs. Nothing else is sent.
- **Separated by workspace.** Every table in the database has row-level security: a person sees only the workspaces
  they belong to, and only what their role allows. Linked PCs see only their own workspace.
- **No advertising, no tracking, no selling of data.**

## Encryption

- **In transit:** every connection to framedecks.com, the database, the update service and downloads uses TLS
  (HTTPS). The program's own server listens on this PC only (127.0.0.1); the optional phone remote on the local Wi-Fi
  is off until you turn it on and asks for a PIN.
- **At rest:** the database and its storage are encrypted at rest by our provider (AES-256). Nightly backups are
  encrypted with a passphrase before they leave the backup machine.
- **On the PC:** the key a linked PC uses is kept in Windows Credential Manager, not in a file.

## Signing in

- Sign in with an emailed one-time link, or with Google or Microsoft. FrameDecks never sees or stores a password.
- Sessions use short-lived tokens that renew themselves; signing out ends them on that device.
- A PC is linked only when a workspace owner or admin allows it in the browser, with a check number shown on both
  screens. Its secret key never leaves the PC; the service stores only its hash. Owners can unlink a PC at once.
- Repeated wrong link codes are limited (20 an hour per person).
- Changes to people, roles, invitations and PCs are recorded in a log kept for one year.

## Updates and downloads

- The program and its updates come only from framedecks.com and downloads.framedecks.com.
- Every update is checked against its published SHA-256 fingerprint before it is installed; if anything does not
  match, nothing is installed. If an update fails to install, the previous version is put back.
- Builds are made from a private repository by an automated pipeline, with tests and an install test on a clean
  Windows machine before every release.

## Backup and recovery

- The database is backed up every night, encrypted, and kept for 30 days.
- Each plan keeps 30 days of earlier versions, so owners and admins can restore a Frame, including a deleted one.
- The program backs up its own data on the PC every day (the newest 10 are kept), and Settings → Data / Backup can
  make a backup at any time.
- If the online services are unavailable, the program keeps presenting; it syncs again when they return.

## Responsible disclosure

We welcome reports from security researchers. Please read our Vulnerability Disclosure policy at
framedecks.com/security/disclosure, and write to **security@framedecks.com**. We do not take legal action against good-faith
research that follows that policy.

## Contact

- Security: security@framedecks.com
- Privacy: privacy@framedecks.com
- Everything else: hello@framedecks.com
- Machine-readable: framedecks.com/.well-known/security.txt
