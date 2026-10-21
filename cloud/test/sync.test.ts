// Sync (cloud-api.md §4): new, update, conflict, delete, paging, and what the cloud refuses.
import { describe, expect, it } from "vitest";
import { call, post, RUNTIME, signIn, newEmail } from "./helpers";

const sync = (token: string, changes: unknown[]) => post("/v1/sync", { changes }, { token });

describe("POST /sync and GET /sync", () => {
  it("stores a new entity (baseRev 0), then an update on top of it", async () => {
    const s = await signIn();
    const a = await sync(s.access, [{ kind: "frame", id: "sc_1", baseRev: 0, body: { id: "sc_1", name: "Welcome", decks: [{ id: "d1", name: "Deck 1" }] } }]);
    expect(a.status).toBe(200);
    expect(a.body.results).toEqual([{ kind: "frame", id: "sc_1", status: "ok", rev: 1, seq: 1 }]);
    expect(a.body.seq).toBe(1);
    const b = await sync(s.access, [{ kind: "frame", id: "sc_1", baseRev: 1, body: { id: "sc_1", name: "Welcome!" } }]);
    expect(b.body.results[0]).toMatchObject({ status: "ok", rev: 2, seq: 2 });
    const g = await call("/v1/sync?since=0", { token: s.access });
    expect(g.status).toBe(200);
    expect(g.body.more).toBe(false);
    expect(g.body.seq).toBe(2);
    expect(g.body.entities).toHaveLength(1);
    expect(g.body.entities[0]).toMatchObject({ kind: "frame", id: "sc_1", rev: 2, seq: 2, deleted: false, body: { name: "Welcome!" }, updatedBy: s.runtime!.id });
    expect(g.body.entities[0].updatedAt).toBeGreaterThan(0);
  });

  it("reports a conflict with the cloud's current version, stores nothing, and logs it", async () => {
    const email = newEmail();
    const pc = await signIn(email, RUNTIME);
    const mac = await signIn(email, { ...RUNTIME, name: "Mac", platform: "macos" });
    await sync(pc.access, [{ kind: "brand", id: "brand", baseRev: 0, body: { meeting: "Tuesday" } }]);
    // the Mac had not seen that, and also makes the brand
    const c = await sync(mac.access, [{ kind: "brand", id: "brand", baseRev: 0, body: { meeting: "Thursday" } },
                                      { kind: "layout", id: "layout", baseRev: 0, body: { qWidth: 80 } }]);
    expect(c.body.results[0]).toEqual({ kind: "brand", id: "brand", status: "conflict",
      current: { rev: 1, deleted: false, body: { meeting: "Tuesday" }, updatedBy: pc.runtime!.id } });
    expect(c.body.results[1]).toMatchObject({ kind: "layout", status: "ok", rev: 1 });     // each change stands alone
    // last writer wins: the client sends again on top of the current rev
    const w = await sync(mac.access, [{ kind: "brand", id: "brand", baseRev: 1, body: { meeting: "Thursday" } }]);
    expect(w.body.results[0]).toMatchObject({ status: "ok", rev: 2 });
    // a baseRev ahead of the cloud is a conflict too
    const ahead = await sync(mac.access, [{ kind: "profile", id: "profile", baseRev: 3, body: { value: "sunday" } }]);
    expect(ahead.body.results[0]).toMatchObject({ status: "conflict", current: { rev: 0, deleted: true, body: null } });
    const log = await call("/v1/audit", { token: pc.access });
    expect(log.body.events.filter((e: { action: string }) => e.action === "sync_conflict")).toHaveLength(2);
  });

  it("deletes: the entity comes back as deleted, with no body", async () => {
    const s = await signIn();
    await sync(s.access, [{ kind: "frame", id: "sc_x", baseRev: 0, body: { name: "Gone soon" } }]);
    const d = await sync(s.access, [{ kind: "frame", id: "sc_x", baseRev: 1, deleted: true }]);
    expect(d.body.results[0]).toMatchObject({ status: "ok", rev: 2 });
    const g = await call("/v1/sync?since=1", { token: s.access });
    expect(g.body.entities).toEqual([expect.objectContaining({ kind: "frame", id: "sc_x", rev: 2, deleted: true, body: null })]);
    // and can come back
    const back = await sync(s.access, [{ kind: "frame", id: "sc_x", baseRev: 2, body: { name: "Back" } }]);
    expect(back.body.results[0]).toMatchObject({ status: "ok", rev: 3 });
  });

  it("pages with limit, more and the seq cursor", async () => {
    const s = await signIn();
    await sync(s.access, Array.from({ length: 5 }, (_, i) => ({ kind: "library_question", id: `q${i}`, baseRev: 0, body: { id: `q${i}`, text: `Q${i}` } })));
    const p1 = await call("/v1/sync?since=0&limit=2", { token: s.access });
    expect(p1.body.entities.map((e: { id: string }) => e.id)).toEqual(["q0", "q1"]);
    expect(p1.body.more).toBe(true);
    const p2 = await call(`/v1/sync?since=${p1.body.seq}&limit=2`, { token: s.access });
    expect(p2.body.entities.map((e: { id: string }) => e.id)).toEqual(["q2", "q3"]);
    const p3 = await call(`/v1/sync?since=${p2.body.seq}&limit=2`, { token: s.access });
    expect(p3.body.entities.map((e: { id: string }) => e.id)).toEqual(["q4"]);
    expect(p3.body.more).toBe(false);
    const p4 = await call(`/v1/sync?since=${p3.body.seq}`, { token: s.access });
    expect(p4.body).toEqual({ entities: [], seq: p3.body.seq, more: false });
  });

  it("keeps workspaces apart", async () => {
    const a = await signIn();
    const b = await signIn();
    await sync(a.access, [{ kind: "frame", id: "sc_private", baseRev: 0, body: { name: "A's" } }]);
    expect((await call("/v1/sync?since=0", { token: b.access })).body.entities).toEqual([]);
    const r = await sync(b.access, [{ kind: "frame", id: "sc_private", baseRev: 0, body: { name: "B's" } }]);
    expect(r.body.results[0]).toMatchObject({ status: "ok", rev: 1 });
  });

  it("refuses an unknown kind, members that are not encrypted, and bodies that are too large", async () => {
    const s = await signIn();
    const k = await sync(s.access, [{ kind: "slide", id: "x", baseRev: 0, body: {} }]);
    expect(k.status).toBe(400);
    expect(k.body.error.code).toBe("unknown_kind");
    const m = await sync(s.access, [{ kind: "members", id: "members", baseRev: 0, body: { members: [{ name: "Ann" }] } }]);
    expect(m.status).toBe(400);
    expect(m.body.error.code).toBe("members_not_encrypted");
    const ok = await sync(s.access, [{ kind: "members", id: "members", baseRev: 0, body: { v: 1, alg: "A256GCM", iv: "aXY", ct: "Y2lwaGVy" } }]);
    expect(ok.body.results[0].status).toBe("ok");
    const big = await sync(s.access, [{ kind: "frame", id: "big", baseRev: 0, body: { notes: "x".repeat(257 * 1024) } }]);
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("entity_too_large");
    const many = await sync(s.access, Array.from({ length: 201 }, (_, i) => ({ kind: "frame", id: `f${i}`, baseRev: 0, body: {} })));
    expect(many.status).toBe(413);
    const huge = await post("/v1/sync", { changes: [], pad: "x".repeat(2 * 1024 * 1024 + 10) }, { token: s.access });
    expect(huge.status).toBe(413);
    // nothing of the refused requests was stored
    const g = await call("/v1/sync?since=0", { token: s.access });
    expect(g.body.entities.map((e: { kind: string }) => e.kind)).toEqual(["members"]);
  });

  it("needs a signed-in runtime or administrator", async () => {
    expect((await call("/v1/sync?since=0")).status).toBe(401);
    const admin = await signIn(newEmail(), { type: "browser" });
    expect((await call("/v1/sync?since=0", { token: admin.access })).status).toBe(200);
  });
});
