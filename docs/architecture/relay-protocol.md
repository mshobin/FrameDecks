# FrameDecks relay (Phase 3: the remote from anywhere)

How the installable remote (the PWA) controls a PC away from its Wi-Fi. The design and its reasons are in
[saas-pwa-architecture.md](../project/saas-pwa-architecture.md) §2, §4 and §12; this page is the exact shape. Pairing,
roles and end-to-end sealing of the tunnel come in Phase 4 (§6, §15).

```
phone (PWA on the cloud address)  ──WSS──▶  RuntimeRelay (one Durable Object per PC)  ◀──WSS──  the PC (connects outward)
        remote.html, unchanged                  passes messages, stores nothing                replays each request on
        + relay transport (store.js)                                                          a listener that treats it
                                                                                              as a phone on the Wi-Fi
```

## 1. Who may connect

| Side | Needs | Notes |
|---|---|---|
| The PC (runtime) | A runtime access token for that runtime, not revoked | One socket per runtime; a new one replaces the old one |
| A device (phone, tablet) | A user access token for a member of the runtime's workspace | Any number |

And then, through the tunnel, **the PC's own remote PIN** (`api/remote-login`), exactly as on the Wi-Fi. The relay is
off on every PC until someone turns on **Settings → Phone & iPad Remote → Control from anywhere** there.

Browsers cannot put an `Authorization` header on a WebSocket, so both sides first get a ticket:

`POST /v1/relay/{runtimeId}/ticket` (bearer access token) → `200 {"ticket": "…", "expiresIn": 60}`, or `403`
`forbidden` (not this workspace, or a runtime asking for another runtime), `404` `not_found` (no such runtime, or
revoked). At most 60 tickets a minute per caller. Errors have the API's usual shape,
`{"error": {"code", "message"}}`.

The ticket is a signed token (ES256, the API's key, its own audience `framedecks-relay`, so a ticket is never an
access token and the other way round) with `sub` (user or runtime id; a runtime's must be `rid`), `role` (`runtime` or
`device`), `rid` (the runtime id), a random `jti` and a 60-second expiry. Each ticket opens one socket (the relay
remembers the `jti` until it expires).

`GET /v1/relay/{runtimeId}?ticket=…` with `Upgrade: websocket` → `101`, or `401` `bad_ticket` (also when the runtime
was revoked after the ticket was issued), or `426` `upgrade_required`.

`GET /v1/relay/runtimes` (a user's token; a runtime gets `403`) → `[{"id", "name", "platform", "online"}]`: the
workspace's computers, `online` when that PC's socket is connected now. The remote lists these.

## 2. Messages

Text frames, one JSON object each, at most 1 MB. Bodies travel as text when they are text (`application/json`,
`text/*`) and as base64 otherwise (`"enc": "b64"`).

| From → to | Message |
|---|---|
| device → relay | `{"t": "req", "id": "<device's own id>", "method": "GET", "path": "api/state?since=…", "headers": {"Content-Type": "…", "Cookie": "…"}, "body": "…", "enc": "b64"?}` |
| relay → runtime | the same, plus `"from": "<connection id>"` (the relay's id for that device socket) |
| runtime → relay | `{"t": "res", "id": "…", "to": "<connection id>", "status": 200, "headers": {"Content-Type": "…", "Set-Cookie": "…"}, "body": "…", "enc": "b64"?}` |
| relay → device | the same, without `to` |
| relay → device | `{"t": "runtime", "online": true/false}`: on connecting, and whenever the PC connects or goes away |
| relay → device | `{"t": "res", "id": "…", "status": 503, "headers": {"Content-Type": "application/json"}, "body": "{\"error\":\"offline\"}"}` for a request sent while the PC is away |
| relay → sender | `{"t": "error", "code": "too_large" \| "bad_json" \| "unknown_type" \| "bad_message", "message": "…"}`: a message over 1 MiB, not JSON, of a type that side may not send (a device's `res`, a runtime's `req`), or missing its `id` / `to`. A `res` for a device that has gone is dropped. |
| either → relay | `{"t": "ping"}` → `{"t": "pong"}` (keeps mobile networks from dropping an idle socket) |

The relay never reads `path`, `headers` or `body` beyond passing them on, and never writes them anywhere.

**CORS.** The remote calls the API from its own address. Origins in `CORS_ORIGINS` (wrangler.toml; in dev any
`http://127.0.0.1:*` and `http://localhost:*`) get `Access-Control-Allow-Origin` on every answer and their preflights
answered (`GET, POST, PATCH, DELETE`; `Authorization, Content-Type`); credentials are never allowed (tokens are
bearer). Other origins get no CORS headers.

## 3. On the PC

- `relay_link.py` keeps one outgoing socket while signed in and "Control from anywhere" is on; it reconnects with
  backoff (1 s → 60 s) and never blocks presenting.
- Each `req` is replayed against a second listener on `127.0.0.1` whose handler treats every request as a device on
  the Wi-Fi: the remote's allow-list (`REMOTE_PUBLIC`, `REMOTE_SIGNED_IN`), the PIN, the PIN lock-out (per relay
  connection) and the session cookie all apply exactly as they do on the Wi-Fi. Members data and the Studio are never
  reachable this way.
- Requests run concurrently (a long-poll of `api/state` does not hold up a press of NEXT).

## 4. On the phone

- The remote's files are published unchanged to the cloud address (Pages) by `tools/build_pwa.py` and
  `.github/workflows/pages.yml`; only `js/cloud-config.js` differs (it names the API). On the PC it is `null`, and
  `js/cloud-remote.js` does nothing. On the cloud address `remote.html` first shows the sign-in card (email code), then
  the account's PCs, then the PIN card (which gains "Choose another PC").
- `sw.js` keeps the remote's files for offline and installing; it never caches `api/`.
- `store.js` switches `KCTransport` to the relay transport: the same `fetch(path, init)` shape, carried as `req` /
  `res`. The remote's screens do not change; preview frames (`stage.html`) use their parent's transport.
- The PC's session cookie is kept by the transport for that PC (it cannot be an HttpOnly cookie on another address;
  Phase 4 replaces it with a device credential).
- When the socket drops, requests fail like a lost Wi-Fi connection does today, so the remote shows its usual
  "Not connected to the PC" state, and the transport reconnects.

## 5. How it is tested

- `tests/test_relay_link.py`: the real program behind a fake relay; through the tunnel it is a phone (PIN needed,
  members data, the Studio and `api/cloud` never reachable, wrong PINs lock out that connection only), binary answers,
  and switching off closes the socket.
- `cloud/test/relay.test.ts`: tickets, routing, online notices, replacement, errors, the list, CORS.
- `tools/relay_e2e.py` (the Phase 3 exit test): the real cloud, the real program with the fixed meeting, and the
  published remote on another address. A phone signs in, chooses the PC and enters the PIN; then the remote's pictures
  are identical to the Wi-Fi remote's (phone and tablet, Simple and Advanced), `api/state` is identical, and a press on
  the phone reaches the PC.

## 6. Not yet (Phase 4)

Pair codes and QR, Approve at the PC, roles, the trusted-device list, and sealing every message end to end with a key
agreed at pairing, so the relay carries only ciphertext. Until then the tunnel is protected by TLS on both legs, the
account, and the PC's PIN; it is off on every PC until switched on there.

Also later: the PC pushes each new revision down the socket instead of answering long-polls (architecture §12). Today
the remote's long-poll of `api/state` travels through the relay unchanged, which keeps the remote's code identical.
