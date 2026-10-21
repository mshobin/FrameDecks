-- FrameDecks cloud, Phase 2: accounts and sync (docs/architecture/cloud-api.md).
-- Times are Unix milliseconds. Codes, poll tokens and refresh tokens are stored only as SHA-256 hashes.

-- who registered a runtime (the user it signs in as)
ALTER TABLE runtimes ADD COLUMN user_id TEXT REFERENCES users(id);

-- the workspace-wide change sequence: every stored entity change takes the next number (the sync cursor)
ALTER TABLE workspaces ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;

-- one-time email codes (one live code per address; a new one replaces it)
CREATE TABLE email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,                -- SHA-256 of salt + code
  salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,    -- wrong tries; 5 ends the code
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

-- browser sign-in sessions: a runtime opens the page, the person signs in there, the runtime polls for the result
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL UNIQUE,         -- SHA-256 of the poll token the runtime holds
  client TEXT NOT NULL,                   -- the signing-in client, JSON (cloud-api.md §2)
  status TEXT NOT NULL CHECK (status IN ('open','done','collected')),
  provider TEXT,                          -- the OIDC provider chosen on the page
  state TEXT UNIQUE,                      -- OIDC state (CSRF), PKCE verifier and nonce, while the provider is open
  verifier TEXT, nonce TEXT,
  email TEXT,                             -- the address an email code was sent to from the page
  user_id TEXT REFERENCES users(id),      -- set when the person has signed in
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_expires ON auth_sessions(expires_at);

-- fixed-window rate limits: key = what is limited ("email-start:ip:<hash>", "sync:<workspace>"…)
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
);

CREATE INDEX refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX refresh_tokens_subject ON refresh_tokens(subject_type, subject_id);
CREATE INDEX runtimes_workspace ON runtimes(workspace_id);
CREATE INDEX audit_log_workspace ON audit_log(workspace_id, id);
CREATE INDEX identities_user ON identities(user_id);
