// 0025 (26.11.48 the slides on members' phones): while a room is open the church PC sends each slide it shows (a sharp
// picture, its title and words); phones read the list of slides shown so far and one slide's picture with only the
// code; wrong codes are limited; the slides go when the room closes or a new room opens; only the PC writes; the
// picture must be a JPEG data URL; the rollback removes it all and members' phones (0020) keep working.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000025a1";
const KEY = "pc-key-slides-0123456789abcdef0123456789ab";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/";

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
const phone = (sql, params, ip = "203.0.113.25") => call(sql, params, { "x-forwarded-for": ip });
const send = (page, title, body, img = null) => pc("select pc_room_slide($1, $2, $3, $4)", [page, title, body, img]);
const list = async (code, ip) => (await one(phone("select room_slides($1) as r", [code], ip))).r;
const slide = async (code, page, ip) => (await one(phone("select room_slide($1, $2) as r", [code, page], ip))).r;

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2)", [org, sha(KEY)]);
});
after(() => db?.close());

let code;

test("a slide needs an open room and the PC's key", async () => {
  await assert.rejects(phone("select pc_room_slide(0, 'A', '', null)"), /not connected/);
  await assert.rejects(send(0, "Welcome", ""), /room is closed/);
  code = (await one(pc("select pc_room_open(3) as r"))).r.code;
  assert.deepEqual(await list(code), { status: "open", slides: [] });
});

test("slides shown reach phones: the list without pictures, one slide with its picture", async () => {
  await send(2, "The Good Shepherd", "John 10:11", JPEG);
  await send(0, "Welcome", "Good morning", JPEG);
  const l = await list(code.toLowerCase());
  assert.deepEqual(l.slides.map((s) => [s.page, s.title, s.img]), [[0, "Welcome", true], [2, "The Good Shepherd", true]]);
  const s = await slide(code, 2);
  assert.equal(s.img, JPEG);
  assert.equal(s.body, "John 10:11");
  assert.deepEqual(await slide(code, 1), { status: "none" }, "a slide never shown is not there");
  await send(2, "The Good Shepherd", "John 10:11, 14");
  assert.equal((await slide(code, 2)).img, JPEG, "sent again without a picture keeps the picture");
});

test("only a JPEG picture is kept, and only a few hundred slides", async () => {
  await assert.rejects(send(3, "x", "", "data:image/png;base64,AAAA"), /check/);
  await assert.rejects(send(3, "x", "", "<script>"), /check/);
  await send(4, "x".repeat(500), "y".repeat(2000));
  const s = await slide(code, 4);
  assert.equal(s.title.length, 120);
  assert.equal(s.body.length, 600);
});

test("wrong codes are limited and learn nothing", async () => {
  assert.deepEqual(await list("ZZZZZZ", "203.0.113.99"), { status: "unknown" });
  assert.deepEqual(await slide("ZZZZZZ", 0, "203.0.113.99"), { status: "unknown" });
});

test("the slides go when the room closes, and a new room starts empty", async () => {
  await pc("select pc_room_close()");
  assert.deepEqual(await list(code), { status: "unknown" });
  assert.equal((await one(db.query("select count(*)::int as n from public.room_slides"))).n, 0);
  const again = (await one(pc("select pc_room_open(3) as r"))).r.code;
  assert.deepEqual((await list(again)).slides, []);
  await send(0, "Welcome", "", JPEG);
  await pc("select pc_room_open(3)");                    // a new code: the old room's slides go
  assert.equal((await one(db.query("select count(*)::int as n from public.room_slides"))).n, 0);
});

test("phones and the anon role cannot touch the table itself", async () => {
  await assert.rejects(phone("select * from public.room_slides"), /permission denied/);
  await assert.rejects(phone("select room_by_code('AAAAAA')"), /permission denied/);
});

test("the rollback removes it and members' phones keep working", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0025_room_slides_down.sql", import.meta.url), "utf8"));
  const left = await one(db.query("select to_regclass('public.room_slides') as t, to_regprocedure('public.room_slide(text,integer)') as f"));
  assert.deepEqual([left.t, left.f], [null, null]);
  const c = (await one(pc("select pc_room_open(3) as r"))).r.code;
  await pc("select pc_room_publish($1::jsonb)", [JSON.stringify({ v: 1, live: true, frame: "Welcome" })]);
  assert.equal((await one(phone("select room_view($1, 0) as r", [c]))).r.screen.frame, "Welcome");
});
