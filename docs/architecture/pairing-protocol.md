# FrameDecks pairing (Phase 4: trusted devices, end to end)

How a phone or tablet becomes a trusted remote of one PC, and how its messages are sealed so the relay carries only
ciphertext. The design is [saas-pwa-architecture.md](../project/saas-pwa-architecture.md) §6, §10 and §15; the relay it
travels over is [relay-protocol.md](relay-protocol.md). Exit: a new phone pairs in under a minute, with approval at
the PC, and a revoked phone is cut off within a second.

```
PC: Pair a phone ──▶ cloud: code 482 913 + QR token ──▶ PC shows QR (remote address#pair=…&k=<PC key>) and the code
phone: scan or type ──▶ signed in? ──▶ POST /pairing/claim (+ its own key) ──▶ PC: "Allow 'iPhone' (Safari, iOS)? 482 163"
PC: Approve (role) ──▶ cloud makes the device ──▶ phone collects its credential once ──▶ sealed relay, no PIN
```

## 1. Keys

- **At pairing** the PC makes an X25519 key pair for this pairing and the phone makes its own. Each sends its public
  key (32 bytes, base64url) to the cloud with its step. The QR also carries the PC's public key in the URL fragment,
  which never reaches a server.
- Both compute `shared = X25519(own private, other public)`, then with HKDF-SHA256 (salt = the pairing id, UTF-8):
  - `key = HKDF(shared, info "framedecks-relay-v1", 32 bytes)`: the AES-256-GCM key for this device and this PC;
  - `check = HKDF(shared, info "framedecks-pair-check", 4 bytes)` as a big-endian number mod 1 000 000, shown as six
    digits on both screens.
- **Binding:** with the QR, the phone refuses a PC key from the cloud that differs from the QR's. With a typed code,
  the person compares the six check digits on the phone and on the PC before pressing Approve.
- The PC keeps each device's key in its credential store (`FrameDecks/devices`); the phone keeps it with the device
  credential for that PC. The private keys are thrown away after pairing.

## 2. Pairing API

All `/v1`, errors `{"error": {"code", "message"}}`. Pairing requests expire 5 minutes after they start.

| Method & path | Who | Body → answer |
|---|---|---|
| `POST /pairing` | runtime | `{"pcKey"}` → `201 {"id", "code": "482913", "token", "expiresAt"}`. A new one ends any open one of this PC. Code and token are stored only as salted hashes. |
| `POST /pairing/claim` | user (member of the PC's workspace) | `{"token"}` or `{"code"}`, plus `"device": {"name", "platform", "browser"}`, `"deviceKey"` → `200 {"id", "runtime": {"id", "name"}, "pcKey", "expiresAt"}`. Codes are looked up only among the user's workspace's open requests. Wrong code: `400 code_wrong`; 5 wrong codes end the open request (`410 pair_expired`). Expired or used: `410 pair_expired`. |
| `GET /pairing/{id}` | the runtime that started it, or the user who claimed it | `{"id", "status": "open" \| "claimed" \| "approved" \| "rejected" \| "expired", "expiresAt"}`; for the runtime, once claimed, also `"device": {"name", "platform", "browser"}, "deviceKey"`; for the claimer, once approved, **once**: `"credential": {"device": {"id", "role", "name"}, "runtime": {"id", "name"}, "access", "accessExpiresAt", "refresh"}` |
| `POST /pairing/{id}/approve` | that runtime | `{"role": "viewer" \| "operator" \| "presenter" \| "admin"}` (default `operator`) → `{"device": {"id", "role", "name", …}}` |
| `POST /pairing/{id}/reject` | that runtime | → `204` |

Rate limits: `POST /pairing` 30 an hour per runtime; `claim` 10 a minute per user and 30 an hour per IP.

## 3. Devices

| Method & path | Who | What |
|---|---|---|
| `GET /devices?runtime={id}` | that runtime, or an admin user | `[{"id", "name", "platform", "browser", "role", "approvedAt", "lastUsedAt", "revoked"}]` |
| `PATCH /devices/{id}` | the device's runtime, or an admin user | `{"role"}` → the device |
| `DELETE /devices/{id}` | the device's runtime, an admin user, or the device itself | `204`. Revokes the device and its refresh tokens and **closes its relay sockets at once** |

**Device tokens.** The credential is a refresh token (subject `device`, rotating, reuse-detecting, like the others)
and a 10-minute access token with `typ: "device"`, `sub` = device id, `rid` = its PC, `role`. A device token may only
refresh, ask for a relay ticket for its own PC, and delete itself. `last_used_at` is set when it gets a ticket.

## 4. The relay, sealed

- `POST /relay/{rid}/ticket` also accepts a device token (its own `rid` only). The ticket carries `dev` and `role`.
- The relay adds `"dev"` and `"role"` to every `req` it passes from a device socket opened with a device ticket
  (`null` for a user-ticket socket).
- **A paired device's messages are sealed.** Instead of `method`, `path`, `headers`, `body`:
  - `req`: `{"t": "req", "id", "seal": {"iv", "ct"}}`, the plaintext being
    `{"n": <sequence>, "method", "path", "headers", "body", "enc"?}`;
  - `res`: `{"t": "res", "id", "to", "seal": {"iv", "ct"}}`, the plaintext
    `{"n": <the request's n>, "status", "headers", "body", "enc"?}`.
  - AES-256-GCM, a random 12-byte `iv`, base64url, additional data `framedecks-relay-v1|req|<device id>` or
    `…|res|<device id>`.
  - `n` starts at 1 on each socket and goes up by one per request. The PC refuses a request whose `n` is not above the
    last one it accepted on that socket (a replay or reordering), and the phone refuses a response whose `n` it did not
    send.
- **At the PC:** a sealed request from a device it has a key for is replayed as that device, with its role, and needs
  no PIN. An unsealed request from a socket opened with a user ticket gets `403 {"error": "pair_first"}`: since Phase 4
  the remote from anywhere needs a paired device. The PC refuses a sealed request it cannot open.
- **Revoking** at the PC removes the key here first (the next message fails at once), then tells the cloud, which
  closes the device's sockets.

## 5. Roles (the PC has the final say)

| Role | Through the relay |
|---|---|
| Viewer | Reads only: the state, the live picture, the Teleprompter. Anything that changes something gets `403 {"error": "role"}` and the remote's usual toast. |
| Operator (default) | Everything the Wi-Fi PIN remote can do. |
| Presenter | As Operator. |
| Administrator | As Operator. (Managing devices and editing Frames from the cloud come with later phases.) |

## 6. On the phone

1. Scanning the QR opens the remote at `…/remote.html#pair=<token>&k=<PC key>&pc=<runtime id>`. The fragment is read
   and removed from the address bar.
2. Not signed in: the sign-in card first (the same account as the PC).
3. Claim, then "Waiting for approval at ‹PC›. Check that the PC shows **482 163**", polling `GET /pairing/{id}` every
   2 seconds.
4. Approved: the credential and key are kept for that PC, and the remote opens straight away (no PIN).
5. Without the QR: choose the PC, then type the 6-digit code shown on it.

Revoked: the next ticket or message fails, the stored credential is removed, and the remote shows "This phone was
removed from ‹PC›. Pair it again."
