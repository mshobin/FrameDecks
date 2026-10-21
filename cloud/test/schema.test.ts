import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const TABLES = ["audit_log", "devices", "entities", "identities", "pairing_requests", "refresh_tokens", "runtimes",
  "users", "workspace_members", "workspaces"];
const KINDS = ["frame", "template", "order", "theme", "library_verse", "library_question", "brand", "profile", "layout",
  "meeting", "members"];

async function entity(kind: string, id: string) {
  await env.DB.prepare("INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES ('w1', 'Test ministry', 0)").run();
  return env.DB.prepare(
    "INSERT INTO entities (workspace_id, kind, id, rev, seq, updated_by, updated_at, body) VALUES ('w1', ?, ?, 1, 1, 'r1', 0, '{}')",
  ).bind(kind, id).run();
}

describe("migration 0001", () => {
  it("creates every table of the design (§7)", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(TABLES);
  });

  it("creates the sync cursor index", async () => {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'entities_seq'").first();
    expect(row).not.toBeNull();
  });

  it("accepts every entity kind of the design", async () => {
    for (const [i, kind] of KINDS.entries()) await entity(kind, `e${i}`);
    const { results } = await env.DB.prepare("SELECT kind FROM entities ORDER BY kind").all<{ kind: string }>();
    expect(results.map((r) => r.kind)).toEqual([...KINDS].sort());
  });

  it("rejects an unknown entity kind", async () => {
    await expect(entity("slide", "x1")).rejects.toThrow(/CHECK constraint failed/);
  });
});
