# FrameDecks cloud API (Phase 2: accounts and sync)

The exact contract between the cloud (`cloud/`, Cloudflare Workers + D1) and its clients: the Windows program
(`cloud_link.py` + `app/js/cloud-sync.js`) and, later, the Flutter app. The design and its reasons are in
[saas-pwa-architecture.md](../project/saas-pwa-architecture.md) §7–§11 and §15; this page is the precise shape.

Base address: `https://<api>/v1`. Until a domain exists it is the Worker's `workers.dev` address (D4). Every body is
JSON. Errors: `{"error": {"code": "<snake_case>", "message": "<words for people>"}}`. Besides the codes named below:
`bad_json`, `too_large`, `bad_client` (a runtime's platform is `windows`, `macos` or `linux`), `bad_email`,
`too_many_changes`, `bad_change`, `bad_changes`, `provider_not_configured`, `rate_limited` (429, with `retryAfter`
in seconds) and `not_configured` (503: the cloud has no signing key yet).

A computer signing in again sends `client.runtimeId`, so it keeps the same entry in the list of computers. A runtime's
access token stops working the moment the runtime is revoked (each request checks it). Audit `actor` is
`{"type", "id"}`.

---

## 1. Tokens

| Token | Form | Lifetime | Where the client keeps it |
|---|---|---|---|
| Access | JWT, ES256, header `kid`; claims `sub`, `typ` (`user` / `runtime`), `uid` (the user), `ws` (workspace), `role`, `jti`, `iat`, `exp` | 10 minutes | memory |
| Refresh | opaque, 32 random bytes, base64url | browser user 30 days; runtime until signed out or revoked | Windows Credential Manager (runtime); never in browser storage |

- Send the access token as `Authorization: Bearer <access>`. A missing, expired or bad token answers
  `401 {"error": {"code": "unauthorized"}}`; the client refreshes once, then signs out.
- **Refresh tokens rotate.** `POST /auth/refresh` returns a new pair and retires the old refresh token. Presenting a
  retired one again revokes the whole family (every token descended from that sign-in) and answers
  `401 {"code": "token_reused"}`.
- The public keys are at `GET /v1/.well-known/jwks.json`.

Every sign-in answers with the same **session** object:

```json
{
  "access": "<jwt>", "accessExpiresAt": 1761040000000, "refresh": "<opaque>",
  "user": {"id": "u_…", "email": "ann@example.org", "name": "Ann"},
  "workspace": {"id": "w_…", "name": "Ann's ministry", "role": "admin"},
  "runtime": {"id": "r_…", "name": "Church PC"}
}
```

`runtime` is present when the client signed in as a runtime (a PC or Mac running FrameDecks). The first sign-in of an
email creates the user and a workspace named "<name or email>'s ministry", with that user as `admin`.

## 2. Signing in

### Email code

| Call | Body | Answer |
|---|---|---|
| `POST /auth/email/start` | `{"email"}` | `202 {"sent": true}`. A 6-digit code is emailed; it works for 10 minutes and 5 tries. In the `dev` and `test` environments the answer also has `"devCode"`. If no mailer is set up: `503 {"code": "email_not_configured"}`. |
| `POST /auth/email/verify` | `{"email", "code", "client"}` | `200` session, or `400 {"code": "code_wrong"}`, `{"code": "code_expired"}` (also after 5 wrong tries) |

`client` describes who is signing in: `{"type": "runtime" | "browser", "name": "Church PC", "platform": "windows" |
"macos" | "linux" | "ios" | "android" | "web", "appVersion": "6.9"}`. `type: "runtime"` registers (or, with the same
`client.runtimeId`, re-uses) a runtime.

### Google, Microsoft and Apple: the browser sign-in session

A runtime has no web page of its own, so it borrows the browser:

1. `POST /auth/session` with `{"client"}` → `201 {"id", "url", "pollToken", "expiresAt"}` (10 minutes).
2. The runtime opens `url` in the system browser: a small cloud page with **Continue with Google / Microsoft / Apple**
   (only those that are set up) and **Email me a code** (its forms post to `/auth/session/{id}/email` and
   `/auth/session/{id}/email/verify`).
3. The provider sends the person back to `GET /auth/oidc/{provider}/callback`. The cloud checks the `state`, swaps the
   code for an ID token (PKCE), checks the token's signature (the provider's JWKS), issuer, audience, expiry and
   `email_verified`, and marks the session signed in. A Microsoft address links to an existing account only from the
   personal-account tenant or when Microsoft marks its domain as verified; otherwise, if the address already has an
   account, the answer is `409 {"code": "email_in_use"}`. The page says "You can close this window."
4. The runtime polls `POST /auth/session/poll` with `{"pollToken"}` every 2 seconds: `202 {"pending": true}` until
   then, then `200` session (once), or `410 {"code": "session_expired"}`.

`GET /auth/providers` → `{"providers": ["google", "microsoft", "apple"], "email": true}`: what is set up.

### Refresh and sign-out

| Call | Body | Answer |
|---|---|---|
| `POST /auth/refresh` | `{"refresh"}` | `200 {"access", "accessExpiresAt", "refresh"}`, or `401` (`token_reused`, `unauthorized`) |
| `POST /auth/logout` | `{"refresh"}` | `204`. Revokes that family. |

## 3. You, your workspace, your computers

| Call | Who | Answer |
|---|---|---|
| `GET /me` | any | `{"user", "workspace", "runtimes": [{"id", "name", "platform", "appVersion", "lastSeenAt", "revoked"}]}` |
| `GET /me/export` | any | Everything stored about you: user, identities, workspace, its entities, runtimes, audit (JSON download) |
| `DELETE /me` | user or runtime | `204`. Revokes every token; deletes your identities; when you are the workspace's only member, deletes the workspace and everything in it. The user row is kept 30 days (`deleted_at`), then purged. |
| `PATCH /runtimes/{id}` | admin | `{"name"}` → the runtime |
| `DELETE /runtimes/{id}` | admin | `204`. Revokes it and its tokens. A revoked runtime keeps working offline. |
| `GET /audit?since=<id>` | admin | `{"events": [{"id", "at", "actor", "action", "detail"}], "next"}` |

## 4. Sync

Entities are the records made by `app/js/entities.js` (`frame`, `template`, `order`, `theme`, `library_question`,
`library_verse`, `brand`, `layout`, `meeting`, `profile`, `members`). The cloud stores them as they come, and never
looks inside except to check sizes and the `members` shape.

### `GET /sync?since=<seq>&limit=<n>`

Runtime or admin. Changes in the workspace after `seq` (0 = everything), oldest first, at most `limit` (default and
maximum 500):

```json
{"entities": [{"kind": "frame", "id": "sc_1", "rev": 4, "seq": 1042, "deleted": false, "body": {…},
               "updatedBy": "r_…", "updatedAt": 1761040000000}],
 "seq": 1042, "more": false}
```

`seq` is the cursor for the next call; numbers can have gaps (two writes racing). Deleted entities come with `"deleted": true` and `"body": null`.

### `POST /sync`

Runtime or admin. `{"changes": [{"kind", "id", "baseRev", "deleted": false, "body": {…}}]}` (at most 200 changes,
2 MB, each body at most 256 KB). `baseRev` is the `rev` the client last saw (0 = new to the cloud).

```json
{"results": [{"kind": "frame", "id": "sc_1", "status": "ok", "rev": 5, "seq": 1043},
             {"kind": "brand", "id": "brand", "status": "conflict",
              "current": {"rev": 7, "deleted": false, "body": {…}, "updatedBy": "r_…"}}],
 "seq": 1043}
```

- **`ok`:** stored with `rev` = old rev + 1 and a new workspace `seq`.
- **`conflict`:** someone else changed it since `baseRev`; nothing was stored. For a record the cloud does not have,
  `current` is `{"rev": 0, "deleted": true, "body": null, "updatedBy": null}`. The client decides (§5) and may send
  again with `baseRev` = `current.rev`.
- Each change stands alone: some can be `ok` and others `conflict` in one call.
- `members` bodies must be `{"v": 1, "alg": "A256GCM", "iv": "<base64url>", "ct": "<base64url>"}` (end-to-end
  encrypted, D5); anything else is `400 {"code": "members_not_encrypted"}`.
- Every conflict is written to the audit log (`sync_conflict`).

## 5. What the client does with a conflict

| Kind | Rule |
|---|---|
| joining (first sync) | A Frame here with the same content as one in the account, ids and times aside (such as the starter Frames every computer makes), is not added twice. Any difference and it is kept. A setting this computer never synced takes the account's. |
| `frame`, `template` | **Never lose a Frame.** Keep the cloud's version under the original id, and add this computer's version as a copy named "‹Frame› (from ‹computer›)" with a new id (pushed as new). |
| everything else | Last writer wins: this computer's version is sent again with `baseRev` = `current.rev`. The cloud's version stays in the audit log. |

## 6. Limits

| What | Limit |
|---|---|
| `POST /auth/email/start` | 5 an hour per email, 20 an hour per IP address |
| `POST /auth/email/verify` | 5 tries per code |
| `POST /auth/session` | 20 an hour per IP address |
| Writes (`POST /sync`, …) | 600 a minute per workspace |

Over a limit: `429 {"error": {"code": "rate_limited", "message": "…", "retryAfter": <seconds>}}`.

## 7. Settings the cloud needs (secrets)

| Name | What |
|---|---|
| `JWT_PRIVATE_KEY` | ES256 private key (JWK JSON). `JWT_KID` names it. |
| `EMAIL_FROM`, `RESEND_API_KEY` | Sending the codes (Resend). Without them, email sign-in answers `email_not_configured` (except in `dev` / `test`). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft sign-in (the `common` tenant: work, school and personal accounts) |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Sign in with Apple |
| `ENVIRONMENT` | `production`, `staging`, `dev` or `test` |
