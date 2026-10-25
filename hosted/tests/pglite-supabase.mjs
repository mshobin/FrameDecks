import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const dir = new URL("../supabase/migrations/", import.meta.url);

// Stand-in for Supabase: the two API roles, auth.users with emails, and auth.uid() driven by a session setting.
// Applies every migration in order, the way they are run in the SQL editor.
export async function supabaseStandIn(users) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(name, dir), "utf8"));
  }
  await db.exec(`grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  for (const [id, email] of Object.entries(users)) {
    await db.query("insert into auth.users values ($1, $2)", [id, email]);
  }

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

  return { db, as, denied };
}
