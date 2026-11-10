// 0022 (26.11.33 Quick responses and polls): in an open members' room the church PC asks one thing at a time (Yes / No,
// a poll of 2 to 6 answers, or a rating 1 to 5); phones read it with only the code and answer once each (only a hash of
// the phone's own id is kept), changing their answer while it is open; the counts reach phones only when the leader
// shows the results; wrong codes are limited; a new room never shows an old question; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000002c2";
const KEY = "pc-key-poll-0123456789abcdef0123456789abcd";
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
const view = async (c) => (await one(phone("select room_view($1, 0) as r", [c]))).r;
const look = async (code, rev = 0, voter = null, ip = undefined) =>
  (await one(phone("select room_response($1, $2, $3) as r", [code, rev, voter], ip))).r;
const answer = async (code, voter, choice, response = null, ip = undefined) =>
  (await one(phone("select room_respond($1, $2, $3, $4) as r", [code, voter, choice, response], ip))).r;
const results = async () => (await one(pc("select pc_room_response_results() as r"))).r;
const ask = async (question, kind, options = null, show = false) =>
  (await one(pc("select pc_room_response_open($1, $2, $3::jsonb, $4) as r", [question, kind, options && JSON.stringify(options), show]))).r;

const A = "phone-a-0123456789";
const B = "phone-b-0123456789";
const C = "phone-c-0123456789";

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2)", [org, sha(KEY)]);
});
after(() => db?.close());

let code;

test("a question needs an open room, and the PC's key", async () => {
  await assert.rejects(phone("select pc_room_response_open('Ready?', 'yesno')"), /not connected/);
  await assert.rejects(ask("Ready?", "yesno"), /Open members/);
  code = (await one(pc("select pc_room_open(3) as r"))).r.code;
  assert.deepEqual(await look(code), { status: "open", rev: 0, response: null });
  assert.equal(await results(), null);
});

test("Yes / No: phones answer once each, change their answer, and see no counts unless shown", async () => {
  const roomRev = (await view(code)).rev;
  const r = await ask("  Did this help you?\n", "yesno");
  assert.equal(r.question, "Did this help you?");
  assert.deepEqual(r.options, ["Yes", "No"]);
  assert.ok(Number((await view(code)).rev) > Number(roomRev), "the room's rev moves so phones look again");
  const seen = await look(code.toLowerCase(), 0, A);
  assert.equal(seen.response.question, "Did this help you?");
  assert.equal(seen.response.mine, null);
  assert.equal(seen.response.counts, undefined, "results are not shown");
  assert.deepEqual(await answer(code, A, 0, r.id), { status: "in", choice: 0 });
  assert.deepEqual(await answer(code, B, 0), { status: "in", choice: 0 });
  assert.deepEqual(await answer(code, A, 1), { status: "in", choice: 1 }, "a phone changes its answer");
  assert.equal((await look(code, 0, A)).response.mine, 1);
  assert.deepEqual(await look(code, seen.rev), { status: "open", rev: seen.rev, same: true }, "results hidden: votes change nothing phones see");
  const res = await results();
  assert.deepEqual([res.counts, res.total, res.open], [[1, 1], 2, true]);
  const stored = (await db.query("select voter_hash from public.room_votes order by voter_hash")).rows.map((x) => x.voter_hash);
  assert.deepEqual(stored, [sha(A), sha(B)].sort(), "only a hash of each phone's id is kept");
});

test("bad answers are refused", async () => {
  await assert.rejects(answer(code, C, 2), /Choose one of the answers/);
  await assert.rejects(answer(code, C, -1), /Choose one of the answers/);
  await assert.rejects(answer(code, "short", 0), /told apart/);
  assert.deepEqual(await answer(code, C, 0, "00000000-0000-0000-0000-000000000000"), { status: "changed" });
});

test("questions are checked and limited", async () => {
  await assert.rejects(ask("Which song?", "poll", ["Only one"]), /2 to 6 answers/);
  await assert.rejects(ask("Which song?", "poll", ["a", "b", "c", "d", "e", "f", "g"]), /2 to 6 answers/);
  await assert.rejects(ask("Which song?", "poll"), /needs its answers/);
  await assert.rejects(ask("   ", "yesno"), /Type the question/);
  await assert.rejects(ask("Hm?", "essay"), /Choose Yes/);
  const long = await ask("x".repeat(300), "poll", ["y".repeat(100), "z"]);
  assert.equal(long.question.length, 200, "a long question is cut to 200");
  assert.equal(long.options[0].length, 60, "a long answer is cut to 60");
});

test("a poll with shown results: counts reach phones and the bars move", async () => {
  const r = await ask("Which song next?", "poll", [" Amazing Grace ", "", "How Great Thou Art", "In Christ Alone"], true);
  assert.equal(r.kind, "choice", "a poll is a choice");
  assert.deepEqual(r.options, ["Amazing Grace", "How Great Thou Art", "In Christ Alone"]);
  assert.equal((await results()).total, 0, "the last question's answers went with it");
  const first = await look(code);
  assert.deepEqual([first.response.counts, first.response.total, first.response.showResults], [[0, 0, 0], 0, true]);
  await answer(code, A, 2);
  await answer(code, B, 2);
  await answer(code, C, 0);
  const now = await look(code, first.rev);
  assert.ok(Number(now.rev) > Number(first.rev));
  assert.deepEqual([now.response.counts, now.response.total], [[1, 0, 2], 3]);
});

test("a rating from 1 to 5; closing stops answers and keeps the counts for the leader", async () => {
  const r = await ask("How was today?", "rating");
  assert.deepEqual(r.options, ["1", "2", "3", "4", "5"]);
  await answer(code, A, 4);
  await answer(code, B, 3);
  const was = await look(code);
  await pc("select pc_room_response_close()");
  const now = await look(code, was.rev);
  assert.deepEqual([now.status, now.response], ["open", null]);
  assert.deepEqual(await answer(code, C, 4), { status: "closed" });
  const res = await results();
  assert.deepEqual([res.open, res.counts, res.total], [false, [0, 0, 0, 1, 1], 2]);
});

test("a phone can read nothing else, and cannot write", async () => {
  await assert.rejects(phone("select * from public.room_responses"), /permission denied/);
  await assert.rejects(phone("select * from public.room_votes"), /permission denied/);
  await assert.rejects(phone("insert into public.room_votes values (gen_random_uuid(), $1, 0)", [sha(A)]), /permission denied/);
  await assert.rejects(phone("select pc_room_response_results()"), /not connected/);
  await assert.rejects(phone("select pc_room_response_close()"), /not connected/);
  for (const t of ["room_responses", "room_votes"]) {
    const rls = (await one(db.query("select relrowsecurity as on from pg_class where relname = $1", [t]))).on;
    assert.equal(rls, true, `${t} has row level security`);
  }
});

test("a new room never shows an old question; a closed room shows nothing", async () => {
  await ask("Still here?", "yesno");
  const fresh = (await one(pc("select pc_room_open() as r"))).r.code;
  assert.equal((await look(fresh)).response, null);
  assert.equal((await results()).open, false);
  await pc("select pc_room_close()");
  assert.deepEqual(await look(fresh), { status: "closed" });
  assert.deepEqual(await answer(fresh, A, 0), { status: "closed" });
});

test("wrong codes are limited", async () => {
  assert.deepEqual(await look("QQQQQQ", 0, null, "192.0.2.99"), { status: "unknown" });
  assert.deepEqual(await answer("QQQQQQ", A, 0, null, "192.0.2.99"), { status: "unknown" });
  for (let i = 0; i < 60; i++) await look(`QQQQ${i}`, 0, null, "192.0.2.99").catch(() => null);
  await assert.rejects(look("QQQQQQ", 0, null, "192.0.2.99"), /Too many wrong codes/);
  await assert.rejects(answer("QQQQQQ", A, 0, null, "192.0.2.99"), /Too many wrong codes/);
});

test("rollback removes 0022 and leaves 0020", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0022_room_polls_down.sql", import.meta.url), "utf8"));
  const left = await db.query("select count(*)::int as n from pg_proc where proname like '%room_response%' or proname = 'room_respond' or proname = 'room_open_response'");
  assert.equal(left.rows[0].n, 0);
  assert.equal((await db.query("select to_regclass('public.room_votes') as t")).rows[0].t, null);
  assert.equal((await db.query("select to_regclass('public.room_responses') as t")).rows[0].t, null);
  assert.notEqual((await db.query("select to_regclass('public.member_rooms') as t")).rows[0].t, null);
});
