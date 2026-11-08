# Scan to join (FrameDecks 26.11.12)

Status: built on `main`. The owner runs migration `0018_scan_to_join.sql` and changes two Supabase settings (§5).

## In short

- People see only **Add a device** and **Invite someone**. No passwords, no emailed links needed, no "workspace",
  "link", "trust" or "resync" to understand.
- **A device joins by scanning a QR code** shown by a device that is already in: the church PC (by its own key) or a
  signed-in phone or browser. The code is also printed under the QR to type on a computer without a camera.
- **The other way round** (a work computer): the new browser shows its own code and QR; a phone that is already in
  scans it, or the code is typed into FrameDecks on the church PC (Sync → Allow a device).
- **Everything syncs by itself**: the PC on opening and every minute, the website as you edit. One status light.
- **Recovery**: an optional emergency email (the device-only person gets an address), and a printable recovery code
  (owner only) that makes a new device the owner when every device is lost.

## 1. Who is a device

A phone or browser that joins without email is a Supabase **anonymous user** (a real person record with no email).
It becomes a member of the team when its code is used, with the role the code carries (Admin or Helper). Email
people (9.8 and older) are unchanged and can use every new screen too. A device-only person cannot start a team on
its own (the `organizations_insert` policy refuses anonymous people), so anonymous sign-ins cannot fill the database
with empty teams: a team is started only by an email person or by a phone scanning a brand-new PC's code.

## 2. Flows

```
Brand-new PC + phone          PC: computer_link_start (0003) → QR https://framedecks.com/join#c=CODE
                              phone: join_code_peek (no session) → anonymous sign-in → accept_terms → join_with_code
                                     → team "My Workspace" owned by the phone, the PC linked to it
                              PC: computer_link_poll → linked
Add a device / Invite         PC: pc_invite_create(role)  or  a signed-in device: invite_create(team, role)
                              → QR /join#c=CODE (2 minutes, once) → new device: peek → anonymous sign-in → join_with_code
A computer with no camera     new browser: anonymous sign-in → join_request_create → QR /allow#c=CODE (5 minutes)
                              a device that is in: join_request_peek → join_request_allow(team, role)
                              or the PC: pc_join_request_allow(code, role)
                              new browser: join_request_status → allowed
Devices                       workspace_devices(team) / pc_devices(); device_remove / pc_device_remove; computer_revoke
Recovery                      owner: recovery_code_create(team) (XXXX-XXXX-XXXX-XXXX, shown once)
                              new device: anonymous sign-in → recover_team(code) → owner; the old owner stays Admin
```

## 3. Security

| Concern | How |
|---|---|
| Codes | 8 characters from 31 without look-alikes (recovery: 16), random, kept only as SHA-256; work once; run out after 2 minutes (5 for a waiting browser) |
| Guessing | Wrong codes are counted per person, per PC and per network and limited (20 an hour; 5 for recovery). A wrong code is an answer (`{"status":"wrong"}`), not an error, so the count is never undone |
| Peeking | `join_code_peek` works before the new device signs in, so a wrong code never makes a new person; it is limited like wrong codes |
| Roles | The owner adds Admins or Helpers, an admin only Helpers (0013's rule); the church PC may add an Admin (being at the PC is the proof); nobody is made owner by a code |
| Removal | Removing a device ends its membership; when it is in no team any more its sessions are deleted and its Trusted Device record closed, so 0015's pre-request check refuses it at once |
| Logs | The person's security events (`joined`, `removed`, `team.recovered`) and the team's audit log (membership changes, recovery) |
| Tables | `join_codes`, `join_failures`, `recovery_codes`: RLS on, no policies, reached only through the functions |

## 4. Not changed

Email links and codes, Trusted Devices (0015), invitations, roles, `sync_push` / `sync_pull`, linked PCs (their key in
Windows Credential Manager) and the cloud remote work as before. Already-linked PCs need no action.

## 5. Owner steps (Supabase dashboard)

1. **SQL editor:** run `hosted/supabase/migrations/0018_scan_to_join.sql` (after 0017). Undo:
   `hosted/supabase/rollback/0018_scan_to_join_down.sql`.
2. **Authentication → Sign In / Providers:** switch on **Allow anonymous sign-ins**. Without it the website shows
   "Joining by code isn't switched on yet" and email still works.
3. **Authentication → Email Templates → Magic Link:** add the 6-digit code so a link that opens in the wrong browser
   is not a dead end, e.g. body: "Open your workspace: {{ .ConfirmationURL }} — or type this code: {{ .Token }}. It
   works once, for 10 minutes."

Tests: `hosted/tests/supabase-0018.test.mjs` (PGlite).
