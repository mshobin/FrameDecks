# FrameDecks environment

FrameDecks desktop runs locally and does not require a `.env` file. The hosted
companion currently has no required environment variables.

## Desktop development

| Variable | Purpose |
| --- | --- |
| `KC_DATA_DIR` | Redirect runtime data to an isolated development folder. Use this when testing so real meeting and member data is untouched. |
| `KC_VCAM_DEMO=1` | Enable the built-in test camera for development and automated checks. |
| `KC_ESV_URL` | Override the scripture lookup URL in tests. |

Desktop settings and private user data are stored in the app's data folder,
normally `%APPDATA%\FRAMEDECKS` on Windows. See the
[configuration guide](reference/configuration-guide.md) for file contents and
the [developer guide](CONTRIBUTING.md) for local setup.

## Hosted companion

The hosted app currently needs no environment variables. When credentials are
introduced, keep them in the deployment provider's environment settings, never
in source control, client-side code, or committed `.env` files. See the
[hosted companion guide](../hosted/README.md).
