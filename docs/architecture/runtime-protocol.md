# FrameDecks runtime protocol

The HTTP interface of a FrameDecks runtime (the Windows program, `server.py`), as it is today. This is the contract
that the remote (`app/remote.html`), the Flutter app (`framedecks_app/lib/engine/backend.dart`) and, from Phase 3,
the cloud relay all follow. The relay changes how a request travels, never what it says
([saas-pwa-architecture.md §12](../project/saas-pwa-architecture.md#12-remote-control-architecture)).

Status: describes version 6.9 with Decks (PR #12). Anything not listed here is not part of the contract.

---

## 1. Where it listens and who may call it

| Listener | Address | Who |
|---|---|---|
| Main | `127.0.0.1:8750` (the first free port of 8750–8760) | This PC: the Studio, the overlay pages, the Flutter desktop app |
| Phone remote | The PC's private network addresses, same port, only while the remote is on (`--remote` or Settings → Phone & iPad Remote) | Phones and tablets on the same Wi-Fi |

- **This PC** (a loopback address) may call everything.
- **Another device** may call only:
  - `REMOTE_PUBLIC` (the remote's own files and `api/remote-login`);
  - `REMOTE_SIGNED_IN`, only with a valid `kc_remote` cookie. Everything else answers `403`.
- **Host check:** the `Host` header must be `localhost:<port>` or `127.0.0.1:<port>`, or (while the phone remote is on)
  an IPv4 address with the port. Anything else is refused (`403`). A web page can't reach the runtime through a
  domain name pointed at it (DNS rebinding).

| List | Paths |
|---|---|
| `REMOTE_PUBLIC` | `/remote.html`, `/css/remote.css`, `/js/remote.js`, `/js/store.js`, `/js/brand.js`, `/js/teleprompter.js`, `/css/teleprompter.css`, `/remote-manifest.json`, `/icons/remote-*.png`, `/img/kc-emblem.webp`, `/fonts/*`, `POST /api/remote-login` |
| `REMOTE_SIGNED_IN` | `GET/POST /api/state`, `GET /api/rev`, `POST /api/remote-logout`, `GET/POST /api/remote/studio`, `GET /api/brand/logo`, `GET /api/remote/live.jpg`, `/js/overlay.js`, `/css/overlay.css`, `/stage.html`, `/focus-verse.html`, `/discussion-question.html`, `/birthday.html` |

## 2. Signing in a phone

### `POST /api/remote-login`

Request `{"pin": "123456"}`. The PIN is the 6 digits shown in Settings → Phone & iPad Remote.

| Answer | Meaning |
|---|---|
| `200 {"ok": true}` + `Set-Cookie: kc_remote=<token>; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict` | Signed in for 30 days |
| `401 {"error": "wrong pin"}` | Wrong PIN. After 5 wrong tries from one address, that address waits 60 seconds. |
| `429 {"error": "locked", "wait": <seconds>}` | Still waiting |

### `POST /api/remote-logout`

Ends the session and clears the cookie: `200 {"ok": true}`.

## 3. The state document

One JSON document holds everything a meeting needs. The runtime saves it as `kc-saved-content.json`; `store.js`
(`normalize`) and `framedecks_app/lib/engine/normalize.dart` define every field and its defaults identically
(parity-tested). The parts every client relies on:

| Field | What it is |
|---|---|
| `rev` | The document's revision. The runtime adds 1 on every save. |
| `scenes` | The Frames, in running order (`tpl: true` = a template, not in the running order). Each Frame: `id`, `name`, `group`, `fav`, `tpl`, `tx`, `auto`, `notes` (Teleprompter script), **`decks`** and `layers` (its Content). |
| `scenes[].decks` | **FrameDecks:** `[{id, name}]`, at least one. A Frame saved before Decks has none in the file and reads as `[{"id": "d1", "name": "Deck 1"}]`. |
| `scenes[].layers[]` | One Content: `id`, `kind`, `name`, **`deck`** (its Deck's id; missing or unknown = the first Deck), `visible`, `locked`, `opacity`, `c` (its settings and lists). |
| `live` | What is on screen: `scene` (the live Frame), **`deck`** (its Deck on screen), `seq`, `at`, `tx`, `txMs`, `auto`, `blackout`, `emergency`, `freeze`, `ink`, `message`, `on` (text Content shown), `cd` (countdown starts). |
| `question`, `verse`, `birthday` | The three cards (text, visibility, look, the item shown). |
| `library` | The shared question and scripture lists (large; see `librev`). |
| `brand`, `meeting`, `profile`, `layout` | Branding, meeting details, the meeting profile, the card layout |

**One Deck at a time:** only the Content of `live.deck` in the live Frame is on screen. Next / Previous move through the
live Frame's Decks, then to the next (or previous) Frame (`Scenes.step` in `store.js`).

## 4. Reading and changing the state

### `GET /api/state[?since=<rev>&wait=<s>&librev=<n>]`

- **No `since`:** the document now.
- **With `since`:** a long-poll. The runtime answers as soon as `rev` differs from `since`, or after `wait` seconds
  (1–25, default 25).
- **With `librev`:** if it matches the runtime's library revision, the answer leaves `library` out and says
  `"libraryOmitted": true`. The client keeps its own copy.

Every answer carries `"libraryRev": <n>`.

### `GET /api/rev`

`{"rev": <n>}`: a cheap check that the document has not changed.

### `POST /api/state`

The whole new document, plus:

| Field | Meaning |
|---|---|
| `baseRev` | The `rev` this change was made on. If the document has moved on since, the answer is **`409` with the latest document**: the client makes its change again on top of it (`Store.update` retries up to 5 times). |
| `keepLibrary: true` | "I did not change the library": the runtime keeps its own (only valid with `baseRev`). Saves sending a large library on every tap. |

`200` answers with the saved document (its new `rev`). Before saving, clients give every Content a valid Deck
(`Scenes.fixDecks`).

## 5. The remote's Studio and live picture

| Call | What it does |
|---|---|
| `GET /api/remote/studio` | `{available, scenes, activeScene, presentation}`. `presentation` is `{name, page, pages}` for a Studio slide deck, a captured window, or a PowerPoint slide show running on this PC. |
| `POST /api/remote/studio` | An action: switch Studio scene, or next / previous slide. Answers `{"ok": true, …, "studio": <as GET>}`, or `400 {"error": "<words>"}`. |
| `GET /api/remote/live.jpg` | The FrameCast camera's current picture (JPEG, ETag; `304` when unchanged; `204` while the camera is off or starting). The phone's Annotate pad draws on it. |
| `GET /api/brand/logo` | The leader's logo (PNG), for the remote's header |

## 6. This PC only

These answer `403` to any other device. They are listed so nothing depends on them by accident.

| Area | Paths |
|---|---|
| Program | `GET /api/app/ping` → `{"app": "FrameDecks", "version", "installedApp"}` (used by the Flutter desktop app to recognise the program), `GET /api/app/info`, `POST /api/app/<action>` |
| Phone remote setup | `GET /api/remote-info` (PIN, addresses, devices), `GET /api/remote-selftest`, `POST /api/remote-reset` |
| Members | `GET/POST /api/private` (members, birthdays, email: never on the remote's list) |
| Camera and Studio | `/api/vcam/*` (status, settings, studio, previews, recordings, install), `GET /api/present.mjpg` |
| Other | `GET /api/diagnostics`, `GET/POST /api/presence`, `/api/scripture/*`, `POST /api/meeting/workbook`, `POST /api/brand/logo`, `POST /api/vcam/upload` |

## 7. Rules for every client

1. **Change the document through `POST /api/state` with `baseRev`, and redo the change on `409`.** Never assume a
   change was applied without its `200`.
2. **Normalize what you receive** (`normalize` in `store.js` or Dart) before using it. Older files are converted on
   read, never on the runtime's disk.
3. **Do not send `libraryRev` or `libraryOmitted` back** (the runtime removes them).
4. **What is live belongs to the runtime.** Clients change it only through the same document rules (`Scenes.take`,
   `Scenes.step`), so the program, the overlays and the FrameCast camera all follow one state.

## 8. Over the relay (Phase 3)

The relay carries these same requests, unchanged, as `{id, method, path, query, headers, body}` messages, and the
runtime answers them through its own server. So a remote behaves identically on Wi-Fi and through the cloud.

- Only `REMOTE_PUBLIC` and `REMOTE_SIGNED_IN` paths are ever relayed.
- A device paired through the cloud (§6 of the architecture) needs no PIN or cookie: the relay vouches for it with
  its role.
- On the phone, `KCTransport.fetch` (top of `app/js/store.js`) chooses the path: the direct `fetch` today, the relay
  from Phase 3 (`KCTransport.use`).
- Pictures and pages the remote shows as `<img>` or `<iframe>` (the live stage, the logo) are not requests through
  `fetch`; the relay transport will load them through `KCTransport.fetch` as object URLs.
