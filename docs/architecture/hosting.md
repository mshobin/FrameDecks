# Hosting: the long-term recommendation (M-D5)

Where the FRAMEDECKS companion and its database should live for the long term, at the lowest cost, under terms that
allow a ministry to use them. This is the answer to decision M-D5 in the [migration plan](../migration-plan.md).
Checked 25 October 2026.

**Who this is for:** the owner, who holds the Vercel and Supabase accounts and makes any move.

## Summary

| Part | Now | Recommended long term | Cost |
|---|---|---|---|
| Companion website (`hosted/`) | Vercel Hobby | **Cloudflare**, as static files (a static export of the companion) | $0 |
| Database and sign-in | Supabase Free | **Supabase**: Free while it is a pilot; **Pro** once churches depend on it | $0, then $25 a month |
| Desktop downloads | GitHub Actions artifacts | **GitHub Releases** on the public repository (M-D1), signed by SignPath | $0 |

When to move:
- Stay on Vercel while FRAMEDECKS is the owner's own pilot.
- Move the companion **before** the repository goes public with a donation link, or before a second church uses it.
- Upgrade Supabase when a missed Sunday would matter to someone other than the owner.

## Why

### The companion: move from Vercel Hobby to Cloudflare

- **Vercel's terms.** Vercel's Hobby plan is for "non-commercial, personal use only" ([Hobby plan](https://vercel.com/docs/plans/hobby)).
  - Its fair-use guidelines count asking for donations as commercial use ([fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)).
  - Nonprofits have asked whether they qualify, and there is no official yes ([forum](https://community.vercel.com/t/hobby-plan-eligibility-for-a-non-profit-badminton-club/51018)).
  - A donation-friendly ministry product therefore needs Vercel Pro ($20 a month per member) or another host.
- **The companion barely needs a server.**
  - Every page runs in the browser and talks to Supabase directly.
  - The only server code is `src/app/api/sync-config/route.ts`, which returns the public Supabase address and
    publishable key. That can be a file written at build time.
  - So the companion can be built as plain static files, which any static host can serve.
- **Cloudflare serves static files on its free plan**, on a `*.pages.dev` or `*.workers.dev` address or the
  church's own domain.
  - Static files are not counted against the free plan's 100,000 requests a day.
  - Confirm the current terms in the dashboard when moving.
- **Not recommended:**
  - Running Next.js as a server on Cloudflare (OpenNext): its support for Next.js 16 is not confirmed ([OpenNext](https://opennext.js.org/cloudflare)),
    and the companion does not need a server.
  - GitHub Pages: its terms are aimed at personal and project pages, not a service.

### The database: stay on Supabase

- **Supabase Free is enough while FRAMEDECKS is a pilot:** 500 MB of database, 50,000 monthly sign-ins.
- **One catch: a free project is paused after 7 days without database requests.**
  - It keeps its data, but sign-in and sync stop until it is restored in the dashboard.
  - A linked PC syncs every minute while FRAMEDECKS runs, so normal use keeps the project awake.
  - A quiet fortnight would not keep it awake.
  - Presenting never stops (the PC works offline), but the companion would be dark.
- **Supabase Pro ($25 a month) removes the pause and adds daily backups.**
  - Upgrade when other churches rely on it.
  - The money can come from donations once the project is open source (M-D1).
- **Self-hosting Supabase** is possible: it is open source, and FRAMEDECKS uses only Postgres, Auth and the REST API.
  It moves backups, updates and security onto the ministry, so keep it as the exit route, not the plan.
- **Act on Supabase's 30 October 2026 change.** Tables created from that date get no API access without an explicit
  grant ([Supabase discussion](https://github.com/orgs/supabase/discussions/45329)).
  - `0007_data_api_grants.sql` covers every FRAMEDECKS table.
  - Every new migration grants its own tables, and the tests check that.

## What moving the companion involves (later, one PR)

1. **Static export.**
   - Build `hosted/` as static files (`output: "export"`).
   - Replace the `sync-config` route with a JSON file generated at build time from the two public variables.
   - Check each page in a browser against stand-ins, as now.
2. **Cloudflare.**
   - The owner connects the repository in Cloudflare.
   - Set the root directory to `hosted`, the build command, and the output folder.
   - Add the same two `NEXT_PUBLIC_` variables.
3. **Address.**
   - Either keep `framedecks.vercel.app` until the new address works, or use a church domain.
   - Add the new address to Supabase → Authentication → URL configuration (the sign-in links and OAuth redirects).
4. **PCs.** Point the PCs at the new address (`COMPANION_URL` in `cloud_sync.py`) in the next release. Older PCs keep
   working as long as the old address answers.

Nothing in the desktop program or the database changes.
