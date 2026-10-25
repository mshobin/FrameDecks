import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/0001_tenant_foundation.sql", import.meta.url), "utf8");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";

let db;
let org;

// Stand-in for Supabase: the two API roles and auth.uid() driven by a session setting.
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(migration);
  await db.exec(`grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  await db.exec(`insert into auth.users values ('${A}'),('${B}'),('${C}')`);
  org = (await as(A, "insert into organizations(name, created_by) values ('Church A', $1) returning id", [A])).rows[0].id;
});

after(() => db?.close());

async function as(uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.uid','${uid}',false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function denied(uid, sql, params) {
  try {
    await as(uid, sql, params);
    return false;
  } catch {
    return true;
  }
}

test("creator becomes owner automatically", async () => {
  const r = await as(A, "select role from memberships where organization_id=$1 and user_id=$2", [org, A]);
  assert.equal(r.rows[0]?.role, "owner");
});

test("outsiders cannot see organizations or memberships", async () => {
  assert.equal((await as(A, "select id from organizations")).rows.length, 1);
  assert.equal((await as(B, "select id from organizations")).rows.length, 0);
  assert.equal((await as(B, "select * from memberships")).rows.length, 0);
});

test("cannot create an organization as someone else", async () => {
  assert.ok(await denied(B, "insert into organizations(name, created_by) values ('x', $1)", [A]));
});

test("membership writes are admin-only and never grant owner", async () => {
  assert.ok(await denied(B, "insert into memberships values ($1,$2,'member')", [org, B]));
  assert.ok(await denied(A, "insert into memberships(organization_id,user_id,role) values ($1,$2,'owner')", [org, C]));
  assert.ok(!(await denied(A, "insert into memberships(organization_id,user_id,role) values ($1,$2,'member')", [org, B])));
  assert.ok(await denied(B, "insert into memberships(organization_id,user_id,role) values ($1,$2,'member')", [org, C]));
});

test("plain members cannot rename or delete the organization", async () => {
  assert.equal((await as(B, "update organizations set name='hacked' where id=$1 returning id", [org])).rows.length, 0);
  assert.equal((await as(B, "delete from organizations where id=$1 returning id", [org])).rows.length, 0);
});

test("profiles are private to their owner", async () => {
  await as(A, "insert into profiles(user_id, display_name) values ($1,'A')", [A]);
  assert.equal((await as(B, "select * from profiles")).rows.length, 0);
  assert.ok(await denied(B, "insert into profiles(user_id) values ($1)", [A]));
});

test("the hosted workspace screen's writes work: create-and-return, list by membership, profile upsert", async () => {
  const created = await as(C, "insert into organizations(name, created_by) values ('Church C', $1) returning id, name", [C]);
  assert.equal(created.rows[0]?.name, "Church C");
  const mine = await as(C, `select m.role, o.name from memberships m join organizations o on o.id = m.organization_id
    where m.user_id = $1`, [C]);
  assert.deepEqual(mine.rows, [{ role: "owner", name: "Church C" }]);
  const upsert = `insert into profiles(user_id, display_name) values ($1, $2)
    on conflict (user_id) do update set display_name = excluded.display_name returning display_name`;
  assert.equal((await as(C, upsert, [C, "Pastor C"])).rows[0].display_name, "Pastor C");
  assert.equal((await as(C, upsert, [C, "Pastor C."])).rows[0].display_name, "Pastor C.");
  assert.ok(await denied(B, upsert, [C, "not mine"]));
  assert.equal((await as(A, "select id from organizations where name = 'Church C'")).rows.length, 0);
});

test("anonymous role is denied", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select * from organizations"));
  } finally {
    await db.exec("reset role");
  }
});

test("members can leave and the owner can delete the organization", async () => {
  assert.equal((await as(B, "delete from memberships where organization_id=$1 and user_id=$2 returning 1", [org, B])).rows.length, 1);
  assert.equal((await as(A, "delete from organizations where id=$1 returning id", [org])).rows.length, 1);
});
