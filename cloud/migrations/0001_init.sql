-- FrameDecks cloud database (D1 / SQLite), docs/project/saas-pwa-architecture.md §7.
-- Times are Unix milliseconds. IDs are random 128-bit text.

CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, created_at INTEGER NOT NULL,
  deleted_at INTEGER                      -- account deletion: data purged by a job, row kept 30 days
);
CREATE TABLE identities (                 -- Google / Microsoft / Apple / email
  provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (provider, subject)
);
CREATE TABLE workspaces (                 -- a ministry; a user has one by default
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id), user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('viewer','operator','presenter','admin')),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE runtimes (                   -- a PC or Mac running FrameDecks
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL, platform TEXT NOT NULL CHECK (platform IN ('windows','macos','linux')),
  app_version TEXT, last_seen_at INTEGER, revoked_at INTEGER
);
CREATE TABLE devices (                    -- trusted remotes (phones, tablets, browsers)
  id TEXT PRIMARY KEY, runtime_id TEXT NOT NULL REFERENCES runtimes(id), user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, platform TEXT, browser TEXT,
  role TEXT NOT NULL CHECK (role IN ('viewer','operator','presenter','admin')),
  approved_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);
CREATE TABLE pairing_requests (
  id TEXT PRIMARY KEY, runtime_id TEXT NOT NULL REFERENCES runtimes(id),
  code_hash TEXT NOT NULL,                -- SHA-256 of the 6-digit code with a per-request salt
  token_hash TEXT NOT NULL,               -- SHA-256 of the QR token
  claimed_by_user TEXT, device_name TEXT, device_platform TEXT, device_browser TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open','claimed','approved','rejected','expired')),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE refresh_tokens (             -- users, runtimes and devices; rotating, reuse-detecting
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user','runtime','device')), subject_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used_at INTEGER, revoked_at INTEGER
);
CREATE TABLE entities (                   -- synced metadata: one row per Frame / template / theme / setting
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL CHECK (kind IN ('frame','template','order','theme','library_verse','library_question',
                                     'brand','profile','layout','meeting',
                                     'members')),     -- members: body is ciphertext (D5)
                                                      -- order: one per workspace, the running order of Frames
                                                      -- and library items, so inserting a Frame rewrites no other
  id TEXT NOT NULL,
  rev INTEGER NOT NULL,                   -- per-entity version
  seq INTEGER NOT NULL,                   -- workspace-wide change sequence (pull cursor)
  updated_by TEXT NOT NULL,               -- runtime or device id
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,                     -- JSON exactly as in kc-saved-content.json (local file paths, never bytes);
                                          -- a frame's body carries its decks and its Content (each with its deck)
  PRIMARY KEY (workspace_id, kind, id)
);
CREATE INDEX entities_seq ON entities(workspace_id, seq);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT, actor_type TEXT, actor_id TEXT,
  action TEXT NOT NULL,                   -- sign_in, pair_approved, device_revoked, role_changed, sync_conflict…
  detail TEXT, ip_hash TEXT, at INTEGER NOT NULL
);
