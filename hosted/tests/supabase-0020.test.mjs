// 0020 (26.11.24 Members' phones): the church PC opens a room and publishes what is on the meeting screen (and, after
// the meeting, the sermon notes); phones read it with only the code, getting {"same": true} when nothing changed; a new
// room or closing it removes what it held; wrong codes are limited; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000002c1";
const KEY = "pc-key-room-0123456789abcdef0123456789abcd";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db;
const one = async (p) => (await p).rows[0];
async function call(sql, params, headers) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const pc = (sql, params) => call(sql, params, { "x-framedecks-computer": KEY, "x-forwarded-for": "198.51.100.1" });
const phone = (sql, params, ip = "203.0.113.7") => call(sql, params, { "x-forwarded-for": ip });
const view = async (code, rev = 0, ip) => (await one(phone("select room_view($1, $2) as r", [code, rev], ip))).r;

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2)", [org, sha(KEY)]);
});
after(() => db?.close());

let code;

test("the PC opens a room and publishes the screen; a phone follows it", async () => {
  await assert.rejects(phone("select pc_room_open()"), /not connected/);
  code = (await one(pc("select pc_room_open(3) as r"))).r.code;
  assert.match(code, /^[A-Z0-9]{8}$/, "0028: codes have 8 characters");
  const empty = await view(code.toLowerCase());
  assert.equal(empty.status, "open");
  assert.equal(empty.team, "Grace Church");
  const screen = { v: 1, live: true, frame: "Romans 8", verse: { ref: "Romans 8:28", text: "And we know..." } };
  const rev = (await one(pc("select pc_room_publish($1::jsonb) as r", [JSON.stringify(screen)]))).r;
  const now = await view(code, empty.rev);
  assert.deepEqual(now.screen, screen);
  assert.equal(Number(now.rev), Number(rev));
  assert.deepEqual(await view(code, now.rev), { status: "open", rev: now.rev, same: true }, "nothing changed: a tiny answer");
});

test("notes are shared, kept with later screens, and taken back", async () => {
  const notes = { title: "Tuesday Bible Study", sections: [{ frame: "Romans 8", script: "God works for good." }] };
  await pc("select pc_room_publish($1::jsonb, $2::jsonb, true)", [JSON.stringify({ live: false }), JSON.stringify(notes)]);
  assert.deepEqual((await view(code)).notes, notes);
  await pc("select pc_room_publish($1::jsonb)", [JSON.stringify({ live: false, black: true })]);
  assert.deepEqual((await view(code)).notes, notes, "a new screen keeps the notes");
  await pc("select pc_room_publish($1::jsonb, null, true)", [JSON.stringify({ live: false })]);
  assert.equal((await view(code)).notes, null);
});

test("a phone can read nothing else, and cannot write", async () => {
  await assert.rejects(phone("select * from public.member_rooms"), /permission denied/);
  await assert.rejects(phone("select pc_room_publish('{}'::jsonb)"), /not connected/);
});

test("a new room replaces the old code; closing removes what it held", async () => {
  const fresh = (await one(pc("select pc_room_open() as r"))).r.code;
  assert.equal((await view(code)).status, "unknown");
  assert.deepEqual((await view(fresh)).screen, {});
  await pc("select pc_room_close()");
  assert.deepEqual(await view(fresh), { status: "closed" });
  await assert.rejects(pc("select pc_room_publish('{}'::jsonb)"), /closed/);
  const row = await one(db.query("select screen, notes from public.member_rooms"));
  assert.deepEqual([row.screen, row.notes], [{}, null]);
});

test("wrong codes are limited", async () => {
  for (let i = 0; i < 60; i++) await view(`QQQQ${i}`, 0, "192.0.2.88");
  await assert.rejects(view("QQQQQQ", 0, "192.0.2.88"), /Too many wrong codes/);
});

test("rollback removes 0020", async () => {
  // rollbacks run newest first: 0030 (who is here, hands, quiz, take-home), 0027 (rooms close when a PC is unlinked),
  // 0026 (typed answers), 0025 (slides) and 0022 (polls in the room) are built on this room
  await db.exec(readFileSync(new URL("../supabase/rollback/0030_meeting_together_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0028_codes_limits_retention_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0027_signoff_safe_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0026_room_answers_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0025_room_slides_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0022_room_polls_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0020_member_room_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select count(*)::int as n from pg_proc where proname like '%room%'")).rows[0].n, 0);
  assert.equal((await db.query("select to_regclass('public.member_rooms') as t")).rows[0].t, null);
});
