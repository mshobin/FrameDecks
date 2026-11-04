# Signing in the phone remote (9.7 recommendation)

Status: recommendation for the owner, not built yet. Written 4 November 2026 for FrameDecks 9.7.

## In short

- **Recommended:** the phone never signs in to Google or Microsoft. You sign in **once**, on the PC (or on
  framedecks.com). The phone is **paired with that PC** by scanning a QR code. The PC then gives the phone its own
  device key. It is kept for 30 days of use, and you can remove it from the PC at any moment.
- **No change for people who use the PIN today.** The 6-digit PIN stays as a fallback for a phone that cannot scan.
- **Away from the Wi-Fi** (phase 2): the same pairing can also give the phone a narrow grant to run *this PC* through
  the workspace. This still needs no Google or Microsoft account on the phone.
- **Re-authentication is optional and light.** The PC asks again only when something unusual happens:
  - a new phone;
  - a key unused for 30 days;
  - the PIN or the pairing reset on the PC;
  - and, if the owner switches it on, before **Leave meeting** or **Clear drawings**.

## 1. What the phone uses today

| Path | How it signs in | Where it works | Weak spots |
|---|---|---|---|
| Phone remote (`remote.html`, Wi-Fi) | 6-digit PIN, then an `HttpOnly; SameSite=Strict` cookie, 30 days (`src/server.py` `remote_login`, `SESSION_DAYS`, `kc-remote-sessions.json`). The PIN has a lockout that grows longer after each run of wrong guesses (9.1.2). | Same Wi-Fi as the PC | One shared PIN for every phone; no list of phones and no way to remove one; typing a PIN mid-meeting; plain HTTP on the local network. |
| Website Live page (framedecks.com) | Supabase sign-in: an emailed link, Google or Microsoft. The PC fetches the commands from the workspace (`src/cloud_remote.py`, docs/architecture/remote-control-design.md). | Anywhere with internet | A full account session on a phone that may be borrowed; a second sign-in to remember. |

## 2. Options compared

| Option | For | Against | Verdict |
|---|---|---|---|
| **Google / Microsoft on the phone** | One identity per person; works anywhere | <ul><li>Slow on a borrowed or shared phone, mid-meeting.</li><li>OAuth cannot return to `http://192.168…` (providers need HTTPS or a registered address), so it cannot sign in the Wi-Fi remote at all.</li><li>The phone then holds a token for the whole account, not just "run this PC".</li><li>Providers' sessions expire on their own schedule.</li></ul> | Not for the remote. Keep it for planning on the website. |
| **PIN only (today)** | Simple; works with no internet | <ul><li>A shared secret: anyone who heard it is in.</li><li>Only 6 digits (the lockout makes guessing slow).</li><li>No list of phones, no per-phone removal.</li></ul> | Keep as the fallback. |
| **Passkeys (WebAuthn)** | Phishing-proof; no secret to type | Browsers allow them only on HTTPS pages ("secure context"). The Wi-Fi remote is plain HTTP on the local network, so they cannot be used there without a certificate the phone trusts. | Not now. Revisit if the remote is ever served over HTTPS. |
| **QR pairing with a device key (recommended)** | <ul><li>One scan, nothing to type.</li><li>Each phone is listed on the PC and can be removed.</li><li>No account on the phone.</li><li>Works with no internet on the Wi-Fi.</li><li>Builds on the QR Settings already shows (`app/js/remote-panel.js`).</li></ul> | <ul><li>The phone must see the PC screen once.</li><li>Plain HTTP on the Wi-Fi still needs the mitigations in §4.</li></ul> | **Recommended.** |

## 3. Recommended flow

1. **Sign in once on the PC.** Use FrameDecks account (Settings → FrameDecks account), which already links this PC to
   the workspace through the browser. Nothing else is signed in on the phone.
2. **Pair.** Settings → Phone & iPad Remote (and Spotlight's **Phone remote**) show a QR code. It holds:
   - the PC's address on the Wi-Fi;
   - a **one-time pairing code**: 128 random bits, valid for 2 minutes, usable once, and replaced as soon as it is
     used or expires.

   Example: `http://192.168.1.20:8750/remote.html#pair=Gx8…`. The code sits after the `#`, so it never reaches the
   web server's logs or any proxy. The page reads it and sends it in a POST.
3. **Approve (first time only).** The PC shows "Allow *Ana's iPhone* to run this meeting? Check number 47". The phone
   shows the same number. Choosing **Allow** on the PC finishes the pairing. If the owner turns approval off, a fresh
   QR is trusted by itself, because the code itself proves the phone saw this screen.
4. **The device key.**
   - The PC issues a 256-bit random key and sets it as an `HttpOnly; SameSite=Strict; Path=/` cookie, the same kind
     as today's cookie.
   - The PC stores only the key's SHA-256 hash, with the device name, when it was paired, when it was last seen and
     its role: **Run** (everything the remote does) or **View** (Teleprompter and status only).
   - The key slides: each day of use keeps it for another 30 days, up to 180 days. After that, scan again.
5. **Manage.**
   - Settings → Phone & iPad Remote lists the phones, each with when it was last seen and a **Remove** button.
     Removing a phone ends its access at once.
   - **Reset all** forgets every phone and makes a new PIN.
   - The PC shows "Ana's iPhone connected" when a phone first connects in a session.
6. **Away from the Wi-Fi (phase 2).**
   - At pairing, the PC (which is signed in to the workspace) can also create a **device grant** in the workspace:
     - a new table `remote_devices`, holding the key's hash, this PC's id, the role, expiry and revocation (migration
       `0015`, with a rollback script and PGlite tests, as for `0012`–`0014`);
     - a `security definer` function `remote_send_device(key, command)` that checks the hash, the role and the PC.
   - The phone sends commands through framedecks.com with this key, and the PC fetches them as it does for the
     Live page today.
   - Removing the phone on the PC revokes the grant in the same step.
7. **Optional re-authentication.** Ask for the PIN or the PC's approval again in these cases:
   - when a key has not been used for 30 days;
   - when the PC's PIN or pairing is reset;
   - and, if the owner switches **Ask again for Leave and Clear** on, before those two actions.

   Nothing else interrupts the meeting.

## 4. Security requirements

- **Secrets:**
  - pairing codes and device keys come from `secrets.token_urlsafe` (128 and 256 bits);
  - the PC keeps only hashes;
  - they are compared with `hmac.compare_digest`;
  - they never appear in logs, diagnostics or backups. `kc-remote-sessions.json` is already left out of the support
    bundle; the new devices file joins it.
- **Pairing codes:** single use, 2 minutes, at most 5 tries per code and the existing PIN lockout per address. A new
  QR replaces the old one.
- **Cookies:**
  - `HttpOnly`, `SameSite=Strict`, `Path=/`;
  - the PC still checks that the `Origin` header matches its own address on every POST, against requests forged from
    another page;
  - `Secure` cannot be set while the remote is plain HTTP.
- **Plain HTTP on the Wi-Fi.** Someone on the same network could capture a key. There are two ways to reduce this,
  in order:
  1. **Short-lived request signatures.** The QR code also carries a 256-bit signing key. The phone signs each command
     (HMAC-SHA-256 of method, path, time and body), and the PC accepts a signature only within 30 seconds and only
     once. A captured cookie alone is then useless.
     - Browsers' built-in crypto (WebCrypto) is not available on plain-HTTP pages. So this needs a small SHA-256/HMAC
       routine in `remote.js` (about 2 KB), checked against the Python `hmac` module in tests.
  2. **HTTPS on the Wi-Fi.** A per-PC certificate shown in the QR code would let the remote use passkeys and `Secure`
     cookies, but each phone would first have to trust the certificate. That is too much friction for now.
- **Least privilege.** A device key can run the remote and nothing else:
  - no Settings;
  - no files, Bible or AI keys;
  - no `/api/app/*`, which stays this PC only.

  The **View** role is read-only.
- **Revocation and audit.**
  - **Remove** takes effect on the next request.
  - Each command from a phone is kept 7 days with the device name, matching the website's Live page log.
- **Unchanged:** the PIN lockout, the request size limits and the connection cap (9.1.2), and the PC's final say
  over every command.

## 5. Implementation plan (when the owner says go)

| Step | Where | What |
|---|---|---|
| 1 | `src/remote_devices.py` (new) | Devices file: hash, name, role, created, last seen, expiry. Functions: pairing-code store, `pair(code, name)`, `check(key)`, `remove(id)`, `reset()`. Unit tests for expiry, single use, removal and hashing. |
| 2 | `src/server.py` | `POST /api/remote/pair` (public, small body, rate-limited), `signed_in()` accepting a device key as well as today's PIN cookie, `GET/POST /api/app/remote-devices` (this PC only). |
| 3 | `app/js/remote-panel.js` | QR code with `#pair=…`, renewed every 2 minutes while the panel is open; list of phones with **Remove** and **Reset all**; approval prompt with the check number. |
| 4 | `app/js/remote.js`, `app/remote.html` | Read `#pair=` and post it, then drop it from the address; show "Waiting for the PC to allow this phone…"; keep the PIN form as **Use a PIN instead**. |
| 5 | (optional) `app/js/remote-sign.js` | HMAC request signatures (§4), with matching Python tests. |
| 6 | Phase 2: `hosted/supabase/migrations/0015_remote_devices.sql` + rollback + PGlite tests; `src/cloud_remote.py`; the website's Live page | Device grants for use away from the Wi-Fi. |

Estimated effort:
- Steps 1–4: about two days with tests.
- Step 5: one day.
- Phase 2: two to three days, including the migration's tests.

## 6. Decisions for the owner

1. Approval on the PC for a new phone: **on** (recommended) or off?
2. Roles: Run and View (recommended), or Run only?
3. How long a device key lasts: 30 days of use, at most 180 (recommended)?
4. Request signatures on the Wi-Fi (step 5): now, or later?
5. Phase 2 (away from the Wi-Fi with the same pairing): now, or keep using the website Live page for that?
