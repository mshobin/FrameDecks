// 0014 (production audit M6, L11, L13, and handing a team on): link codes are limited per network, an idle PC's
// command check writes nothing, deleting an account leaves no name or id on commands and synced records, and the
// owner can hand a team to another member. The rollback restores 0003 / 0004 / 0011.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000000d1";
const ADMIN = "00000000-0000-0000-0000-0000000000d2";
const MEMBER = "00000000-0000-0000-0000-0000000000d3";

let db, as, denied, org, pc;
const key = randomBytes(32).toString("base64url");
const hash = (k) => createHash("sha256").update(k, "utf8").digest("hex");
const role = async (uid) =>
  (await db.query("select role from memberships where organization_id = $1 and user_id = $2", [org, uid])).rows[0]?.role;

async function anonWith(headers, sql, params) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const linkFrom = (ip) => anonWith({ "x-forwarded-for": `${ip}, 10.0.0.1` }, "select computer_link_start('PC', $1) as c",
  [hash(randomBytes(16).toString("hex"))]);
const take = () => anonWith({ "x-framedecks-computer": key }, "select remote_take() as r").then((r) => r.rows[0].r);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({ [OWNER]: "o@x.org", [ADMIN]: "a@x.org", [MEMBER]: "m@x.org" }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Team', $1) returning id", [OWNER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')", [org, ADMIN, MEMBER]);
  pc = (await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'PC', $2) returning id", [org, hash(key)])).rows[0].id;
});

after(() => db?.close());

test("M6: one network holds at most 5 waiting link codes; others still link", async () => {
  for (let i = 0; i < 5; i++) assert.match((await linkFrom("203.0.113.7")).rows[0].c, /^[A-HJ-NP-Z2-9]{8}$/);
  await assert.rejects(linkFrom("203.0.113.7"), /Too many link codes/);
  assert.match((await linkFrom("198.51.100.9")).rows[0].c, /^[A-HJ-NP-Z2-9]{8}$/, "another network is not blocked");
  // codes expire after 10 minutes, and then the network may ask again
  await db.query("update computer_links set expires_at = now() - interval '1 minute' where organization_id is null");
  assert.ok((await linkFrom("203.0.113.7")).rows[0].c);
  const stored = (await db.query("select source_hash from computer_links where source_hash is not null limit 1")).rows[0].source_hash;
  assert.match(stored, /^[0-9a-f]{64}$/, "the address is kept only as a hash");
  assert.ok(!(await db.query("select count(*)::int as n from computer_links where source_hash like '%203.0%'")).rows[0].n);
});

test("L13: an idle check writes nothing; a waiting command is still taken", async () => {
  await as(OWNER, "select remote_send($1, 'next')", [pc]);
  assert.equal((await take()).length, 1);
  await db.query("insert into remote_commands(organization_id, computer_id, op, sent_by_name, created_at, taken_at) values ($1, $2, 'next', 'x', now() - interval '8 days', now() - interval '8 days')", [org, pc]);
  const before = (await db.query("select count(*)::int as n, max(xmin::text) as x from remote_commands")).rows[0];
  assert.deepEqual(await take(), []);
  const afterIdle = (await db.query("select count(*)::int as n, max(xmin::text) as x from remote_commands")).rows[0];
  assert.deepEqual(afterIdle, before, "no row changed or removed");
  await as(OWNER, "select remote_send($1, 'previous')", [pc]);
  const got = await take();
  assert.equal(got[0].op, "previous");
  assert.equal((await db.query("select count(*)::int as n from remote_commands where created_at < now() - interval '7 days'")).rows[0].n, 0,
    "week-old commands are cleared when there is work");
});

test("handing a team on: only the owner, only to a member; the old owner stays an admin", async () => {
  assert.ok(await denied(ADMIN, "select transfer_ownership($1, $2)", [org, ADMIN]));
  assert.ok(await denied(OWNER, "select transfer_ownership($1, $2)", [org, "00000000-0000-0000-0000-0000000000ff"]));
  await as(OWNER, "select transfer_ownership($1, $2)", [org, ADMIN]);
  assert.equal(await role(ADMIN), "owner");
  assert.equal(await role(OWNER), "admin");
  assert.equal((await db.query("select created_by from organizations where id = $1", [org])).rows[0].created_by, ADMIN);
  await as(ADMIN, "select transfer_ownership($1, $2)", [org, OWNER]);          // and back
  assert.equal(await role(OWNER), "owner");
});

test("L11: deleting an account clears its name on commands and its id on synced records", async () => {
  await as(MEMBER, "select 1");
  await db.query("update memberships set can_run_services = true where user_id = $1", [MEMBER]);
  await as(MEMBER, "select remote_send($1, 'hide_all')", [pc]);
  await db.query(`insert into entities(organization_id, kind, id, rev, seq, deleted, body, updated_by, updated_at)
                  values ($1, 'frame', 'f1', 1, 1, false, '{}'::jsonb, $2, now())`, [org, `user:${MEMBER}`]);
  await db.query(`insert into entity_history(organization_id, kind, id, rev, deleted, body, updated_by)
                  values ($1, 'frame', 'f1', 0, false, '{}'::jsonb, $2)`, [org, `user:${MEMBER}`]);
  await as(MEMBER, "select delete_my_account()");
  const left = (await db.query(`select
      (select count(*)::int from remote_commands where sent_by_name <> 'A deleted account' and sent_by is null and op = 'hide_all') as names,
      (select count(*)::int from entities where updated_by like '%' || $1 || '%') as ents,
      (select count(*)::int from entity_history where updated_by like '%' || $1 || '%') as hist`, [MEMBER])).rows[0];
  assert.deepEqual(left, { names: 0, ents: 0, hist: 0 });
  assert.equal((await db.query("select sent_by_name from remote_commands where op = 'hide_all'")).rows[0].sent_by_name, "A deleted account");
});

test("the rollback restores 0003 / 0004 / 0011", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0014_audit_93_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regprocedure('public.transfer_ownership(uuid,uuid)') as f")).rows[0].f, null);
  assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_name = 'computer_links' and column_name = 'source_hash'")).rows[0].n, 0);
  for (let i = 0; i < 6; i++) await linkFrom("192.0.2.1");                   // no per-network limit any more
  assert.deepEqual(await take(), []);
});
