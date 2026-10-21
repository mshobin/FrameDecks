# FrameDecks cloud API

The FrameDecks cloud: a Cloudflare Worker (TypeScript) with a D1 database. It will hold accounts, metadata sync,
pairing and the encrypted relay (docs/project/saas-pwa-architecture.md, §4 and §7).

This is **Phase 2**: sign-in and sync. The exact contract is `docs/architecture/cloud-api.md`; the schema is
`migrations/0001_init.sql` plus `migrations/0002_auth.sql`. Presenting never depends on the cloud.

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
what is refused); access-token expiry and tampering; and the providers, with Google, Microsoft and Apple mocked.
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
