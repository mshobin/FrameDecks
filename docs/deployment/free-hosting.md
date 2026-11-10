# Free for everyone: what the owner does, step by step

How FrameDecks runs at **no cost**: the companion on Cloudflare Pages, Supabase Free kept awake and backed up,
sign-in without paid email, and free signing and downloads. It covers steps 1–5 of the free plan (owner's request,
26 October 2026). The background is in [hosting.md](../architecture/hosting.md).

**Who this is for:** the owner. Each part says what is already done in the code and exactly what to click.

| Part | What | Code | Owner |
|---|---|---|---|
| A | Companion as static files on Cloudflare Pages | Done | About 20 minutes |
| B | Database keep-alive and encrypted nightly backup | Done | About 15 minutes |
| C | Fewer database requests | Done | Nothing (next PC build) |
| D | Passkeys and free email (no Google or Microsoft since 26.11.36) | Done (passkey first) | About 15 minutes |
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
   1. Go to **Workers & Pages → Create**. At the bottom of that page, next to "Looking to deploy Pages?", click
      **Get started**, then **Import an existing Git repository**. Do not use the Worker setup page (Build command /
      Deploy command `npx wrangler deploy`): it has no Root directory or Build output directory, and the build fails.
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

> **Custom domain:** the production address is `https://framedecks.com`. After this part works on `pages.dev`, follow
> [cloudflare-domains.md](cloudflare-domains.md) (custom domain, redirects, Supabase Site URL, TLS, cache and WAF).

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
4. **Restoring.** You will hopefully never need it; the steps are in [database-backup.md](../operations/database-backup.md).

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

## Part D: opening a workspace without paid email

Since 26.11.36 workspaces open with a **passkey** (Face ID, a fingerprint, Windows Hello) or a **one-time email code**.
Google, Microsoft and Apple are not used: the owner did not want those companies in the workspace. Passkeys need no
email at all; the email code needs a free email service (D3), because Supabase's built-in mail allows only a few
emails an hour.

**D1. Switch off Google, Microsoft and Apple.** In Supabase → **Authentication → Sign In / Providers**, turn off
**Google**, **Azure** and **Apple** if they are on, and delete their client secrets. In Google Cloud and Microsoft
Entra you may delete the old "FrameDecks" app registrations.

**D2. Passkeys.** In Supabase → **Authentication → Sign In / Providers → Passkeys**: switch on, with the site
`framedecks.com`. Keep **Email** (one-time code) on. The steps for new-device emails are in
[passwordless.md](../architecture/passwordless.md).

**D3. Email for the sign-in codes (set up: Resend).** Supabase's built-in mail sends only a few emails an hour, so the
codes go through Resend (free plan: 3,000 emails a month, 100 a day).
1. At https://resend.com add the domain `framedecks.com` and its DNS records, then create an API key.
2. In Supabase → **Authentication → Emails → SMTP Settings**: custom SMTP on, host `smtp.resend.com`, port `465`,
   user `resend`, password the API key, sender `noreply@framedecks.com`, name FrameDecks Support.
3. Test: ask for an email code. New-device emails use the same Resend account ([passwordless.md](../architecture/passwordless.md)).

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

| Service | Free limit | FrameDecks today |
|---|---|---|
| Cloudflare Pages | Unlimited static requests and bandwidth; 500 builds a month | A few builds a week |
| Supabase Free | 500 MB database, 50,000 monthly sign-ins, 2 projects | Text only; many churches fit |
| GitHub (public repo) | Unlimited Actions minutes, Releases | Builds, keep-alive and backup |
| Resend | 3,000 emails a month (100 a day) | Email codes and new-device alerts |
| SignPath Foundation | Free for open source | Every release |

If the shared database ever fills up, a church can run its own free Supabase project. That option is in
[hosting.md](../architecture/hosting.md) and is not built yet.
