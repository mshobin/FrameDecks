# FrameDecks cloud API

The FrameDecks cloud: a Cloudflare Worker (TypeScript) with a D1 database. It will hold accounts, metadata sync,
pairing and the encrypted relay (docs/project/saas-pwa-architecture.md, §4 and §7).

This is **Phase 1**: the skeleton. It has one endpoint, `GET /v1/health`, the full database schema
(`migrations/0001_init.sql`), tests, and CI. The FrameDecks program does not talk to it yet; presenting never depends
on it.

Until a domain exists (decision D4), the API is served on its free Cloudflare address,
`https://framedecks-api-staging.<account>.workers.dev` (staging) and `https://framedecks-api.<account>.workers.dev`.

## Local development

```bash
cd cloud
npm ci
npx wrangler d1 migrations apply framedecks --local   # the schema in a local D1
npx wrangler dev                                       # http://localhost:8787/v1/health
```

`GET /v1/health` answers `{"ok": true, "service": "framedecks-api", "version": "0.1.0", "db": "ok"}`. Any other
address answers 404 with `{"error": {"code": "not_found", "message": "…"}}`.

## Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest in the Workers runtime (Miniflare), with the migrations applied to a local D1
```

The tests check the health endpoint and its headers, the 404 shape, every table and index of the schema, and that
the database refuses an unknown entity kind.

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
npx wrangler deploy --env staging
```
