# Passwordless workspace and Trusted Devices (FrameDecks 9.8)

Status: built on `main`. The owner runs migration `0015_trusted_devices.sql` and changes three Supabase settings (§6).

## In short

- **No sign-in pages any more.** The website has three ways in:
  - **Open my workspace** (9.11; was Sync Workspace; the website's header says **Open Workspace**): open your workspace on this device.
  - **Start a new one** (9.11; was Save Workspace; **Start a free workspace** on the home and download pages): start keeping your plans (asks for the Terms once).
  - **Continue on Another Device**: the same workspace somewhere else.

  All three ask only for an email address and send a **one-time link** that works once, for 10 minutes. There are no
  passwords, no Google or Microsoft buttons, and the words Sign In, Sign Up, Account and Password are not used.
- **The workspace opens itself.** After the link, the person's workspace opens. Someone with no workspace and no
  invitation gets one straight away ("My Workspace", renamed any time), using the same insert and owner trigger as
  before.
- **Trust This Device.** After the link the website asks whether to trust this device:
  - **Trusted:** the browser keeps the workspace session plus a random device token. Only a hash of the token is
    kept in the cloud. Future visits open with no link for 180 days, then one link renews it.
  - **Just this visit:** the session lives only in this tab.
- **Manage Devices** (Settings → Manage Devices) lists the Trusted Devices and recent security activity. **Remove**
  ends a device's access at once: its session is deleted, and every request still carrying that session is refused
  before it runs.
- **Unchanged:** workspaces, memberships, roles, invitations, the Plan, sync (`sync_push` / `sync_pull`), linked PCs
  and the Connect flow work exactly as before. The PC's settings section is renamed **Workspace Sync**; its behaviour
  is the same.

## 1. Flow

```
Open my workspace / Start a new one / Continue on Another Device  (/sync?intent=sync|save|continue)
  └ email → rpc magic_link_requested(email)      security log (address hashed), 10 per address / 30 per network an hour
          → supabase.auth.signInWithOtp(email)    one-time link, PKCE, 10 minutes (Supabase setting), single use
/auth/callback (the link)
  └ PKCE exchange → rpc magic_link_used()         security log
                  → ensureWorkspace()             existing workspace, or "My Workspace" if none and no invitation
                  → Home (or back to a PC's Connect request)
Any signed-in page
  └ TrustPrompt: Trust This Device → rpc trust_device(name) → token kept on the device, session moved to the device
                 Just this visit   → session stays in this tab
  └ TrustedDeviceGuard: at start and when the window comes back (at most once a minute)
                 rpc device_check(token) → trusted | revoked | expired (180 days) | unknown
                 revoked / expired → forget the session here → /sync?reason=…
Manage Devices (/devices)
  └ device_list(), device_revoke(id), security_event_list(), Continue on Another Device address
```

## 2. Where the session lives (website)

The site is a static export, so the session cannot be kept in an `HttpOnly` cookie. It lives in browser storage, as
before, but now depends on trust (`hosted/src/lib/trusted-device.ts` gives the Supabase client its storage):

| Device | Session | Device token |
|---|---|---|
| Not trusted | `sessionStorage`: this tab only, gone when it closes | none |
| Trusted | `localStorage` | `localStorage` (`fd-trusted-device`), the token only; the cloud keeps its SHA-256 |
| Used before 9.8 | stays where it was (`localStorage`) until the person chooses Trust This Device or Just this visit | none |

The PKCE code verifier always goes to `localStorage`, because the emailed link may open in a new tab. The Content
Security Policy (report-only since 9.3) and the absence of third-party scripts limit who could read storage.

## 3. Cloud (migration 0015)

| Object | Purpose |
|---|---|
| `trusted_devices` | Each trusted device: owner, name, `token_hash`, `session_id`, trusted, last seen, `expires_at` (+180 days), `revoked_at`. RLS on, no policies: reached only through the functions below. |
| `security_events` | Per person, kept one year: `link.requested` (address hashed), `link.used`, `device.trusted`, `device.revoked`, `device.expired`; the network as a hash. |
| `trust_device(name)` | A 256-bit random token, returned once; stores its hash and the current session. At most 20 active devices per person. |
| `device_check(token)` | `trusted` / `revoked` / `expired` / `unknown`; records the session in use and when it was last seen (hourly). |
| `device_list()`, `device_revoke(id)` | Only the person's own devices. Removing one deletes its `auth.sessions` row, so its refresh token stops working. |
| `security_event_list(n)` | The person's own events, including link requests made with their address. |
| `check_trusted_session()` | Installed as PostgREST's pre-request hook (`pgrst.db_pre_request`). It refuses any Data API request whose session belongs to a removed or expired device, so removal works at once even though access tokens last up to an hour. Requests with no such session (untrusted browsers, linked PCs, the anonymous key) pass. |
| `audit_workspace_sync` trigger | Writes `workspace.synced` to the workspace's audit log (0006), at most every 10 minutes. `sync_push` is not changed. |
| `security_log` | Copies device events to each of the person's workspaces' audit logs, so owners and admins see them. |

Rollback: `hosted/supabase/rollback/0015_trusted_devices_down.sql`. Tests:
- `hosted/tests/supabase-0015.test.mjs` (PGlite);
- `hosted/tests/trusted-device.test.mjs` (browser storage, and a check that the forbidden wording never appears).

## 4. Requirements and how they are met

| Requirement | How |
|---|---|
| No Sign In / Sign Up; three entry points | `/sync` with the three tabs; `/sign-in` forwards to it; Google and Microsoft buttons removed |
| One-time link, 10 minutes, single use | Supabase email OTP (PKCE). Single use is built into Supabase; 10 minutes is the **Email OTP Expiration** setting (§6). The website says "works once, for 10 minutes". |
| Workspace created or loaded | `ensureWorkspace` after the link (same insert and owner trigger as Home) |
| Trust This Device, token hashed, stored on the device, auto-open | `trust_device`, `fd-trusted-device`, session moved to `localStorage` |
| Manage Devices, removal at once | `/devices`; `device_revoke` deletes the session; `check_trusted_session` refuses its requests |
| Revalidate every 180 days | `expires_at`; `device_check` answers `expired` and the pre-request check refuses; one new link renews |
| HTTPS everywhere | Cloudflare (TLS and HSTS on the zone), plus `Strict-Transport-Security` sent by every page (`public/_headers`). Supabase is HTTPS-only. |
| Workspace data encrypted at rest | Supabase encrypts the database and its backups at rest (AES-256), and the encrypted nightly backups (`tools/backup_mac.py`) stay as they are. Encrypting fields inside the database would change the data model and the sync engine, which this change must not do. |
| Device tokens hashed | SHA-256 in `trusted_devices.token_hash`; the token itself is returned once and never stored in the cloud |
| Audit log | `security_events` (link requested, link used, device trusted, removed, expired), workspace audit log (`device.*`, `workspace.synced`), and Supabase's own authentication log (`auth.audit_log_entries`) |
| Wording | Open Workspace (Open my workspace), Start a free workspace (Start a new one), Continue on Another Device, Trust This Device, Trusted Devices, Manage Devices, Your workspace; a test fails if Sign in, Sign up, Account or Password appear in the website's interface text |
| Nothing else changes | No change to workspaces, roles, invitations, entities, `sync_push` / `sync_pull`, PC linking or the desktop's sync engine |

## 4a. The desktop application

The PC is a trusted device of its own kind and was already passwordless:
- **Linking once.** Since 26.11.12 (Scan to join, 0018): Settings → Sync → **Add a device** shows a QR code of
  `/join#c=CODE` (the PC's link code) and the code in big letters; the phone scans it and the website connects the PC,
  starting a team with the phone as owner when the person has none. **Open in this PC's browser instead** keeps the
  earlier way: the website's `/connect` page, where a signed-in owner or admin confirms the check number and chooses
  **Allow**. Either way the approval stays deliberate, because linking a PC gives it the workspace's plans. Once
  connected, the PC adds devices with its own key (Add a device, Invite someone, Allow a device, the Devices list).
- **Its own key.** The PC then keeps a key in Windows Credential Manager (0003, `computers.key_hash`). It syncs every
  minute and runs remote commands with no link, session or renewal, until the PC is removed on **Service PCs**.
  Manage Devices points there.
- **Unaffected by device removal.** Removing a browser in Manage Devices never disconnects a PC, and the reverse is
  also true.

## 5. Backward compatibility

- **People using the website before 9.8** keep their session. The first visit asks Trust This Device once.
- **People who used Google or Microsoft** enter the same email address. Supabase recognises the confirmed address and
  opens the same person, with the same workspaces and roles.
- **Old links** to `/sign-in` and `/sign-in#new` forward to `/sync` and `/sync?intent=save`.
- **Linked PCs** are not affected. They authenticate with their own key, not a person's session, so the pre-request
  check never refuses them.
- **The phone remote on the Wi-Fi** (PIN) is unchanged.

## 6. Owner steps (Supabase dashboard)

1. **SQL editor:** run `hosted/supabase/migrations/0015_trusted_devices.sql`. It sets
   `pgrst.db_pre_request = 'public.check_trusted_session'` on the API role and reloads the API.
2. **Authentication → Providers → Email:** set **Email OTP Expiration** to **600** seconds (10 minutes). Keep
   "Confirm email" on.
3. **Authentication → Providers:** switch **Google** and **Azure (Microsoft)** off. The website no longer offers them.
4. **Authentication → Email Templates → Magic Link:** suggested wording:
   - subject: "Your FrameDecks workspace link";
   - body: "Open your workspace: {{ .ConfirmationURL }}. This link works once, for 10 minutes."
5. **Optional:** set **JWT expiry** to 600 seconds. Removing a device is already immediate through the pre-request
   check; a shorter expiry also shortens the life of any copied access token.

## 7. Limits

- A device removed while offline keeps only what is already on its screen. Its next request is refused.
- The device token and session sit in browser storage on a trusted device, as sessions did before 9.8. Anyone using
  that device's browser profile can open the workspace until the device is removed. That is why the prompt says
  "Only on a device you use yourself".
- Supabase's email sending limits still apply (docs/deployment/free-hosting.md). The link-request limit in 0015 is in
  addition to Supabase's own limits.
