import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("../supabase/migrations/", import.meta.url);
const sql = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(new URL(name, dir), "utf8"))
  .join("\n");

test("every public table enables row level security", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tables.length >= 3);
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), table);
  }
});

test("every table has at least one policy and none is open to anon", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
  // Reached only through security definer functions: RLS on and no policy means clients get nothing.
  const functionsOnly = ["workspace_sync", "computer_links", "computer_link_failures"];
  for (const table of tables) {
    if (functionsOnly.includes(table)) continue;
    assert.match(sql, new RegExp(`create policy \\w+ on public\\.${table}`), table);
  }
  assert.doesNotMatch(sql, /create policy[^;]*to anon|using \(true\)|with check \(true\)/i);
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

// A linked PC calls with the anon key: these functions are open to anon and authorise it by its key header
// (request_computer) or, before it has one, only start and poll a link.
const ANON_BY_DESIGN = [
  "sync_pull",
  "sync_push",
  "computer_revoke",
  "computer_link_start",
  "computer_link_poll",
  "remote_take",
  "remote_report",
  "remote_publish",
];

test("functions that read across tenants are closed to anon", () => {
  const definers = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)[^$]*?security definer/g)];
  for (const [, name] of definers) {
    if (["is_org_member", "is_org_admin", "add_creator_as_owner"].includes(name)) continue;
    if (ANON_BY_DESIGN.includes(name)) continue;
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon`), name);
  }
});

test("functions open to anon check the computer key or only handle linking", () => {
  for (const name of ANON_BY_DESIGN) {
    const body = sql.split(`create or replace function public.${name}(`)[1].split("$$;")[0];
    assert.match(body, /security definer/, name);
    if (name.startsWith("computer_link_")) continue;
    assert.match(body, /public\.request_computer\(\)/, name);
  }
});
