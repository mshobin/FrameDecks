import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
  const functionsOnly = [
    "workspace_sync", "computer_links", "computer_link_failures", "trusted_devices", "security_events", "live_push", "workspace_bells",
    "help_votes", // 0017: votes go in through help_vote() and are read only in the SQL editor
    "join_codes", "join_failures", "recovery_codes", // 0018: only the scan-to-join functions touch them
    "prayer_walls", "prayer_requests", // 0019: only the prayer wall functions touch them
  ];
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
  "computer_hello",
  // 0018: the church PC shows codes, allows a waiting browser and lists or removes the team's devices by its key
  "pc_invite_create",
  "pc_join_request_allow",
  "pc_devices",
  "pc_device_remove",
  // 0019: the church PC opens and closes its prayer wall and takes the requests in, by its key
  "pc_prayer_open",
  "pc_prayer_close",
  "pc_prayer_take",
];

// 0015: asking for a link comes before any session (rate-limited, the address only hashed), and the pre-request
// check runs for every Data API request (it reads one row and can only refuse).
const BEFORE_A_SESSION = ["magic_link_requested", "check_trusted_session",
  // 0018: a scanned code is looked at before the new device signs in (no session yet), limited like wrong codes;
  // join_request_peek is also used by the PC (its key) to show which browser is waiting
  "join_code_peek", "join_request_peek"];
// 0017: the public Help pages' "Was this helpful?": it reads nothing, only adds a checked article name and a yes or no.
const PUBLIC_HELP = ["help_vote"];
// 0019: people in the meeting send a prayer request with only the wall's code (no account); they read nothing back
// but whether the wall is open (and the team's name), limited per network and like wrong codes.
const PUBLIC_PRAYER = ["prayer_peek", "prayer_send"];

test("functions that read across tenants are closed to anon", () => {
  const definers = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)[^$]*?security definer/g)];
  for (const [, name] of definers) {
    if (["is_org_member", "is_org_admin", "add_creator_as_owner"].includes(name)) continue;
    if (ANON_BY_DESIGN.includes(name) || BEFORE_A_SESSION.includes(name) || PUBLIC_HELP.includes(name) || PUBLIC_PRAYER.includes(name)) continue;
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon`), name);
  }
});

test("help_vote only adds a vote: it reads no table and returns nothing but whether it was kept", () => {
  const body = sql.split("create or replace function public.help_vote(")[1].split("$$;")[0];
  assert.match(body, /security definer/);
  assert.match(body, /returns boolean/);
  assert.doesNotMatch(body.replace(/select count\(\*\) from public\.help_votes/, ""), /select [^;]* from public\.(?!help_votes)/);
});

test("functions open to anon check the computer key or only handle linking", () => {
  for (const name of ANON_BY_DESIGN) {
    const body = sql.split(`create or replace function public.${name}(`)[1].split("$$;")[0];
    assert.match(body, /security definer/, name);
    if (name.startsWith("computer_link_")) continue;
    assert.match(body, /public\.request_computer\(\)/, name);
  }
});

// Supabase, from 30 October 2026: a table without an explicit GRANT cannot be reached by the companion at all.
test("every table the companion reads or writes directly is granted to signed-in people", () => {
  const src = new URL("../src/", import.meta.url);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const url = new URL(name, dir);
      if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir));
      else if (/\.(ts|tsx)$/.test(name)) files.push(readFileSync(url, "utf8"));
    }
  };
  walk(src);
  const used = new Set(files.flatMap((f) => [...f.matchAll(/\.from\("(\w+)"\)/g)].map((m) => m[1])));
  assert.ok(used.size >= 5);
  const grants = [...sql.matchAll(/grant ([^;]+?) on table ([^;]+?) to authenticated;/gi)].map((m) => m[2]).join(",");
  for (const table of used) assert.match(grants, new RegExp(`public\\.${table}\\b`), table);
  assert.doesNotMatch(sql, /grant [^;]* on (table|all tables)[^;]* to anon/i);
});

test("the prayer wall's public functions never return a request", () => {
  for (const name of PUBLIC_PRAYER) {
    const body = sql.split(`create or replace function public.${name}(`)[1].split("$$;")[0];
    assert.match(body, /returns jsonb/, name);
    assert.match(body, /public\.join_blocked\(/, name);
    assert.doesNotMatch(body, /select [^;]*\bbody\b[^;]* from public\.prayer_requests/, name);
  }
});
