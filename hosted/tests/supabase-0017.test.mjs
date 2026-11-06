// 0017 (26.11.4 "Was this helpful?"): anyone may vote through help_vote, only the article and the vote are kept,
// nobody can read or write the table directly, a bad article name is refused, and the rollback removes it all.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000000f1";
let db, as;

async function anon(sql, params) {
  await db.exec("set role anon; select set_config('request.uid', '', false)");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

before(async () => {
  ({ db, as } = await supabaseStandIn({ [ANA]: "ana@x.org" }));
});
after(async () => db?.close());

test("anyone can vote, and only the article and the vote are kept", async () => {
  assert.equal((await anon("select public.help_vote('docs/remote-control#if-the-phone-cant-connect', false) as ok")).rows[0].ok, true);
  assert.equal((await as(ANA, "select public.help_vote('help#codes', true) as ok")).rows[0].ok, true);
  const cols = (await db.query("select column_name from information_schema.columns where table_name = 'help_votes' order by ordinal_position")).rows.map((r) => r.column_name);
  assert.deepEqual(cols, ["id", "article", "helpful", "created_at"]);
  assert.equal((await db.query("select count(*)::int as n from public.help_votes")).rows[0].n, 2);
});

test("nobody reads or writes the votes directly", async () => {
  await assert.rejects(anon("select * from public.help_votes"));
  await assert.rejects(as(ANA, "select * from public.help_votes"));
  await assert.rejects(anon("insert into public.help_votes (article, helpful) values ('x', true)"));
});

test("a name that is not a Help article is refused", async () => {
  await assert.rejects(anon("select public.help_vote('<script>', true)"), /Not a Help article/);
  await assert.rejects(anon("select public.help_vote($1, true)", ["x".repeat(200)]), /Not a Help article/);
});

test("the rollback removes it all", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0017_help_votes_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regclass('public.help_votes') as t")).rows[0].t, null);
});
