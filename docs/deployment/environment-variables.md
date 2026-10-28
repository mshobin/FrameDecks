# FrameDecks environment

FrameDecks desktop runs locally and does not require a `.env` file. The website needs its two public Supabase values
at build time (below).

## Desktop development

| Variable | Purpose |
| --- | --- |
| `KC_DATA_DIR` | Redirect runtime data to an isolated development folder. Use this when testing so real meeting and member data is untouched. |
| `KC_VCAM_DEMO=1` | Enable the built-in test camera for development and automated checks. |
| `KC_ESV_URL` | Override the scripture lookup URL in tests. |
| `FRAMEDECKS_COMPANION_URL` | Use another website for FrameDecks account linking (testing only). Unset, the program asks `https://framedecks.com`, then `https://framedecks.pages.dev`. |

Desktop settings and private user data are stored in the app's data folder,
normally `%APPDATA%\FRAMEDECKS` on Windows. See the
[configuration guide](../reference/configuration-guide.md) for file contents and
the [developer guide](../development/developer-guide.md) for local setup.

## Hosted companion

Set in Cloudflare Pages (Settings → Variables and secrets), never in source control:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project address (public). Also written to `/api/sync-config` for the program. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The Supabase public (anon) key; row-level security protects the data. |
| `NODE_VERSION` | `22`. |
| `NEXT_PUBLIC_SITE_URL` | Optional, for a test deployment only. Unset, canonical links, `robots.txt` and `sitemap.xml` use `https://framedecks.com` ([domains](cloudflare-domains.md)). |

See the [hosted companion guide](../../hosted/README.md) and [free hosting](free-hosting.md).
