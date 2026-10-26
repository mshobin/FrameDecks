# FRAMEDECKS hosted companion

This is the separate, online-first FRAMEDECKS web companion. It does not connect
to the desktop app's local HTTP server. Sign-in (Supabase Auth: an emailed link,
plus Google or Microsoft when they are switched on in Supabase) is implemented;
cloud data and device pairing are not, so the overview is still a foundation
preview and must not be treated as a live service dashboard.

## Sign-in

- `/sign-in` sends a sign-in link by email (`signInWithOtp`) and shows a Google or
  Microsoft button only for providers the Supabase project reports as enabled
  (`/auth/v1/settings`).
- Links and provider sign-ins return to `/auth/callback`, where the browser client
  finishes the PKCE exchange and goes to `/`. The service worker never handles
  `/auth/`.
- The session is kept by `@supabase/supabase-js` in the browser. The top bar shows
  **Sign in**, or the signed-in email with **Sign out**.
- Signed in, the overview shows **Your profile** (display name, saved with an
  upsert on `profiles`) and **Your workspaces** (the person's memberships with
  their organization and role) with a form to create one. The database trigger
  makes the creator the owner; the browser never chooses a role. Row-level
  security (migration `0001`) decides every read and write.
- **Members and invitations** (migration `0002_invitations.sql`): each workspace
  has a **Members** list (names and emails, via `workspace_members()`). Owners and
  admins invite by email as Member or Admin, cancel invitations and remove
  members; anyone but the owner can leave. An invitation always waits until the
  invitee signs in with that email and presses **Join** (`my_invitations()`,
  `accept_invitation()`), so an admin never learns whether an address already
  has an account. Until `0002` has been run in the Supabase SQL editor, these
  controls stay hidden and the rest works as before.
- **Services, Members, Computers** (`/services`, `/members`, `/computers`): the plan
  synced from a linked PC (owners and admins can edit names, scripts, questions,
  scripture and the order of Frames, saved with `sync_push`; everyone else views;
  each Frame's History of the last 30 days from `entity_history`, with Restore and
  deleted Frames brought back for owners and admins),
  its member list (owners and admins), and
  linking PCs with the code they show. They read with `sync_pull` and
  `computers`, and link with `computer_link_approve` / `computer_revoke`.
- **Live** (`/live`): run a service from a phone. Shows the linked PC, whether it
  is online, the Frame on screen, Previous / Next, Hide all, Black screen, show or
  hide the question and scripture, Go Live on any Frame and the Teleprompter
  script. Sends with `remote_send`, reads `remote_computers` every 2 seconds. For
  owners, admins and members given "Can run services" (a checkbox in the member
  list); the PC must have "Allow control from the companion" on.
- **Database scripts** in `supabase/migrations/` are run in order in the Supabase
  SQL editor: `0001` (workspaces), `0002` (invitations), `0003` (sync of service
  plans: records, linked computers), `0004` (remote control: commands from
  phones, the PC's status, the "can run services" permission), `0005` (the
  Live page's list of PCs with their status), `0006` (the audit log of people
  and computers, written by triggers, read by owners and admins), `0007`
  (explicit API grants, needed since Supabase's 30 October 2026 change), `0008`
  (member groups, companion only). Undo scripts
  live in `supabase/rollback/` (never run by `npm test`'s migration loader).
  `npm test` applies all of them to an in-memory Postgres (PGlite) and checks the
  access rules.
- Without the two variables below, the site still builds and works; the sign-in
  page says sign-in is not set up and the top bar shows no account button.

## Local development

From the `hosted/` directory, install the locked dependencies and start Next.js:

```powershell
npm ci
npm run dev
```

The development server is available at `http://localhost:3000`. This local
development URL is not a runtime integration with FRAMEDECKS desktop.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The boundary test prevents explicit local HTTP addresses from being added to
hosted source. It does not replace security review or browser/device testing.

## Vercel deployment

Use `main` as the Production Branch and set the Root Directory to `hosted`.
The Root Directory must not be the repository root: Next.js gives a root
`app/` folder priority over `src/app`, and the desktop app's `app/` folder
would hide this app's routes. Choose the Next.js framework preset and leave
the build and output settings at their defaults.
Sign-in needs two variables (Project → Settings → Environment Variables, for
Production and Preview, then redeploy; they are read at build time):
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon or
publishable key; never a `service_role` or secret key). In Supabase, under
Authentication → URL Configuration, set the Site URL to
`https://framedecks.vercel.app` and allow `https://framedecks.vercel.app/**`
(add the preview URL pattern too if previews should sign in).
The app uses the Vercel-provided HTTPS URL; no custom domain or Cloudflare
configuration is required.
