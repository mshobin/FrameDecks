// 0026 (26.11.57 typed answers from members' phones): in an open members' room the church PC asks people to type a short
// answer; phones read the prompt with only the code and send one answer each (only a hash of the phone's own id is
// kept), changing it while the prompt is open; only the PC reads the answers; wrong codes are limited; a new room never
// shows an old prompt; the rollback removes it all and members' phones (0020) keep working.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000026a1";
const KEY = "pc-key-answers-0123456789abcdef0123456789a";
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
const phone = (sql, params, ip = "203.0.113.26") => call(sql, params, { "x-forwarded-for": ip });
const view = async (c) => (await one(phone("select room_view($1, 0) as r", [c]))).r;
const look = async (code, voter = null, ip = undefined) => (await one(phone("select room_prompt($1, $2) as r", [code, voter], ip))).r;
const send = async (code, voter, body, prompt = null, ip = undefined) =>
  (await one(phone("select room_answer($1, $2, $3, $4) as r", [code, voter, body, prompt], ip))).r;
const ask = async (prompt) => (await one(pc("select pc_room_answers_open($1) as r", [prompt]))).r;
const list = async () => (await one(pc("select pc_room_answers_list() as r"))).r;

const A = "phone-a-0123456789";
const B = "phone-b-0123456789";

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2)", [org, sha(KEY)]);
});
after(() => db?.close());

let code;

test("a prompt needs an open room, the PC's key and some words", async () => {
  await assert.rejects(phone("select pc_room_answers_open('What stood out?')"), /not connected/);
  await assert.rejects(ask("What stood out?"), /Open members/);
  code = (await one(pc("select pc_room_open(3) as r"))).r.code;
  assert.deepEqual(await look(code), { status: "open", prompt: null });
  assert.equal(await list(), null);
  await assert.rejects(ask("   "), /Type what people/);
});

test("phones answer once each, change their answer, and only the PC reads them", async () => {
  const roomRev = (await view(code)).rev;
  const p = await ask("  What stood out to you?\n");
  assert.equal(p.prompt, "What stood out to you?");
  assert.ok(Number((await view(code)).rev) > Number(roomRev), "the room's rev moves so phones look again");
  const seen = await look(code.toLowerCase(), A);
  assert.deepEqual(seen.prompt, { id: p.id, text: "What stood out to you?", mine: null });
  assert.deepEqual(await send(code, A, "Grace is a gift", p.id), { status: "in" });
  assert.deepEqual(await send(code, B, "  Psalm 23\u0007 comforts me "), { status: "in" });
  assert.deepEqual(await send(code, A, "Grace is free"), { status: "in" }, "a phone changes its answer");
  assert.equal((await look(code, A)).prompt.mine, "Grace is free");
  const l = await list();
  assert.equal(l.open, true);
  assert.deepEqual(l.answers.map((a) => a.body).sort(), ["Grace is free", "Psalm 23  comforts me"], "a control character becomes a space");
  const stored = (await db.query("select voter_hash from public.room_answers order by voter_hash")).rows.map((x) => x.voter_hash);
  assert.deepEqual(stored, [sha(A), sha(B)].sort(), "only a hash of each phone's id is kept");
});

test("bad answers are refused", async () => {
  await assert.rejects(send(code, A, "   "), /Type your answer/);
  await assert.rejects(send(code, "short", "Hi"), /told apart/);
  assert.deepEqual(await send(code, A, "x", "00000000-0000-0000-0000-000000000000"), { status: "changed" });
  await send(code, A, "y".repeat(400));
  assert.equal((await look(code, A)).prompt.mine.length, 280, "a long answer is cut to 280");
});

test("closing stops answers and keeps them for the leader; a new prompt starts empty", async () => {
  await pc("select pc_room_answers_close()");
  assert.equal((await look(code)).prompt, null);
  assert.deepEqual(await send(code, B, "late"), { status: "closed" });
  const l = await list();
  assert.deepEqual([l.open, l.answers.length], [false, 2]);
  await ask("x".repeat(300));
  const fresh = await list();
  assert.deepEqual([fresh.prompt.length, fresh.answers.length], [200, 0]);
});

test("a phone can read nothing else, and cannot write", async () => {
  await assert.rejects(phone("select * from public.room_answers"), /permission denied/);
  await assert.rejects(phone("select * from public.room_answer_prompts"), /permission denied/);
  await assert.rejects(phone("select pc_room_answers_list()"), /not connected/);
  await assert.rejects(phone("select pc_room_answers_close()"), /not connected/);
  for (const t of ["room_answers", "room_answer_prompts"]) {
    const rls = (await one(db.query("select relrowsecurity as on from pg_class where relname = $1", [t]))).on;
    assert.equal(rls, true, `${t} has row level security`);
  }
});

test("a new room never shows an old prompt; a closed room shows nothing", async () => {
  await ask("Still here?");
  const fresh = (await one(pc("select pc_room_open() as r"))).r.code;
  assert.equal((await look(fresh)).prompt, null);
  assert.deepEqual(await send(fresh, A, "hi"), { status: "closed" });
  await pc("select pc_room_close()");
  assert.deepEqual(await look(fresh), { status: "closed" });
});

test("wrong codes are limited", async () => {
  assert.deepEqual(await look("QQQQQQ", null, "192.0.2.98"), { status: "unknown" });
  assert.deepEqual(await send("QQQQQQ", A, "x", null, "192.0.2.98"), { status: "unknown" });
  for (let i = 0; i < 60; i++) await look(`QQQQ${i}`, null, "192.0.2.98").catch(() => null);
  await assert.rejects(look("QQQQQQ", null, "192.0.2.98"), /Too many wrong codes/);
  await assert.rejects(send("QQQQQQ", A, "x", null, "192.0.2.98"), /Too many wrong codes/);
});

test("rollback removes 0026 and leaves 0020", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0026_room_answers_down.sql", import.meta.url), "utf8"));
  const left = await db.query("select count(*)::int as n from pg_proc where proname in ('pc_room_answers_open', 'pc_room_answers_close', 'pc_room_answers_list', 'room_prompt', 'room_answer', 'room_open_prompt')");
  assert.equal(left.rows[0].n, 0);
  assert.equal((await db.query("select to_regclass('public.room_answers') as t")).rows[0].t, null);
  assert.notEqual((await db.query("select to_regclass('public.member_rooms') as t")).rows[0].t, null);
});
