# Release pipeline: from a version tag to every PC (7.0)

How a FrameDecks version reaches people. The repository is private; users never see GitHub. They download from
`framedecks.com/download`, and the installed program updates itself from FrameDecks' own servers.

```
Private GitHub repository
   │  push a version tag (v7.0) or create a GitHub Release with that tag
   ▼
GitHub Actions: "Build Windows installer"
   build    → tests, PyInstaller, Inno Setup, (signing), SHA-256
   release  → a private record on the repository's Releases page
   publish  → tools/make_release_manifest.py, upload to R2
   ▼
Cloudflare R2 bucket "framedecks-downloads"
   ├─ downloads.framedecks.com   (R2 custom domain: the installers)
   └─ api.framedecks.com         (Worker infra/update-api: the manifests)
   ▼
framedecks.com/download  (reads api.framedecks.com/releases/latest)
FrameDecks on each PC    (src/updater.py reads the same manifest)
```

**Who this is for:** the owner. The repository side is done; the one-time setup below takes about 30 minutes, all on
the Cloudflare free plan (R2: 10 GB storage and unlimited downloads at no cost; Workers: 100,000 requests a day).

## What is in the repository

| Part | File | What it does |
| --- | --- | --- |
| Manifest tool | `tools/make_release_manifest.py` | Lays out one release for the bucket and writes its manifest. Refuses release notes that name repository files. |
| Workflow job | `.github/workflows/build-windows.yml`, job `publish` | On a version tag: runs the tool, uploads to R2 with the AWS CLI (R2 speaks S3). Without the R2 settings it publishes nothing and says so. |
| Update service | `infra/update-api/` | A Cloudflare Worker on `api.framedecks.com`, read-only, serving the manifests from the bucket. |
| Download page | `hosted/src/app/download/`, `hosted/src/lib/releases.ts` | Detects the visitor's system, shows the newest version, its size, notes and checksum. |
| Updater | `src/updater.py`, `src/server.py` (`update_action`), `app/js/about.js` | Checks once a day, downloads, verifies, installs silently, puts the previous version back on failure. |

### What lands in the bucket

```
releases/<version>/FrameDecks-<version>-Setup.exe          never changes once uploaded (cached for a year)
releases/<version>/FrameDecks-<version>-Setup.exe.sha256
releases/<version>/manifest.json
releases/latest.json                                       the newest manifest (uploaded last)
releases/index.json                                        every release, newest first
latest/FrameDecks-Setup.exe                                always the newest installer
```

`api.framedecks.com/releases/latest` returns `releases/latest.json`:

```json
{
  "version": "7.0",
  "released": "2026-10-29",
  "downloadUrl": "https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe",
  "sha256": "…64 hex characters…",
  "size": 98765432,
  "releaseNotes": "## What's New\n…",
  "minimumOs": "Windows 10 (64-bit)",
  "signed": false,
  "platforms": { "windows": { "url": "…", "sha256": "…", "size": 98765432, "file": "FrameDecks-7.0-Setup.exe" } },
  "previous": { "version": "6.14", "url": "…", "sha256": "…", "size": 0 }
}
```

`platforms` leaves room for macOS and Linux: the updater and the download page read `platforms.windows` and fall back
to the top-level fields. Other routes: `/releases` (the index), `/releases/<version>` (one manifest), `/health`.

## One-time setup (owner)

### 1. R2 bucket and the downloads address

1. Cloudflare dashboard → **R2** → Create bucket → name `framedecks-downloads`, location Automatic.
2. Bucket → Settings → **Custom Domains** → Connect domain → `downloads.framedecks.com`. Cloudflare creates the DNS
   record and certificate. Leave the bucket's `r2.dev` public address **off**.
3. Bucket → Settings → **CORS policy**: not needed (the website reads the manifest from `api.framedecks.com`, which
   sends its own CORS header; the installers are plain downloads).
4. Optional cache rule (framedecks.com zone → Caching → Cache Rules): `http.host eq "downloads.framedecks.com" and
   starts_with(http.request.uri.path, "/releases/")` → Eligible for cache, respect origin. The workflow already sets
   `Cache-Control` on every file.

### 2. An API token for the workflow

R2 → **Manage R2 API Tokens** → Create API token:
- Permissions: **Object Read & Write**;
- Specify bucket: `framedecks-downloads` only;
- TTL: forever (or a year, with a reminder to renew).

It shows an **Access Key ID** and a **Secret Access Key** once. In GitHub → the repository → Settings → Secrets and
variables → Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `R2_ACCESS_KEY_ID` | the Access Key ID |
| Secret | `R2_SECRET_ACCESS_KEY` | the Secret Access Key |
| Variable | `R2_ACCOUNT_ID` | your Cloudflare account ID (R2 overview page, right-hand side) |
| Variable | `R2_BUCKET` | `framedecks-downloads` |
| Variable | `RELEASE_SIGNED` | `true` only once installers are code-signed (`code-signing.md`); otherwise leave it unset |

The token can only touch this bucket. Nothing else in Cloudflare is reachable from GitHub.

### 3. The update service

From a computer with Node.js, in the repository:

```bash
cd infra/update-api
npx wrangler login          # opens the browser once
npx wrangler deploy         # creates the Worker and the api.framedecks.com custom domain
```

Before deploying, remove the old **api (reserved)** redirect rule and the `api` AAAA record from the framedecks.com
zone (`cloudflare-domains.md`); the Worker's custom domain replaces them. Deploy again only when
`infra/update-api/src/index.js` changes.

### 4. Check

```bash
curl -s https://api.framedecks.com/health                 # {"ok":true,"latest":false} before the first release
curl -sI https://downloads.framedecks.com/releases/index.json | head -n 1
```

## Test it locally (before the first real tag)

`bash infra/update-api/local-test.sh` runs the whole pipeline on one computer, with nothing sent anywhere: the update
service under `wrangler dev` with a local bucket, two made-up releases (7.0, then 7.1) published by the workflow's own
upload step and the manifest tool, every route of the service, the program's updater (offered 7.1, a matching
download, a tampered copy refused, 7.0 fetched as the previous version) and the rollback below. It needs Node.js,
Python 3 and PyYAML, takes about a minute and ends with `release pipeline: ok`. Last run: 29 October 2026, passed.

## Releasing a version

1. On `main`, with CI green: the version is `APP_VERSION` in `src/server.py`, and `docs/releases/v<version>.md` exists
   and passes `python tools/make_release_notes.py --check`. Write the notes for users: they are shown on the download
   page and in the program, and the manifest tool refuses any line naming a repository path.
2. Tag it: `git tag v7.0 && git push origin v7.0`, or GitHub → Releases → Draft a new release → new tag `v7.0` on
   `main` → Publish. Either starts the workflow.
3. The workflow builds and tests on Windows, keeps a private copy on the repository's Releases page, then the `publish`
   job uploads the version's files, `index.json`, and finally `latest.json`. Until `latest.json` is replaced, nobody
   sees the new version, so a failed upload half-way changes nothing for users.
4. Within five minutes (the cache time) `framedecks.com/download` shows it, and each running program sees it at its
   next daily check (or at once from Settings → About → Check for updates).

Check after a release:

```bash
curl -s https://api.framedecks.com/releases/latest | python3 -m json.tool | head
curl -sL https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe.sha256
```

## How the program updates (integrity and safety)

- **Where from:** only the manifest at `api.framedecks.com/releases/latest`, and only installers under
  `https://downloads.framedecks.com/`. A manifest pointing anywhere else, over plain HTTP, with an odd version number,
  a size over 600 MB or a malformed checksum is ignored.
- **What is kept:** the download must match the manifest's size and SHA-256 exactly, or it is deleted. When the
  manifest says `"signed": true`, the installer's Authenticode signature must also be valid and issued to the publisher (Shobin Mathews).
- **When:** never while something is on screen (a question, verse or live item), unless the person confirms. They can
  also choose "install when I close FrameDecks".
- **How:** the program hands over to a small PowerShell script and closes. The script waits for it to exit, runs the
  installer silently (`/VERYSILENT /MERGETASKS=!vcam`, keeping the person's choices), and starts FrameDecks again.
- **If it fails:** the script runs the previous version's installer (kept under the data folder's
  `updates/installed/`), writes the outcome, and the next start says what happened, once.
- **Putting a version back by hand:** Settings → About → Reinstall the previous version, which uses the manifest's
  `previous` entry with the same checks.

The service stores nothing about the caller: no cookies, no identifiers. The program sends only its version and
system (`FrameDecks/7.0 (Windows)`) in the `User-Agent`.

## Rollback (owner)

A bad release is taken back by pointing `latest` at the previous version; files under `releases/<version>/` are
never changed or deleted.

```bash
# with the AWS CLI configured for R2 (the same keys as the workflow), endpoint https://<account>.r2.cloudflarestorage.com
aws s3 cp s3://framedecks-downloads/releases/6.14/manifest.json s3://framedecks-downloads/releases/latest.json \
  --endpoint-url "$R2" --content-type application/json --cache-control "public, max-age=300"
aws s3 cp s3://framedecks-downloads/releases/6.14/FrameDecks-6.14-Setup.exe s3://framedecks-downloads/latest/FrameDecks-Setup.exe \
  --endpoint-url "$R2" --cache-control "public, max-age=300"
```

Or in the dashboard: R2 → the bucket → copy the old `manifest.json` over `releases/latest.json`. PCs that already
installed the bad version are not downgraded automatically; release a fixed version with a higher number (the usual
route), or tell people to use Settings → About → Reinstall the previous version.

## Later

- **Ed25519-signed manifests (7.1):** sign `latest.json` in the workflow with a key kept as a GitHub secret, and ship
  the public key inside the program, so even a compromised bucket cannot point PCs at another installer. Today the
  checksum protects against corrupted or swapped files only together with HTTPS and the bucket's access control.
- **macOS and Linux:** add `platforms.macos` and `platforms.linux` entries and builds; the download page already
  detects the system and says "coming later".
- **Staged rollout:** a `rollout` percentage in the manifest that the updater compares with a random number kept on
  each PC.
