// 0030 (26.11.63 meeting together on members' phones): in an open members' room phones say they are here (a first name
// only if they wish), raise a hand and answer a timed quiz once each, with only the code (only a hash of the phone's own
// id is kept); only the church PC sees who is here, the hands and the answers, and the right answer reaches phones only
// once revealed; all of it goes when the room closes, times out or a new room opens; the take-home page stays for the
// days chosen (1 to 14) and members read it by the code after the room closed; prayer_send returns the request's id;
// wrong codes are limited; the rollback removes it all and puts prayer_send back as 0028.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000030a1";
const KEY = "pc-key-together-0123456789abcdef0123456789";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");
const short = (v) => sha(v).slice(0, 12);

let db;
let pcId;
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
const phone = (sql, params, ip = "203.0.113.30") => call(sql, params, { "x-forwarded-for": ip });
const r = async (p) => (await one(p)).r;

const view = (c) => r(phone("select room_view($1, 0) as r", [c]));
const checkin = (c, voter, name = null, ip = undefined) => r(phone("select room_checkin($1, $2, $3) as r", [c, voter, name], ip));
const hand = (c, voter, up, ip = undefined) => r(phone("select room_hand($1, $2, $3) as r", [c, voter, up], ip));
const quizView = (c, voter = null, ip = undefined) => r(phone("select room_quiz_view($1, $2) as r", [c, voter], ip));
const answer = (c, voter, quiz, choice, ip = undefined) =>
  r(phone("select room_quiz_answer($1, $2, $3, $4) as r", [c, voter, quiz, choice], ip));
const takehome = (c, ip = undefined) => r(phone("select room_takehome($1) as r", [c], ip));
const people = () => r(pc("select pc_room_people() as r"));
const results = () => r(pc("select pc_room_quiz_results() as r"));
const openQuiz = (question, options, correct, seconds = 20) =>
  r(pc("select pc_room_quiz_open($1, $2::jsonb, $3, $4) as r", [question, JSON.stringify(options), correct, seconds]));
const openRoom = async () => (await r(pc("select pc_room_open(3) as r"))).code;
const count = async (table) => (await one(db.query(`select count(*)::int as n from public.${table}`))).n;
const wrongCodes = async () => (await one(db.query("select count(*)::int as n from public.join_failures where who like 'net:%'"))).n;

const A = "phone-a-0123456789";
const B = "phone-b-0123456789";
const C = "phone-c-0123456789";

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  pcId = (await one(db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2) returning id", [org, sha(KEY)]))).id;
});
after(() => db?.close());

let code;

test("nothing works before members' phones are open, and only the PC's key opens the PC side", async () => {
  await assert.rejects(phone("select pc_room_people()"), /not connected/);
  await assert.rejects(phone("select pc_room_quiz_results()"), /not connected/);
  await assert.rejects(phone("select pc_takehome_publish('{}'::jsonb)"), /not connected/);
  assert.deepEqual(await people(), []);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah", "Moses"], 0), /Open members/);
  await assert.rejects(pc("select pc_takehome_publish('{\"v\":1}'::jsonb)"), /Open members/);
  code = await openRoom();
});

test("a phone checks in with a first name or none; the name is tidied and kept short", async () => {
  assert.deepEqual(await checkin(code.toLowerCase(), A, "  Ma\u0007ry  "), { status: "in" });
  assert.deepEqual(await checkin(code, B), { status: "in" });
  await assert.rejects(checkin(code, "short", "Sam"), /told apart/);
  const list = await people();
  assert.deepEqual(list.map((p) => [p.id, p.name, p.hand]), [[short(A), "Mary", null], [short(B), null, null]]);
  const joined = list[0].joined;
  assert.deepEqual(await checkin(code, A, "x".repeat(60)), { status: "in" });
  assert.deepEqual(await checkin(code, B, "   \u0007 "), { status: "in" });
  const again = await people();
  assert.equal(again[0].name, "x".repeat(40), "a long name is cut to 40");
  assert.equal(again[0].joined, joined, "checking in again keeps the time joined");
  assert.equal(again[1].name, null, "only spaces is no name");
  await checkin(code, A, "Mary");
  const stored = (await db.query("select voter_hash from public.room_people order by voter_hash")).rows.map((x) => x.voter_hash);
  assert.deepEqual(stored, [sha(A), sha(B)].sort(), "only a hash of each phone's id is kept");
});

test("hands go up and down; the PC lowers one hand or all of them", async () => {
  assert.deepEqual(await hand(code, C, true), { status: "in", hand: true }, "a phone that never checked in can raise a hand");
  assert.deepEqual(await hand(code, A, true), { status: "in", hand: true });
  let list = await people();
  assert.equal(list.length, 3);
  assert.equal(list.find((p) => p.id === short(C)).name, null);
  assert.ok(list.find((p) => p.id === short(A)).hand);
  assert.deepEqual(await hand(code, A, false), { status: "in", hand: false });
  assert.equal((await people()).find((p) => p.id === short(A)).hand, null);
  await hand(code, A, true);
  await hand(code, B, true);
  const rev = Number((await view(code)).rev);
  await pc("select pc_room_hand_down($1)", [short(A).toUpperCase()]);
  list = await people();
  assert.deepEqual(list.filter((p) => p.hand).map((p) => p.id).sort(), [short(B), short(C)].sort(), "only that hand goes down");
  assert.ok(Number((await view(code)).rev) > rev, "the room's rev moves");
  assert.deepEqual(await hand(code, A, null), { status: "in", hand: false }, "a phone can ask whether its hand is still up");
  assert.deepEqual(await hand(code, B, null), { status: "in", hand: true });
  assert.deepEqual(await hand(code, "never-joined-phone", null), { status: "in", hand: false }, "asking adds nobody");
  assert.equal((await people()).some((p) => p.id === short("never-joined-phone")), false);
  await pc("select pc_room_hand_down()");
  assert.equal((await people()).filter((p) => p.hand).length, 0, "every hand goes down");
});

test("pc_room_people lists only the open room", async () => {
  await db.query("insert into public.room_people (computer_id, voter_hash, joined_at) values ($1, $2, now() - interval '1 day')", [pcId, sha("before-the-room-0123")]);
  assert.equal((await people()).some((p) => p.id === short("before-the-room-0123")), false, "someone from before this room opened is not listed");
  await db.query("delete from public.room_people where voter_hash = $1", [sha("before-the-room-0123")]);
});

test("a quiz needs a question, 2 to 4 answers and the right answer; its time is kept between 5 and 120 seconds", async () => {
  await assert.rejects(openQuiz("  ", ["Noah", "Moses"], 0), /Type the question/);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah"], 0), /2 to 4 answers/);
  await assert.rejects(openQuiz("Who built the ark?", ["a", "b", "c", "d", "e"], 0), /2 to 4 answers/);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah", 7], 0), /2 to 4 answers/);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah", "  "], 0), /needs some words/);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah", "Moses"], 2), /right answer/);
  await assert.rejects(openQuiz("Who built the ark?", ["Noah", "Moses"], null), /right answer/);
  const secs = async () => Number((await one(db.query("select extract(epoch from closes_at - opened_at) as s from public.room_quiz"))).s);
  await openQuiz("Who built the ark?", ["Noah", "Moses"], 0, 1);
  assert.equal(await secs(), 5);
  await openQuiz("Who built the ark?", ["Noah", "Moses"], 0, 999);
  assert.equal(await secs(), 120);
});

let quiz;

test("phones answer once each; the right answer is hidden until revealed; the PC sees every answer with its time", async () => {
  const rev = Number((await view(code)).rev);
  quiz = await openQuiz("  Who led Israel\u0007 out of Egypt? ", [" Moses ", "Noah", "David"], 0);
  assert.ok(quiz.id && quiz.closesAt);
  assert.ok(Number((await view(code)).rev) > rev, "the room's rev moves so phones look again");
  const seen = await quizView(code, A);
  assert.equal(seen.status, "open");
  assert.equal(seen.quiz.id, quiz.id);
  assert.equal(seen.quiz.question, "Who led Israel  out of Egypt?");
  assert.deepEqual(seen.quiz.options, ["Moses", "Noah", "David"]);
  assert.equal(seen.quiz.revealed, false);
  assert.equal(seen.quiz.mine, null);
  assert.equal("correct" in seen.quiz, false, "the right answer never reaches a phone before it is revealed");

  assert.deepEqual(await answer(code, A, quiz.id, 0), { status: "in" });
  assert.deepEqual(await answer(code, A, quiz.id, 1), { status: "already" }, "no changing an answer");
  assert.deepEqual(await answer(code, B, "00000000-0000-0000-0000-000000000000", 1), { status: "changed" });
  await assert.rejects(answer(code, B, quiz.id, 3), /Choose one of the answers/);
  await assert.rejects(answer(code, "short", quiz.id, 1), /told apart/);
  assert.equal((await quizView(code, A)).quiz.mine, 0);

  await db.query("update public.member_rooms set opened_at = opened_at - interval '1 minute'");
  await db.query("update public.room_quiz set opened_at = opened_at - interval '3 seconds'");
  assert.deepEqual(await answer(code, B, quiz.id, 1), { status: "in" });
  const res = await results();
  assert.deepEqual([res.id, res.correct, res.revealed, res.question], [quiz.id, 0, false, "Who led Israel  out of Egypt?"]);
  assert.deepEqual(res.answers.map((a) => [a.id, a.choice]), [[short(A), 0], [short(B), 1]], "fastest first");
  for (const a of res.answers) assert.ok(Number.isInteger(a.ms) && a.ms >= 0);
  assert.ok(res.answers[1].ms >= 3000, "the time is counted by the server from when the quiz opened");

  const before = Number((await view(code)).rev);
  await pc("select pc_room_quiz_reveal()");
  assert.ok(Number((await view(code)).rev) > before);
  const shown = (await quizView(code, B)).quiz;
  assert.deepEqual([shown.revealed, shown.correct, shown.mine], [true, 0, 1]);
  assert.ok(new Date(shown.closesAt) <= new Date());
  assert.deepEqual(await answer(code, C, quiz.id, 0), { status: "late" }, "late once the answer is shown");
  assert.equal((await results()).revealed, true);
});

test("an answer after the time runs out is late; closing the quiz takes it off phones", async () => {
  const q = await openQuiz("Third day?", ["Yes", "No"], 0);
  assert.equal((await results()).answers.length, 0, "a new quiz starts with no answers");
  assert.equal(await count("room_quiz_answers"), 0, "the last quiz's answers went");
  await db.query("update public.room_quiz set closes_at = now() - interval '1 second'");
  assert.deepEqual(await answer(code, A, q.id, 0), { status: "late" });
  await pc("select pc_room_quiz_close()");
  assert.equal(await results(), null);
  assert.deepEqual(await quizView(code), { status: "open", quiz: null });
  assert.deepEqual(await answer(code, A, q.id, 0), { status: "closed" });
});

test("closing the room takes who was here and the quiz with it", async () => {
  const q = await openQuiz("Ready?", ["Yes", "No"], 0);
  await answer(code, A, q.id, 0);
  await hand(code, A, true);
  await pc("select pc_room_close()");
  assert.deepEqual([await count("room_people"), await count("room_quiz"), await count("room_quiz_answers")], [0, 0, 0]);
  assert.deepEqual(await people(), []);
  assert.deepEqual(await checkin(code, A, "Mary"), { status: "closed" });
  assert.deepEqual(await hand(code, A, true), { status: "closed" });
  assert.deepEqual(await quizView(code), { status: "closed" });
});

test("a room that times out is cleared by the sweep", async () => {
  code = await openRoom();
  await checkin(code, A, "Mary");
  await openQuiz("Ready?", ["Yes", "No"], 0);
  await db.query("update public.member_rooms set closes_at = now() - interval '1 minute'");
  assert.deepEqual(await checkin(code, B), { status: "closed" }, "a timed-out room takes no one in");
  assert.deepEqual(await people(), []);
  await db.query("select public.members_phones_sweep()");
  assert.deepEqual([await count("room_people"), await count("room_quiz")], [0, 0]);
});

test("a new room starts with no one and no quiz; the old code stops working", async () => {
  const old = await openRoom();
  await checkin(old, A, "Mary");
  await openQuiz("Ready?", ["Yes", "No"], 0);
  code = await openRoom();
  assert.deepEqual([await count("room_people"), await count("room_quiz")], [0, 0]);
  assert.deepEqual(await people(), []);
  assert.deepEqual(await checkin(old, A, "Mary", "192.0.2.31"), { status: "unknown" });
});

test("the take-home page: published by the PC, read by the code after the room closed, gone when it runs out", async () => {
  const body = { v: 1, meeting: "Bible study", date: "2026-11-18", verses: [{ ref: "John 3:16", text: "For God so loved", version: "KJV" }],
    questions: ["What stood out?"], songs: [], prayers: [], answered: [], status: {} };
  await assert.rejects(pc("select pc_takehome_publish('[1]'::jsonb)"), /empty/);
  await assert.rejects(pc("select pc_takehome_publish($1::jsonb)", [JSON.stringify({ v: 1, notes: "x".repeat(70000) })]), /too long/);
  const rev = Number((await view(code)).rev);
  const days = async () => Number((await one(db.query("select round(extract(epoch from expires_at - published_at) / 86400) as d from public.room_takehome"))).d);
  await pc("select pc_takehome_publish($1::jsonb, 0)", [JSON.stringify(body)]);
  assert.equal(await days(), 1);
  const pub = await r(pc("select pc_takehome_publish($1::jsonb, 30) as r", [JSON.stringify(body)]));
  assert.equal(await days(), 14, "kept at most 14 days");
  assert.ok(pub.expiresAt);
  assert.equal(await count("room_takehome"), 1, "one page per PC");
  assert.ok(Number((await view(code)).rev) > rev, "the room's rev moves while it is open");
  const read = await takehome(code.toLowerCase());
  assert.deepEqual([read.status, read.body], ["ok", body]);

  await pc("select pc_room_close()");
  assert.equal((await takehome(code)).status, "ok", "members read it during the week, after the room closed");
  await pc("select pc_takehome_publish($1::jsonb)", [JSON.stringify({ ...body, note: "See you Sunday" })]);
  assert.equal((await takehome(code)).body.note, "See you Sunday", "a closed room's PC can still publish it");

  const counted = await wrongCodes();
  assert.deepEqual(await takehome("QQQQQQQQ", "192.0.2.32"), { status: "none" });
  assert.ok((await wrongCodes()) > counted, "an unknown code counts as a wrong code");

  await db.query("update public.room_takehome set expires_at = now() - interval '1 second'");
  const before = await wrongCodes();
  assert.deepEqual(await takehome(code), { status: "none" }, "a page that ran out is not returned");
  assert.equal(await count("room_takehome"), 0, "and it is removed");
  assert.equal(await wrongCodes(), before, "the room's own code is not a wrong code");

  await pc("select pc_takehome_publish($1::jsonb)", [JSON.stringify(body)]);
  await pc("select pc_takehome_remove()");
  assert.deepEqual(await takehome(code), { status: "none" });
});

test("prayer_send returns the request's id, the one the PC takes in", async () => {
  const wall = (await r(pc("select pc_prayer_open(3) as r"))).code;
  const sent = await r(phone("select prayer_send($1, $2, $3) as r", [wall, "Pray for my mother", "Mary"]));
  assert.equal(sent.sent, true);
  assert.match(sent.id, /^[0-9a-f-]{36}$/);
  const taken = (await pc("select * from pc_prayer_take()")).rows;
  assert.deepEqual(taken.map((t) => t.id), [sent.id]);
  assert.deepEqual(await r(phone("select prayer_send('QQQQQQQQ', 'Hello') as r", [], "192.0.2.33")), { sent: false, status: "closed" });
});

test("a phone cannot touch the tables directly", async () => {
  for (const t of ["room_people", "room_quiz", "room_quiz_answers", "room_takehome"]) {
    await assert.rejects(phone(`select * from public.${t}`), /permission denied/, t);
    await assert.rejects(call(`select * from public.${t}`, [], { "x-framedecks-computer": KEY }), /permission denied/, t);
    const rls = (await one(db.query("select relrowsecurity as on from pg_class where relname = $1", [t]))).on;
    assert.equal(rls, true, `${t} has row level security`);
  }
  await assert.rejects(phone("insert into public.room_people (computer_id, voter_hash) values ($1, $2)", [pcId, sha(A)]), /permission denied/);
  await assert.rejects(phone("select room_together_forget()"), /permission denied/);
});

test("a room takes at most 300 people", async () => {
  code = await openRoom();
  await checkin(code, A, "Mary");
  await db.query(`insert into public.room_people (computer_id, voter_hash)
    select $1, encode(sha256(('filler-' || i)::bytea), 'hex') from generate_series(1, 299) i`, [pcId]);
  await assert.rejects(checkin(code, B), /This meeting is full/);
  await assert.rejects(hand(code, B, true), /This meeting is full/);
  assert.deepEqual(await checkin(code, A, "Mary Ann"), { status: "in" }, "someone already here can still check in again");
  assert.deepEqual(await hand(code, A, true), { status: "in", hand: true });
  assert.equal((await people()).length, 300);
});

test("wrong codes are limited", async () => {
  const ip = "192.0.2.98";
  assert.deepEqual(await checkin("QQQQQQQQ", A, null, ip), { status: "unknown" });
  assert.deepEqual(await hand("QQQQQQQQ", A, true, ip), { status: "unknown" });
  assert.deepEqual(await quizView("QQQQQQQQ", null, ip), { status: "unknown" });
  assert.deepEqual(await answer("QQQQQQQQ", A, null, 0, ip), { status: "unknown" });
  for (let i = 0; i < 60; i++) await quizView(`QQQQQQ${i}`, null, ip).catch(() => null);
  await assert.rejects(checkin("QQQQQQQQ", A, null, ip), /Too many wrong codes/);
  await assert.rejects(takehome("QQQQQQQQ", ip), /Too many wrong codes/);
  assert.deepEqual(await checkin(code, A, "Mary", ip), { status: "in" }, "the right code still works from the same network");
});

test("rollback removes 0030 and puts prayer_send back as 0028", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0030_meeting_together_down.sql", import.meta.url), "utf8"));
  const left = await db.query(`select count(*)::int as n from pg_proc where proname in ('pc_room_people', 'pc_room_hand_down',
    'pc_room_quiz_open', 'pc_room_quiz_reveal', 'pc_room_quiz_close', 'pc_room_quiz_results', 'pc_takehome_publish',
    'pc_takehome_remove', 'room_checkin', 'room_hand', 'room_quiz_view', 'room_quiz_answer', 'room_takehome', 'room_together_forget')`);
  assert.equal(left.rows[0].n, 0);
  for (const t of ["room_people", "room_quiz", "room_quiz_answers", "room_takehome"]) {
    assert.equal((await one(db.query("select to_regclass($1) as t", [`public.${t}`]))).t, null, t);
  }
  assert.notEqual((await one(db.query("select to_regclass('public.member_rooms') as t"))).t, null);
  const wall = (await r(pc("select pc_prayer_open(3) as r"))).code;
  assert.deepEqual(await r(phone("select prayer_send($1, 'Pray for peace') as r", [wall], "203.0.113.99")), { sent: true });
  await pc("select pc_room_close()");
});
