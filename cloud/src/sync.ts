// Sync (docs/architecture/cloud-api.md §4): entities stored as they come, with a per-entity rev and a workspace-wide
// change sequence. A change on top of an older rev is a conflict; the client decides what to do (§5).
import { audit } from "./audit";
import type { Env } from "./env";
import type { Auth } from "./guard";
import { clientIp, HttpError, json, readJson } from "./http";
import { limit, MINUTE } from "./ratelimit";

export const KINDS = ["frame", "template", "order", "theme", "library_verse", "library_question", "brand", "profile", "layout",
  "meeting", "members"] as const;
export const MAX_CHANGES = 200;
export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
export const MAX_ENTITY_BYTES = 256 * 1024;
export const MAX_PAGE = 500;

interface EntityRow { kind: string; id: string; rev: number; seq: number; deleted: number; body: string; updated_by: string; updated_at: number }

function canSync(auth: Auth): void {
  if (auth.typ !== "runtime" && auth.role !== "admin") {
    throw new HttpError(403, "forbidden", "Only FrameDecks on a computer, or an administrator, can sync this workspace.");
  }
}

const out = (r: EntityRow) => ({
  kind: r.kind, id: r.id, rev: r.rev, seq: r.seq, deleted: !!r.deleted, body: r.deleted ? null : JSON.parse(r.body),
  updatedBy: r.updated_by, updatedAt: r.updated_at,
});

/** GET /sync?since=<seq>&limit=<n> */
export async function pull(env: Env, auth: Auth, url: URL): Promise<Response> {
  canSync(auth);
  const since = Math.max(0, Math.floor(Number(url.searchParams.get("since") || 0)) || 0);
  const n = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(url.searchParams.get("limit") || MAX_PAGE)) || MAX_PAGE));
  const { results } = await env.DB.prepare(
    "SELECT kind, id, rev, seq, deleted, body, updated_by, updated_at FROM entities WHERE workspace_id = ? AND seq > ? ORDER BY seq LIMIT ?",
  ).bind(auth.ws, since, n + 1).all<EntityRow>();
  const more = results.length > n;
  const page = results.slice(0, n);
  return json({ entities: page.map(out), seq: page.length ? page[page.length - 1].seq : since, more });
}

interface Change { kind: string; id: string; baseRev: number; deleted: boolean; body: unknown }

function validate(raw: unknown): Change {
  const bad = (code: string, m: string, status = 400) => new HttpError(status, code, m);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw bad("bad_change", "Each change must be an object.");
  const c = raw as Record<string, unknown>;
  if (!(KINDS as readonly string[]).includes(String(c.kind))) throw bad("unknown_kind", `Unknown kind "${String(c.kind)}".`);
  if (typeof c.id !== "string" || !c.id || c.id.length > 200) throw bad("bad_change", "Each change needs an id.");
  const baseRev = c.baseRev ?? 0;
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0) throw bad("bad_change", "baseRev must be a whole number.");
  const deleted = c.deleted === true;
  if (!deleted) {
    if (c.body === undefined || c.body === null) throw bad("bad_change", "A change needs a body (or deleted: true).");
    const size = new TextEncoder().encode(JSON.stringify(c.body)).length;
    if (size > MAX_ENTITY_BYTES) throw bad("entity_too_large", `"${c.id}" is too large to sync (over 256 KB).`, 413);
    if (c.kind === "members") {
      const b = c.body as Record<string, unknown>;
      const ok = b && typeof b === "object" && !Array.isArray(b) && b.v === 1 && b.alg === "A256GCM"
        && typeof b.iv === "string" && /^[A-Za-z0-9_-]+$/.test(b.iv) && typeof b.ct === "string" && /^[A-Za-z0-9_-]+$/.test(b.ct)
        && Object.keys(b).length === 4;
      if (!ok) throw bad("members_not_encrypted", "Members data must be end-to-end encrypted before it is synced.");
    }
  }
  return { kind: String(c.kind), id: c.id, baseRev, deleted, body: deleted ? null : c.body };
}

/** POST /sync */
export async function push(request: Request, env: Env, auth: Auth): Promise<Response> {
  canSync(auth);
  await limit(env, `sync:${auth.ws}`, 600, MINUTE);
  const body = await readJson<{ changes?: unknown }>(request, MAX_REQUEST_BYTES);
  if (!Array.isArray(body.changes)) throw new HttpError(400, "bad_changes", "Send {\"changes\": [...]}.");
  if (body.changes.length > MAX_CHANGES) throw new HttpError(413, "too_many_changes", `Send at most ${MAX_CHANGES} changes at once.`);
  const changes = body.changes.map(validate);
  const by = auth.sub;                                  // the runtime, or the user
  const results: Record<string, unknown>[] = [];
  for (const c of changes) {
    const cur = await env.DB.prepare("SELECT rev, deleted, body, updated_by FROM entities WHERE workspace_id = ? AND kind = ? AND id = ?")
      .bind(auth.ws, c.kind, c.id).first<{ rev: number; deleted: number; body: string; updated_by: string }>();
    const curRev = cur?.rev ?? 0;
    if (c.baseRev !== curRev) {
      results.push(await conflict(env, request, auth, c, cur));
      continue;
    }
    const seqRow = await env.DB.prepare("UPDATE workspaces SET seq = seq + 1 WHERE id = ? RETURNING seq").bind(auth.ws).first<{ seq: number }>();
    if (!seqRow) throw new HttpError(401, "unauthorized", "Please sign in again.");
    const now = Date.now();
    const text = c.deleted ? "null" : JSON.stringify(c.body);
    // write only if nobody else wrote since we read (two computers syncing at the same moment)
    const w = cur
      ? await env.DB.prepare("UPDATE entities SET rev = rev + 1, seq = ?, updated_by = ?, updated_at = ?, deleted = ?, body = ? WHERE workspace_id = ? AND kind = ? AND id = ? AND rev = ?")
        .bind(seqRow.seq, by, now, c.deleted ? 1 : 0, text, auth.ws, c.kind, c.id, curRev).run()
      : await env.DB.prepare("INSERT INTO entities (workspace_id, kind, id, rev, seq, updated_by, updated_at, deleted, body) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
        .bind(auth.ws, c.kind, c.id, seqRow.seq, by, now, c.deleted ? 1 : 0, text).run();
    if (!w.meta.changes) {
      const now2 = await env.DB.prepare("SELECT rev, deleted, body, updated_by FROM entities WHERE workspace_id = ? AND kind = ? AND id = ?")
        .bind(auth.ws, c.kind, c.id).first<{ rev: number; deleted: number; body: string; updated_by: string }>();
      results.push(await conflict(env, request, auth, c, now2));
      continue;
    }
    results.push({ kind: c.kind, id: c.id, status: "ok", rev: curRev + 1, seq: seqRow.seq });
  }
  const ws = await env.DB.prepare("SELECT seq FROM workspaces WHERE id = ?").bind(auth.ws).first<{ seq: number }>();
  return json({ results, seq: ws?.seq ?? 0 });
}

async function conflict(env: Env, request: Request, auth: Auth, c: Change, cur: { rev: number; deleted: number; body: string; updated_by: string } | null) {
  await audit(env, auth.ws, { type: auth.typ, id: auth.sub }, "sync_conflict", { kind: c.kind, id: c.id, baseRev: c.baseRev, rev: cur?.rev ?? 0 }, clientIp(request));
  return {
    kind: c.kind, id: c.id, status: "conflict",
    current: cur
      ? { rev: cur.rev, deleted: !!cur.deleted, body: cur.deleted ? null : JSON.parse(cur.body), updatedBy: cur.updated_by }
      : { rev: 0, deleted: true, body: null, updatedBy: null },
  };
}
