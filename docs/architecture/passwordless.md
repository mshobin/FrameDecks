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

## 3. Passkeys first, an email code as the fallback (26.11.36)

- After a device is trusted, Home offers **Save a passkey** once (`supabase.auth.registerPasskey`). Open Workspace then
  has **Open with a passkey** (`signInWithPasskey`) first: Face ID, a fingerprint or Windows Hello.
- **Use an email code instead** stays below it as the fallback (a one-time link and 6-digit code).
- The passkey button appears only when Supabase says passkeys are on (its public `/auth/v1/settings`), so it never
  leads to an error page.
- Google, Apple and Microsoft are not used to open workspaces (owner's decision, 26.11.36: "I do not want to use google
  or microsoft for the workspace"). The website has no OAuth provider buttons and never calls `signInWithOAuth`.

## 4. New-device alerts (26.11.36)

- Every time a PC is connected to a workspace (a link code, or a grant from Connect this PC) or a person's device joins
  its team (scanning a code, being allowed, a recovery code, or Add a device signing a phone in as you), a row is
  written to `public.device_alerts` (`0023_device_alerts.sql`). The rows come from AFTER INSERT triggers on
  `computers` and on the security events that `join_team`, `recover_team` and `device_code_redeem` already log, so no
  earlier function changed.
- **Devices** shows owners and admins the last 30 days at the top (`device_alerts_recent`: newest first, at most 20),
  for example "New: Office PC connected · 10 Nov, 14:32". Helpers see nothing; nothing shows when there are none.
- A Supabase **Database Webhook** on INSERT into `device_alerts` calls the Edge Function `device-alert`
  (`hosted/supabase/functions/device-alert`). It checks the shared secret header `x-alert-secret`, takes the alert once
  with the service key (`device_alert_take`, which also sets `sent_at`, so a repeated webhook sends nothing), and sends
  one plain email to each owner and admin through Resend's API: "A new PC was connected to
  <workspace>", the device name, the time (UTC) and "If this wasn't you, remove it in Devices on framedecks.com" with
  the link. If no email could be sent, `device_alert_release` gives the alert back. Missing secrets are logged and
  answered with 200: nothing crashes and the website still shows the alert.

## 5. The phone is the key (26.11.37)

- **Open in this PC's browser** (Settings → Sync, `app/js/account.js` `openHere`): the program asks for the same
  one-time `self` code as Add a device (`/api/sync` `add-device`, `pc_device_code_create`) and opens
  `{site}/join#c=CODE&go=1` in the default browser (`api/app/open-external`). The join page reads `go=1` and, for a
  `self` code only, presses Open by itself, so the browser opens as the person who connected the PC. The code works
  once and lasts 2 minutes, like a scanned one.
- **Open with your phone** is the main way in on Open your workspace (`join_request_create` / `join_request_status`),
  drawn as a flowchart (`components/connect-steps.tsx`) that ticks each step and lights up the workspace by name.
- The passkey button shows only where this browser saved a passkey (`localStorage` `fd-passkey` = `saved`); elsewhere
  "Use a passkey" is a quiet link under Other ways in.
- A device that joined by scanning has no email: **Keep your workspace safe** asks once to add one
  (`auth.updateUser({email})`, confirmed by email) and then offers a passkey. Each "Not now" is remembered per device.
- The PC setup card hides Connect this PC once `workspace_devices` lists a PC for the team.

## Owner steps (Supabase dashboard, project `slrsykiknlqlivlnpvrb`)

1. **SQL editor:** run `hosted/supabase/migrations/0021_passwordless.sql` (after 0020). Undo:
   `hosted/supabase/rollback/0021_passwordless_down.sql`.
2. **Edge Functions → Deploy a new function** named `device-sign-in`, with the code of
   `hosted/supabase/functions/device-sign-in/index.ts`, and **Verify JWT off** (the phone has no session yet; the code
   is the proof). With the Supabase CLI: `supabase functions deploy device-sign-in --no-verify-jwt`. Its service key is
   provided by Supabase; nothing to paste.
3. **Authentication → Sign In / Providers → Passkeys:** switch on, with the site `framedecks.com`.

Until step 2 is done, scanning an Add a device code says so (FD-CLD-07) and email still works.

Tests: `hosted/tests/supabase-0021.test.mjs` (PGlite), `tests/test_passwordless_2611_26.py`.

## Owner steps for 26.11.36 (passkey first, new-device alerts)

1. **Authentication → Sign In / Providers:** switch **off** Google, Azure (Microsoft) and Apple, and delete their
   client secrets. Keep **Passkeys** on (site `framedecks.com`) and **Email** on (one-time code; it is sent through Resend:
   Authentication → Emails → SMTP Settings, `smtp.resend.com`, sender `noreply@framedecks.com`).
2. **SQL editor:** run `hosted/supabase/migrations/0023_device_alerts.sql` (after 0022). Undo: remove the webhook
   (step 5), then run `hosted/supabase/rollback/0023_device_alerts_down.sql`.
3. **Deploy the function:** `supabase functions deploy device-alert --no-verify-jwt` (or Edge Functions → Deploy a new
   function named `device-alert` with the code of `hosted/supabase/functions/device-alert/index.ts`, Verify JWT off:
   the webhook sends no user token; the shared secret is the proof).
4. **Edge Functions → Secrets** (or `supabase secrets set NAME=value`):
   - `RESEND_API_KEY`: a Resend API key (resend.com → API Keys → Create, permission "Sending access",
     domain framedecks.com). The SMTP password in Supabase's SMTP settings is also a Resend API key;
   - optional `ALERT_FROM` (default `FrameDecks Support <noreply@framedecks.com>`, the sign-in emails' sender);
   - `ALERT_WEBHOOK_SECRET`: a long random value (for example `openssl rand -hex 32`);
   - optional `SITE_URL` (default `https://framedecks.com`).
5. **The webhook:** `hosted/supabase/setup/device_alert_webhook.sql` (SQL editor): turns on pg_net and adds a
   trigger that POSTs each new alert to the function with the header `x-alert-secret`, read from Supabase Vault
   (secret `device_alert_webhook_secret`, the same value as `ALERT_WEBHOOK_SECRET`; set with
   `select vault.create_secret('<value>', 'device_alert_webhook_secret');`). It does what Database → Webhooks
   would, with the secret kept out of the trigger's text.
6. **Test:** connect a PC (or Add a device on a phone). Devices shows "New: … connected" at once, and each owner and
   admin gets one email. Edge Functions → device-alert → Logs shows "not set" if a secret is missing.

Until steps 3 to 5 are done, alerts still show on Devices; only the emails wait.

Tests: `hosted/tests/supabase-0023.test.mjs` (PGlite).
