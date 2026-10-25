import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/0001_tenant_foundation.sql", import.meta.url), "utf8");

test("every public table enables row level security", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tables.length >= 3);
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), table);
  }
});

test("every table has at least one policy and none is open to anon", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
  for (const table of tables) {
    assert.match(sql, new RegExp(`create policy \\w+ on public\\.${table}`), table);
  }
  assert.doesNotMatch(sql, /to anon|using \(true\)|with check \(true\)/i);
});

test("security definer functions pin search_path", () => {
  const defs = sql.split(/create or replace function/).slice(1);
  for (const def of defs) {
    if (/security definer/.test(def)) assert.match(def, /set search_path = public/);
  }
});

test("clients cannot grant the owner role", () => {
  assert.match(sql, /role <> 'owner'/);
});
