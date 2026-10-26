# Free for everyone: what the owner does, step by step

How FRAMEDECKS runs at **no cost**: the companion on Cloudflare Pages, Supabase Free kept awake and backed up,
sign-in without paid email, and free signing and downloads. It covers steps 1–5 of the free plan (owner's request,
26 October 2026). The background is in [hosting.md](../architecture/hosting.md).

**Who this is for:** the owner. Each part says what is already done in the code and exactly what to click.

| Part | What | Code | Owner |
|---|---|---|---|
| A | Companion as static files on Cloudflare Pages | Done | About 20 minutes |
| B | Database keep-alive and encrypted nightly backup | Done | About 15 minutes |
| C | Fewer database requests | Done | Nothing (next PC build) |
| D | Sign-in with Google / Microsoft, and free email | Done (buttons first) | About 40 minutes |
| E | Public repository, free signing, permanent downloads | Prepared | About 30 minutes, then SignPath's review |

Do them in order. Each part works on its own: you can stop after any part, and nothing breaks.

---

## Part A: the companion on Cloudflare Pages (free)

**Done in the code.** The companion now builds as plain files (`hosted/out/`), so any free static host can serve it:
- `next.config.ts` uses `output: "export"`;
- the PC's setup file `/api/sync-config` is written at build time by `hosted/scripts/write-sync-config.mjs`;
- the app manifest is a plain file.

Vercel keeps working with the same build in the meantime.

**What you do:**
1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up.
2. **Create the Pages project:**
   1. Go to **Workers & Pages → Create → Pages → Connect to Git**.
   2. Choose GitHub, allow access to `mshobin/FRAMEDECKS`, and select it.
3. **Build settings.** Enter exactly:

   | Setting | Value |
   |---|---|
   | Project name | `framedecks`. If it is taken, pick another; the address becomes `<name>.pages.dev` |
   | Production branch | `main` |
   | Framework preset | None |
   | Root directory | `hosted` |
   | Build command | `npm run build` |
   | Build output directory | `out` |

4. **Environment variables.** Under **Environment variables (advanced)**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://slrsykiknlqlivlnpvrb.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your publishable key: the same value as in Vercel, under Settings → Environment Variables |
   | `NODE_VERSION` | `22` |

5. **Save and Deploy.** When it finishes, open `https://<name>.pages.dev`. You should see the sign-in page.
   Also open `https://<name>.pages.dev/api/sync-config`; it should show `{"url":"https://slrsykiknlqlivlnpvrb…","anonKey":"…"}`.
6. **Let sign-in return to the new address.** In Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://<name>.pages.dev`
   - **Redirect URLs:** add `https://<name>.pages.dev/auth/callback`. Keep the Vercel one until step 8.
7. **Test.**
   - Sign in at the new address.
   - Open Services, Live, Members and Computers.
   - Send me the `<name>.pages.dev` address. I change the program's built-in companion address to it, and the next
     installer uses it.
   - PCs that are already linked keep working; they never need the companion's address again.
8. **Retire Vercel** once a week passes with no problems:
   - Vercel → the project → Settings → **Delete Project**.
   - Remove the Vercel address from the Supabase Redirect URLs.

## Part B: keep the database awake, and back it up every night (free)

A free Supabase project is paused after 7 days without requests, and it has no daily backups.
- **Keep-alive.** A GitHub Action asks the database a harmless question every 3 days.
- **Backup.** A second GitHub Action copies the database every night, **encrypts it with a passphrase only you
  know**, and keeps 30 days of copies with the run. Member phone numbers and birthdays are in the backup, so it is
  never stored unencrypted.

**What you do:**
1. **Copy the connection string.** In Supabase → **Project Settings → Database → Connection string**:
   - Choose **Session pooler**. GitHub's machines cannot use the "Direct connection".
   - Copy the URI and put your database password in it. You set this password when you created the project; if you
     forgot it, use **Reset database password** on the same page.
2. **Add GitHub secrets.** In GitHub → `mshobin/FRAMEDECKS` → **Settings → Secrets and variables → Actions → New
   repository secret**, add:

   | Secret | Value |
   |---|---|
   | `SUPABASE_URL` | `https://slrsykiknlqlivlnpvrb.supabase.co` |
   | `SUPABASE_ANON_KEY` | your publishable key |
   | `SUPABASE_DB_URL` | the Session pooler URI from step 1, password included |
   | `BACKUP_PASSPHRASE` | a long passphrase you invent. **Write it down somewhere safe: without it a backup cannot be opened** |

3. **Run each workflow once to test it.** Go to GitHub → **Actions**:
   - **Database keep-alive → Run workflow**. It should go green.
   - **Database backup → Run workflow**. It should go green and show a `framedecks-backup-…` file under Artifacts.
4. **Restoring.** You will hopefully never need it; the steps are in [database-backup.md](database-backup.md).

## Part C: fewer database requests

This keeps the shared free database light as more churches join.

**Done in the code.** A linked PC with "Allow control from the companion" turned on now asks for phone commands every
15 seconds while nobody is using the Live page, instead of every 5. That is a third of the requests. The first press
after a quiet spell can take up to 15 seconds; after that it is about one second, as before. The PC still reports
"Online" to the Live page every 30 seconds.

**Considered and left out on purpose:** shortening the 30-day Frame history and the 1-year audit log. Both are
small text tables, and shortening them would mean replacing the core sync function in the live database. That is
too much risk for almost no saving.

**What you do:** nothing except install the next PC build. There is no database script for this part.

## Part D: sign-in that never needs paid email

The emailed sign-in link uses Supabase's built-in mail, which allows only a few emails an hour. That is fine for you,
but not for many churches.
- **Google and Microsoft sign-in** are free and need no email.
- A **free email service** keeps the emailed link working for anyone without either account.

**D1. Google (free).**
1. Open https://console.cloud.google.com and create a project named "FRAMEDECKS".
2. Go to **APIs & Services → OAuth consent screen**:
   - user type **External**;
   - app name FRAMEDECKS, your email as support and developer contact;
   - scopes: just the default **email**, **profile** and **openid**;
   - **publish the app** (In production).
3. Go to **Credentials → Create credentials → OAuth client ID**:
   - type **Web application**;
   - **Authorized redirect URI**: `https://slrsykiknlqlivlnpvrb.supabase.co/auth/v1/callback`.
4. Copy the **Client ID** and **Client secret**.
5. In Supabase → **Authentication → Sign In / Providers → Google**: turn it on and paste both.
   **The secret goes only here, never in GitHub or the companion.**

**D2. Microsoft (free).**
1. In https://portal.azure.com, go to **Microsoft Entra ID → App registrations → New registration**:
   - name FRAMEDECKS;
   - supported accounts: **Accounts in any organizational directory and personal Microsoft accounts**;
   - redirect URI (Web): `https://slrsykiknlqlivlnpvrb.supabase.co/auth/v1/callback`.
2. Copy the **Application (client) ID**. Then **Certificates & secrets → New client secret**, and copy its
   **Value** (it is shown only once).
3. In Supabase → **Authentication → Sign In / Providers → Azure**:
   - turn it on and paste both;
   - Azure Tenant URL: `https://login.microsoftonline.com/common`.

**Done in the code.** Once the providers are on, the companion shows **Continue with Google** and **Continue with
Microsoft** by itself, at the top, with "or use your email" below them
([picture](../qa/2026-10-26-companion-sign-in-providers-first.png)).

**D3. Free email for the sign-in link.** Brevo's free plan sends 300 emails a day.
1. Create an account at https://www.brevo.com.
2. Go to **SMTP & API → SMTP** and generate an SMTP key. Note the server (`smtp-relay.brevo.com`), the port (`587`)
   and your login.
3. Add a sender address you own under **Senders**.
4. In Supabase → **Authentication → Emails → SMTP Settings**:
   - turn on custom SMTP;
   - enter the server, port, login and SMTP key;
   - sender name: FRAMEDECKS.
5. Test: sign out, then ask for an emailed link.

## Part E: public repository, free signing, permanent downloads

All of this is prepared. The full steps are in [code-signing.md](code-signing.md); in short:
1. **Check before making the repository public.**
   - Run GitHub's secret scanning: Settings → Code security → **Secret scanning**.
   - The repository has never held a secret: keys are only in Vercel, Cloudflare, Supabase, GitHub secrets and your
     PC.
   - Old branches from closed pull requests become public too; delete any you do not want shown.
2. **Make it public:** Settings → General → Danger Zone → **Change visibility → Public**. GitHub Actions minutes
   become free and unlimited for public repositories.
3. **Apply to SignPath Foundation** (https://signpath.org) with the repository URL and the Apache 2.0 licence.
   After approval:
   - add the `SIGNPATH_API_TOKEN` secret and the three `SIGNPATH_*` variables;
   - every installer is then signed by itself.
4. **Permanent downloads.**
   1. On GitHub, go to **Releases → Draft a new release**.
   2. Create a tag such as `v6.10.1` on `main` and publish.
   3. The installer build attaches the installer and its checksum to the release page by itself. That page is the
      one place churches download from, and it never expires.

---

## What stays free, and the limits

| Service | Free limit | FRAMEDECKS today |
|---|---|---|
| Cloudflare Pages | Unlimited static requests and bandwidth; 500 builds a month | A few builds a week |
| Supabase Free | 500 MB database, 50,000 monthly sign-ins, 2 projects | Text only; many churches fit |
| GitHub (public repo) | Unlimited Actions minutes, Releases | Builds, keep-alive and backup |
| Brevo | 300 emails a day | Sign-in links only |
| SignPath Foundation | Free for open source | Every release |

If the shared database ever fills up, a church can run its own free Supabase project. That option is in
[hosting.md](../architecture/hosting.md) and is not built yet.
