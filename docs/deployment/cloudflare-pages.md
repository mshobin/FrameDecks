# The website on Cloudflare Pages (Vercel retired)

**framedecks.com runs on Cloudflare and Supabase only.** This page is how the website is built, deployed, checked and,
if needed, rolled back. Domains, redirects and the Cloudflare zone settings are in
[cloudflare-domains.md](cloudflare-domains.md); the update service and downloads are in
[release-pipeline.md](release-pipeline.md).

**Who this is for:** the owner, who holds the Cloudflare, Supabase and GitHub accounts.

## How it fits together

| Part | Where | What it is |
| --- | --- | --- |
| Website `framedecks.com` | Cloudflare Pages, project `framedecks` | Plain static files built from `hosted/` (`next build` with `output: "export"` → `hosted/out`) |
| Fallback `framedecks.pages.dev` | Cloudflare Pages | The same files, `X-Robots-Tag: noindex`; PCs from 6.12 and earlier link through it |
| Update service `api.framedecks.com` | Cloudflare Worker `framedecks-update-api` (`infra/update-api`) | Release manifests for the program |
| Installers `downloads.framedecks.com` | Cloudflare R2 bucket `framedecks-downloads` | Signed installers |
| Database, sign-in, members' phones | Supabase `https://<project>.supabase.co` | Called straight from the browser and the program; row-level security protects the data |
| Builds, checks, deploys | GitHub Actions | `.github/workflows/hosted.yml` (website), `build-windows.yml` (program) |

The website has **no server code**: no Pages Functions, no API routes, no middleware. So it needs **no Workers, KV, D1,
R2, Durable Objects or Queues** of its own. The one "API" a PC asks for, `/api/sync-config`, is a JSON file written at
build time from the two public Supabase values. Everything a signed-in person does goes from their browser to Supabase.

What Cloudflare Pages does for the site, all from `hosted/public/_headers` and the built files:
- security headers on every page (HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy) and each page's
  own Content-Security-Policy (`scripts/write-csp.mjs`);
- `/auth/*` and `/sync` never cached; build files (`/_next/static/*`) cached for a year; `/api/sync-config` served as JSON;
- clean addresses: `/help.html` and `/help/` answer with a redirect to `/help`; a missing page is the site's `404.html`.

## How a change reaches framedecks.com

1. A push to `main` that touches `hosted/` (or `infra/site/`) starts **Hosted companion checks**.
2. Job **checks**: lint, type-check, every test, a production build, the size budget and `verify-site.mjs` (every page,
   header rule and file is in the build; one rule per path; `/sync` and `/auth/*` no-store).
3. Job **deploy** (only `main`, only after checks pass, one at a time):
   - builds again with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` taken from the repository
     secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the same two public values the Windows build already uses);
   - `verify-site.mjs --cloud` refuses a build whose `/api/sync-config` has no cloud address;
   - `npx wrangler@4.156.2 pages deploy --branch main` from `infra/site/` (`wrangler.toml`: project `framedecks`, output
     `../../hosted/out`);
   - `smoke-site.mjs` checks the new deployment's own address, then `https://framedecks.com`: 14 pages, their headers,
     the setup file, the cache rules and a real 404.
4. Without the Cloudflare secrets the deploy job says so and skips; nothing turns red.

You can run the same outside check at any time:

```
node hosted/scripts/smoke-site.mjs https://framedecks.com
node hosted/scripts/smoke-site.mjs https://framedecks.pages.dev --preview
```

## Settings, all in one table

| Where | Name | Value | Secret? |
| --- | --- | --- | --- |
| GitHub → Settings → Secrets and variables → Actions | `CLOUDFLARE_API_TOKEN` | API token with **Account → Cloudflare Pages → Edit** only | Yes |
| same | `CLOUDFLARE_ACCOUNT_ID` | optional: without it the repository variable `R2_ACCOUNT_ID` (already set for releases) is used | Not really |
| same (already there) | `SUPABASE_URL` | `https://<project>.supabase.co` | Public value |
| same (already there) | `SUPABASE_ANON_KEY` | the publishable (anon) key, never `service_role` | Public value |
| Supabase → Authentication → URL Configuration | Site URL | `https://framedecks.com` | |
| same | Redirect URLs | `https://framedecks.com/auth/callback`, `http://localhost:3000/auth/callback` (and the pages.dev one until it redirects) | |
| Cloudflare Pages → `framedecks` → Settings → Builds | Automatic deployments | **Off** once GitHub Actions has deployed once (below) | |

Local development: `hosted/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (template:
`hosted/.env.example`). Never put a `service_role` key anywhere in `hosted/`.

## Owner steps (about 20 minutes)

Do them in this order. Until step 4 the site keeps being built by Cloudflare's own Git connection exactly as today,
so nothing can break while you work.

1. **Make the API token.** Cloudflare → My Profile → API Tokens → Create Token → **Create Custom Token**:
   - Name: `GitHub Actions – framedecks Pages`.
   - Permissions: **Account** · **Cloudflare Pages** · **Edit**. Nothing else.
   - Account Resources: Include · your account. Client IP filtering: leave empty. TTL: none (or a year, then renew).
   - Create, and copy the token (it is shown once).
2. **Add two repository secrets.** GitHub → the repository → Settings → Secrets and variables → Actions → New
   repository secret:
   - `CLOUDFLARE_API_TOKEN` = the token from step 1;
   - `CLOUDFLARE_ACCOUNT_ID` is optional: the repository variable `R2_ACCOUNT_ID`, already set for releases, is used
     when it is missing.
   - Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are already in the list (the keep-alive and Windows build use them).
3. **Run the first deploy.** GitHub → Actions → **Hosted companion checks** → Run workflow → `main`. Wait for both jobs.
   The deploy job's last step must say `smoke-site: https://framedecks.com answers every page…`.
   In Cloudflare → Workers & Pages → `framedecks` → Deployments, the newest one now says *Direct Upload* (or *Wrangler*).
4. **Switch off Cloudflare's own builds.** Workers & Pages → `framedecks` → Settings → Builds (Build configuration /
   Branch control) → turn **Automatic deployments off** for production and previews (or *Disconnect* the Git
   repository). From now on only GitHub Actions deploys, after the checks pass. Keep the project, its custom domains
   and its deployment history.
5. **Retire Vercel.**
   - Vercel → the `framedecks` project → Settings → **Delete Project**.
   - Vercel → Account Settings → Integrations / Git: remove the GitHub app's access to this repository (GitHub →
     Settings → Applications → Installed GitHub Apps → Vercel → Configure → remove the repository, or Uninstall).
   - Supabase → Authentication → URL Configuration → remove every `vercel.app` Redirect URL.
   - GitHub → the repository → Settings → Environments / Deployments: delete any `Production – framedecks` or
     `Preview` environments Vercel created (optional, tidy only).
   - If `framedecks.vercel.app` was ever given to anyone, it simply stops answering; PCs never used it.
6. **Check** (production checklist below).

## Production deployment checklist

- [ ] `node hosted/scripts/smoke-site.mjs https://framedecks.com` says it answers every page.
- [ ] `https://framedecks.com/api/sync-config` shows `{"url":"https://<project>.supabase.co","anonKey":"…"}`.
- [ ] Sign in at framedecks.com with a passkey, and with an email code (Supabase sends it; the link returns to
      `/auth/callback`).
- [ ] Open Services, Plan, Live, Members, Computers: each loads your workspace.
- [ ] On a phone, open framedecks.com/follow with a members' phones code from the PC: it follows the screen.
- [ ] On the PC, Settings → Sync shows *Connected*; a change syncs both ways.
- [ ] `curl -sI https://framedecks.com/sync` shows `Cache-Control: no-store`.
- [ ] `https://framedecks.pages.dev` answers with `X-Robots-Tag: noindex` (or redirects to framedecks.com after step 7
      of cloudflare-domains.md).
- [ ] Cloudflare → `framedecks` → Deployments: the newest is from GitHub Actions; automatic Git builds are off.
- [ ] Vercel project deleted; no `vercel.app` Redirect URL in Supabase.

## Rollback

Every deployment stays in Cloudflare, so going back takes a minute and needs no code.

| Problem | What to do |
| --- | --- |
| The newest deploy is broken | Cloudflare → Workers & Pages → `framedecks` → Deployments → the last good one → ⋯ → **Rollback to this deployment**. framedecks.com serves it at once. Then fix and push. |
| The GitHub deploy cannot run (token expired, Actions down) | Make a new token (step 1) and update the secret; or from your PC: `cd hosted && npm ci && npm run build`, then `cd ../infra/site && npx wrangler@4.156.2 login && npx wrangler@4.156.2 pages deploy --branch main`. |
| You want Cloudflare to build again by itself | Pages → `framedecks` → Settings → Builds → turn automatic deployments back on (root `hosted`, build `npm run build`, output `out`, variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NODE_VERSION=22`). |
| Something only Vercel did | Nothing: the site never depended on Vercel. The same static build ran on both, and Cloudflare already served framedecks.com. |

The program never needs the website to present. If the website were down, meetings, the vCam, the phone remote and
members' phones (which talk to Supabase) keep working; only signing in to the website and linking a new PC wait.

## Why not something else

- **Pages Functions or Next.js on Workers (OpenNext):** the site has no server code, so they would only add cost and
  moving parts. Add them only if a future feature truly needs a server.
- **Cloudflare's own Git builds** (what ran before): they work, but build without the checks, can wait in a queue, and
  keep the build settings in the dashboard. GitHub Actions deploys only a checked build, with settings in the
  repository.
- **Vercel:** its Hobby plan is for non-commercial use only, which rules out donations or paid plans
  ([hosting.md](../architecture/hosting.md)).
