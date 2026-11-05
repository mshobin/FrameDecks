import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const dir = new URL("../supabase/migrations/", import.meta.url);

// Stand-in for Supabase: the two API roles, auth.users with emails, and auth.uid() driven by a session setting.
// Applies every migration in order, the way they are run in the SQL editor.
export async function supabaseStandIn(users) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    -- Supabase Realtime's broadcast table and send() (0016 live push): a message is a row; the channel being joined is
    -- the realtime.topic setting, and Realtime Authorization is row level security on realtime.messages.
    create schema realtime;
    create table realtime.messages (id bigserial primary key, topic text not null, extension text not null default 'broadcast',
      event text, payload jsonb, private boolean, inserted_at timestamptz not null default now());
    alter table realtime.messages enable row level security;
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
      language sql as $$ insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private) $$;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
    grant usage on schema realtime to anon, authenticated;
    grant select on realtime.messages to authenticated;
    grant execute on function realtime.topic() to anon, authenticated;
  `);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(name, dir), "utf8"));
  }
  // As Supabase behaves from 30 October 2026: tables get no automatic grants, so the migrations' own GRANTs are all
  // the API roles have (0007_data_api_grants.sql).
  await db.exec(`grant usage on schema public to anon, authenticated;`);
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
