# Joining without typing (26.11.26)

One rule: **a device you already trust brings in the next one.** Nobody types a password, and almost nobody types a
code.

## 1. Add a device: the phone opens the workspace as you

- The church PC (Settings → Sync → Add a device) or a signed-in browser (Devices → Add a device) shows a QR code.
  The code is random, kept only as a SHA-256 hash, works once and runs out after 2 minutes
  (`0021_passwordless.sql`: `pc_device_code_create`, `device_code_create`).
- The phone's camera opens `framedecks.com/join#c=CODE`. The page looks at the code (`join_code_peek`: status `self`,
  the team and a masked email), then calls the Edge Function `device-sign-in`
  (`hosted/supabase/functions/device-sign-in`).
- The function, the only place that holds the service key, uses the code once (`device_code_redeem`; wrong codes are
  counted per network, 60 an hour) and asks Supabase Auth for a one-time sign-in for that person's email
  (`auth.admin.generateLink`, nothing is emailed). The phone turns it into its own session
  (`verifyOtp({ token_hash, type: "magiclink" })`) and becomes a Trusted Device.
- The PC's code signs the phone in as **the person who connected the PC** (`computers.created_by`). A PC connected by a
  device without an email gets the old Admin invite instead. **Invite someone** (a different person) is unchanged.
- No anonymous sign-ins are involved, and there is no check number and no approval: being at the PC, or holding a
  signed-in device, and asking for the code is the approval. Every sign-in this way is in the person's security log
  (`signed-in-by-code`), and every device is in Devices with Remove.

## 2. Connect this PC from the website

- Signed in as an owner or admin, Home → **Connect this PC** makes a one-time grant (`pc_grant_create`, 2 minutes) and
  opens `framedecks://connect?grant=CODE`.
- `src/desktop_app.py` reads that one link (8 letters and digits; anything else is ignored) and hands it to the
  running program. `cloud_sync.Service.grant_offer` looks it up (`pc_grant_peek`: the team and who sent it) and
  `app/js/connect-grant.js` asks **Connect** or **Not now**. Only Connect uses it (`pc_link_with_grant`, with the PC's
  own new key). A web page can never connect a PC without that click.

## 3. Passkeys, and Google, Apple or Microsoft

- After a device is trusted, Home offers **Save a passkey** once (`supabase.auth.registerPasskey`). Open Workspace then
  has **Open with a passkey** (`signInWithPasskey`): Face ID, a fingerprint or Windows Hello.
- Open Workspace shows **Continue with Google / Apple / Microsoft** for each provider switched on.
- Both appear only when Supabase says they are on (its public `/auth/v1/settings`), so a button never leads to an
  error page.

## Owner steps (Supabase dashboard, project `slrsykiknlqlivlnpvrb`)

1. **SQL editor:** run `hosted/supabase/migrations/0021_passwordless.sql` (after 0020). Undo:
   `hosted/supabase/rollback/0021_passwordless_down.sql`.
2. **Edge Functions → Deploy a new function** named `device-sign-in`, with the code of
   `hosted/supabase/functions/device-sign-in/index.ts`, and **Verify JWT off** (the phone has no session yet; the code
   is the proof). With the Supabase CLI: `supabase functions deploy device-sign-in --no-verify-jwt`. Its service key is
   provided by Supabase; nothing to paste.
3. **Authentication → Sign In / Providers → Passkeys:** switch on, with the site `framedecks.com`.
4. **Optional, Google, Apple or Microsoft:** switch on each provider with its client ID and secret, and add
   `https://framedecks.com/auth/callback` under **URL Configuration → Redirect URLs**.

Until step 2 is done, scanning an Add a device code says so (FD-CLD-07) and email still works.

Tests: `hosted/tests/supabase-0021.test.mjs` (PGlite), `tests/test_passwordless_2611_26.py`.
