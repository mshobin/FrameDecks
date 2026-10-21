# FrameDecks cloud API

The FrameDecks cloud: a Cloudflare Worker (TypeScript) with a D1 database. It will hold accounts, metadata sync,
pairing and the encrypted relay (docs/project/saas-pwa-architecture.md, §4 and §7).

This is **Phase 2**: sign-in and sync, plus the **Phase 3** relay and the **Phase 4** pairing of trusted devices. The
exact contract is `docs/architecture/cloud-api.md` and `docs/architecture/pairing-protocol.md`; the schema is
`migrations/0001_init.sql` plus `0002_auth.sql` and `0003_pairing.sql`. Presenting never depends on the cloud.

Until a domain exists (decision D4), the API is served on its free Cloudflare address,
`https://framedecks-api-staging.<account>.workers.dev` (staging) and `https://framedecks-api.<account>.workers.dev`.

## How sign-in works

- **Email code.** `POST /v1/auth/email/start {email}` sends a 6-digit code (valid 10 minutes, 5 tries; at most 5
  codes an hour per address and 20 per IP). `POST /v1/auth/email/verify {email, code, client}` returns the session.
  On the dev and test servers the start answer also carries `devCode`, and no email is sent.
- **Browser session (Google, Microsoft, Apple, or email).** The program calls `POST /v1/auth/session {client}`
  (201 `{id, url, pollToken, expiresAt}`), opens `url` in the system browser, and polls
  `POST /v1/auth/session/poll {pollToken}`: 202 while waiting, 200 with the session exactly once, 410 when expired.
  The page lists only the providers that are configured, plus the email code.
- **Tokens.** Access tokens are ES256 JWTs (10 minutes; public keys at `/v1/.well-known/jwks.json`). Refresh tokens
  rotate on every `POST /v1/auth/refresh`; using an old one again revokes the whole family. `POST /v1/auth/logout`.
- **Runtimes.** A `client` of `{type: "runtime", name, platform: "windows" | "macos" | "linux"}` registers the computer
  (send `runtimeId` again on a later sign-in to keep the same one). The first sign-in makes a workspace and its admin.

## Endpoints (all under `/v1`)

| | |
|---|---|
| `GET /health`, `GET /.well-known/jwks.json` | Status; public signing keys |
| `GET /auth/providers` | `{providers: [...], email: bool}` |
| `POST /auth/email/start`, `/auth/email/verify` | Email code |
| `POST /auth/session`, `/auth/session/poll`; `GET /auth/session/{id}` | Browser sign-in |
| `GET\|POST /auth/oidc/{provider}/callback` | Where Google, Microsoft and Apple send people back |
| `POST /auth/refresh`, `/auth/logout` | Tokens |
| `GET /me`, `GET /me/export`, `DELETE /me` | You, your data, deleting your account |
| `PATCH /runtimes/{id}`, `DELETE /runtimes/{id}` | Rename or revoke a computer (admin) |
| `GET /audit` | The workspace log (admin) |
| `GET /sync?since=&limit=`, `POST /sync` | Sync (cloud-api.md §4) |
| `POST /relay/{runtimeId}/ticket` | A one-socket relay ticket, `{ticket, expiresIn: 60}` (a member's user token, or the runtime itself) |
| `GET /relay/{runtimeId}?ticket=…` | The relay WebSocket (`Upgrade: websocket`); 401 `bad_ticket`, 426 without an upgrade |
| `GET /relay/runtimes` | The workspace's computers that are not revoked, `[{id, name, platform, online}]` (user token) |
| `POST /pairing` | A runtime starts pairing a phone: `{pcKey}` → 201 `{id, code, token, expiresAt}` (5 minutes; ends its other open one) |
| `POST /pairing/claim` | A member claims it: `{token}` or `{code}`, `device: {name, platform, browser}`, `deviceKey` → `{id, runtime, pcKey, expiresAt}` |
| `GET /pairing/{id}` | Its status; the runtime also sees the device and its key, the claimer collects its credential once after approval |
| `POST /pairing/{id}/approve`, `/reject` | The runtime answers: `{role}` (default `operator`) → `{device}`; reject → 204 |
| `GET /devices?runtime={id}` | That PC's paired devices (that runtime, or an admin user) |
| `PATCH /devices/{id}`, `DELETE /devices/{id}` | Change a device's role; revoke it and close its relay sockets at once (its runtime, an admin user; DELETE also the device itself) |

## The relay (Phase 3)

The phone reaches a PC away from its Wi-Fi through `RuntimeRelay`, one Durable Object per runtime (`src/relay.ts`,
binding `RELAY`, SQLite-backed). The message shapes are in `docs/architecture/relay-protocol.md`.

- Browsers cannot send `Authorization` on a WebSocket, so both sides first ask for a **ticket**: an ES256 JWT (the
  API's key, audience `framedecks-relay`) with `sub`, `role` (`runtime` or `device`), `rid`, `jti` and a 60-second
  expiry. Each ticket opens one socket: the relay keeps used `jti`s in its own storage until they expire. A runtime
  may only ask for its own ticket; a user must be a member of the runtime's workspace. 60 tickets a minute per caller.
- The upgrade re-checks that the runtime is not revoked, then hands the socket to the relay. One runtime socket at
  a time (a new one closes the old with `4000 replaced`); any number of device sockets.
- The relay uses the WebSocket Hibernation API, so idle sockets cost nothing, and `{"t":"ping"}` is answered with
  `{"t":"pong"}` without waking it. It never logs or stores what passes through. A frame over 1 MiB, malformed JSON,
  or a type the sender may not send is dropped, and the sender gets `{"t": "error", "code": "too_large" |
  "bad_json" | "unknown_type" | "bad_message", "message"}`.

## Pairing and trusted devices (Phase 4)

The contract is `docs/architecture/pairing-protocol.md` (§2–§4); the code is `src/pairing.ts` and `src/devices.ts`.

- **Starting.** `POST /pairing` (a runtime token) with the PC's X25519 public key gives a 6-digit code and a QR token
  (16 random bytes, base64url), valid 5 minutes; a new one ends the PC's other open request. The code is stored only
  as SHA-256 with a per-request salt (`code_salt`); the token as SHA-256 with a fixed domain salt, so it can be looked
  up. Hashes are compared in constant time. 30 starts an hour per runtime.
- **Claiming.** A user token (never a runtime's or a device's) of a member of the PC's workspace, with the phone's
  key. By token: the token names the request. By code: only the open, unexpired requests of the claimer's workspace
  are searched; each wrong code adds one to `attempts` of every open request there, and the fifth ends them
  (`400 code_wrong`, then `410 pair_expired`). Expired, used or unknown: `410 pair_expired`. 10 claims a minute per user,
  30 an hour per IP.
- **Answering.** `GET /pairing/{id}` shows `open | claimed | approved | rejected | expired` (open and claimed read as
  expired after `expiresAt`) to the runtime that started it (plus the device and `deviceKey` once claimed) and to the
  user who claimed it. Approve makes the `devices` row with its role; the claimer's next `GET` carries, exactly once,
  `credential: {device, runtime, access, accessExpiresAt, refresh}`. Audited: `pair_started`, `pair_claimed`,
  `pair_approved`, `pair_rejected`.
- **Device tokens.** Access tokens with `typ: "device"`, `sub` = device id, `rid`, `role`, `ws` (10 minutes); refresh
  tokens with subject `device` (180 days, renewed on every rotation) rotate and detect reuse like the others. Every
  request re-checks the device (and its PC and the person who paired it), so revoking takes effect at once. A device
  token may only refresh, get a ticket for its own PC (which sets `last_used_at`), and `DELETE /devices/{its id}`;
  everything else answers 403.
- **Devices.** `GET /devices?runtime=`, `PATCH /devices/{id} {role}` (audited `device_role_changed`), and
  `DELETE /devices/{id}` (audited `device_revoked`): it revokes the device and its refresh tokens and tells the
  PC's relay (`POST /revoke {"device"}` inside the Durable Object), which closes that device's sockets with
  `4001 revoked`. Deleting the account that paired a device, or revoking its PC, ends the device too.
- **The relay.** A device ticket carries `dev` and `devRole` (`role` stays the socket's side, `device`); the upgrade
  re-checks the device. The relay adds `"dev"` and `"role"` to every `req` from a device socket (`null` for a socket
  opened with a user ticket), overwriting whatever the sender put there, and passes sealed frames (`seal` instead of
  `method` / `path` / `headers` / `body`) on unread. A role change reaches open sockets at once.

## CORS

The PWA calls the API from another origin. `CORS_ORIGINS` in `wrangler.toml` is the allow-list (comma-separated;
`http://localhost:*` allows any port: the dev environment allows any `http://127.0.0.1:*` and `http://localhost:*`).
An allowed origin gets `Access-Control-Allow-Origin: <origin>` and `Vary: Origin` on every answer, and preflights
allow `GET, POST, PATCH, DELETE` with `Authorization, Content-Type` (cached 600 s). Credentials are never allowed
(tokens are bearer). Other origins get no CORS headers but are still answered: native clients send no Origin.

## Secrets

`wrangler.toml` sets `ENVIRONMENT` per environment (`dev`, `staging`, `production`). Everything else is a secret
(`npx wrangler secret put NAME --env staging`); for `wrangler dev`, put them in `cloud/.dev.vars` (never committed).

| Secret | What |
|---|---|
| `JWT_PRIVATE_KEY`, `JWT_KID` | Required. Make them with `node scripts/make-jwt-key.mjs` |
| `PUBLIC_ORIGIN` | The API's public origin, for redirect URIs (else the request's origin) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email codes. Without them staging and production answer 503 `email_not_configured` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft sign-in (the `common` tenant) |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Sign in with Apple (the .p8 key, PEM) |

Register this redirect URI with each provider: `<origin>/v1/auth/oidc/<google|microsoft|apple>/callback`.
A provider is offered only when all of its secrets are set.

## Local development

```bash
cd cloud
npm ci
node scripts/make-jwt-key.mjs > .dev.vars
npx wrangler d1 migrations apply framedecks --local   # the schema in a local D1
npx wrangler dev                                       # http://localhost:8787/v1/health
```

## Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest in the Workers runtime (Miniflare), with the migrations applied to a local D1
```

The tests cover health and the schema; email codes (wrong, expired, too many tries, rate limits); refresh rotation,
reuse and logout; `/me`, export and deleting an account; runtimes; sync (new, update, conflict, delete, paging and
what is refused); access-token expiry and tampering; the providers, with Google, Microsoft and Apple mocked; CORS;
the relay (tickets, expired and reused tickets, routing, online notices, replacement, ping, bad messages); and pairing
(start, claim by token and by code, wrong codes, expiry, who may claim and see, approve, the credential once, reject,
rate limits, audit), device tokens (refresh, reuse, what they may call, revocation) and paired devices on the relay
(their own ticket, dev and role on each request, sealed frames, `4001 revoked` on DELETE).
The test JWT key is generated fresh by `vitest.config.ts`.

`.npmrc` sets `legacy-peer-deps`: npm 10 fails while resolving Vitest's optional browser peers, and the peers this
project needs are listed in `package.json`.

## Deploying

CI (`.github/workflows/cloud.yml`) tests every change to `cloud/`. On a push to `main` it also deploys to **staging**,
but only when these repository secrets are set:

| Secret | What |
|---|---|
| `CLOUDFLARE_API_TOKEN` | An API token with Workers Scripts: Edit and D1: Edit |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account id |
| `D1_DATABASE_ID_STAGING` | The id of the `framedecks-staging` D1 database (`npx wrangler d1 create framedecks-staging`) |

No account id or database id is committed: `wrangler.toml` holds a placeholder id that CI replaces. Production
(`--env production`, database `framedecks`, secret `D1_DATABASE_ID_PRODUCTION`) is deployed the same way when the
service goes live.

By hand:

```bash
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
# put the real database_id into the [env.staging] block of wrangler.toml (do not commit it), then:
npx wrangler d1 migrations apply framedecks-staging --env staging --remote
# the secrets above, once: npx wrangler secret put JWT_PRIVATE_KEY --env staging (and the rest)
npx wrangler deploy --env staging
```

## Publishing the remote (Cloudflare Pages)

`.github/workflows/pages.yml` builds the remote with `tools/build_pwa.py` on every change and publishes it on `main`
to the Pages project `framedecks` when `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (secrets) and
`FRAMEDECKS_API` (a repository variable: the API's https address) are set. Put the Pages address in `CORS_ORIGINS`
(wrangler.toml, staging and production), and give it to the program as the remote's address (`FRAMEDECKS_REMOTE`, or
`remoteUrl` in kc-cloud.json) so Settings shows it.
