# Security policy

FrameDecks runs on a church's own computer and holds information that matters: member names, phone numbers and
birthdays, meeting content, and the phone-remote PIN. We take reports about its security seriously.

## Supported versions

| Version | Supported |
| --- | --- |
| 6.6 | Yes |
| Earlier versions | No. Please update to the latest installer before reporting. |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

- Use **Security → Report a vulnerability** on the repository, if private vulnerability reporting is enabled, or
- contact the repository maintainer privately through their GitHub profile.

Include the version, what an attacker could do, the steps to reproduce and, if you can, a suggested fix. Do not include
real member data, PINs or API keys; use made-up examples. You can expect an acknowledgement within a week. We will tell
you when a fix is released and, if you wish, credit you in the release notes.

## How FrameDecks protects a church's data

| Area | What the program does |
| --- | --- |
| **Network exposure** | The program listens on `127.0.0.1` (this PC only). It answers only requests addressed to `localhost` or `127.0.0.1`, which blocks DNS-rebinding tricks from web pages. |
| **Phone remote** | Off unless turned on (Settings → Phone & iPad Remote, or `--remote`). When on, it also listens on this PC's local network addresses, and every page except the sign-in page needs a PIN. |
| **PIN sign-in** | After 5 wrong PINs from a device, that device must wait 60 seconds. A correct PIN creates a random session token in an `HttpOnly`, `SameSite=Strict` cookie that lasts 30 days. **New PIN** (Settings → Phone & iPad Remote) signs every device out at once. |
| **What the remote can reach** | Devices other than this PC can reach only an allow-list of pages and APIs (the remote, the shared meeting state, overlay pages, the brand logo and the live picture for the drawing pad). Settings, uploads, backups, members, scripture lookup and the camera controls are this PC only. |
| **Member data** | Members are kept in a separate file (`kc-members-private.json`) that is never sent to the phone remote or the overlay pages. The birthday card receives only what the greeting needs (no phone, email or birth date). |
| **Saving** | State is written to a temporary file and then swapped in, so a crash or power cut cannot leave a half-written file. Backups are made daily. |
| **Outbound connections** | None, except the optional ESV scripture lookup, which sends only the reference you asked for and your ESV API key to `api.esv.org`. The key stays on the PC and is never sent to the remote. |
| **Telemetry** | None. The program does not report usage, crashes or anything else. |

## Known limitations

- The installer is not code-signed yet, so Windows SmartScreen shows a warning on first install. Download installers
  only from this repository's Actions or Releases pages and check the published SHA-256 file.
- The phone remote uses plain HTTP on the local network (there is no certificate a phone would trust for a local
  address). Use it on a network you trust; a guest Wi-Fi shared with the public is not recommended.
- Anyone with access to the PC's Windows account can read the data folder (`%APPDATA%\FrameDecks`). Protect
  the PC with a Windows password.
