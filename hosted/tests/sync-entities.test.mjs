import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { KINDS, canon, changes, join, split } from "../src/lib/sync-entities.ts";

// The same fixtures the desktop's sync_entities.py is checked against (tests/test_sync_entities.py).
const dir = new URL("../../tests/fixtures/sync/", import.meta.url);
const fixtures = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => [name, JSON.parse(readFileSync(new URL(name, dir), "utf8"))]);

test("the companion splits every fixture into exactly the desktop's records and joins it back", () => {
  assert.ok(fixtures.length >= 3);
  for (const [name, fx] of fixtures) {
    const parts = split(fx.normalized, fx.members);
    assert.deepEqual(parts, fx.split, name);
    assert.equal(canon(parts), canon(fx.split), name);
    const back = join(parts.entities, parts.local);
    assert.equal(canon(back.doc), canon(fx.normalized), `${name}: same document`);
    assert.deepEqual(Object.keys(back.doc), Object.keys(fx.normalized), `${name}: sections in the same order`);
    assert.deepEqual(back.members, fx.members, `${name}: same members`);
    assert.equal(canon(join([...parts.entities].reverse(), parts.local)), canon(back), `${name}: record order`);
  }
});

test("the companion's kinds match the database", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0003_sync.sql", import.meta.url), "utf8");
  const listed = /kind text not null check \(kind in \(([\s\S]*?)\)\)/.exec(sql)[1];
  assert.deepEqual([...listed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(), [...KINDS].sort());
});

test("a push carries only what changed; going live carries nothing", () => {
  const fx = fixtures.find(([name]) => name === "service.json")[1];
  const base = split(fx.normalized, fx.members).entities;
  const live = structuredClone(fx.normalized);
  live.live.scene = live.scenes[0].id;
  live.question.text = "Another question";
  live.rev += 1;
  assert.deepEqual(changes(base, split(live, fx.members).entities), { upserts: [], deletes: [] });
  const edited = structuredClone(fx.normalized);
  edited.scenes[1].notes = "New script";
  edited.scenes.splice(2, 1);
  const c = changes(base, split(edited, fx.members).entities);
  assert.deepEqual(c.upserts.map((e) => `${e.kind}/${e.id}`).sort(), [`frame/${fx.normalized.scenes[1].id}`, "order/order"]);
  assert.deepEqual(c.deletes, [{ kind: "frame", id: fx.normalized.scenes[2].id }]);
});
