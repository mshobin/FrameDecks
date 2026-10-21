-- FrameDecks cloud, Phase 4: pairing and trusted devices (docs/architecture/pairing-protocol.md).
-- Times are Unix milliseconds. A request is 'open' or 'claimed' until expires_at (5 minutes after it starts); after
-- that it reads as 'expired' whatever its stored status says (the API computes it).

ALTER TABLE pairing_requests ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);   -- the PC's workspace, at the start
ALTER TABLE pairing_requests ADD COLUMN code_salt TEXT;            -- per-request salt of code_hash
ALTER TABLE pairing_requests ADD COLUMN pc_key TEXT;               -- the PC's X25519 public key for this pairing (base64url)
ALTER TABLE pairing_requests ADD COLUMN device_key TEXT;           -- the phone's, sent with its claim
ALTER TABLE pairing_requests ADD COLUMN device_id TEXT REFERENCES devices(id);         -- set on approval
ALTER TABLE pairing_requests ADD COLUMN credential_delivered INTEGER NOT NULL DEFAULT 0;  -- 1 once the claimer has it

CREATE UNIQUE INDEX pairing_requests_token ON pairing_requests(token_hash);
CREATE INDEX pairing_requests_runtime ON pairing_requests(runtime_id, status);
CREATE INDEX pairing_requests_workspace ON pairing_requests(workspace_id, status, expires_at);
CREATE INDEX devices_runtime ON devices(runtime_id);
CREATE INDEX devices_user ON devices(user_id);
