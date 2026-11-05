-- 0016: live push (the "doorbell"), design: docs/architecture/live-push.md.
-- Instead of asking every few seconds, a linked PC and the website's Live page are told when something changed:
--   * a PC listens on its workspace's bell (a public Realtime channel whose name is a long random secret only linked
--     PCs learn, from computer_hello). A ring carries no data, only what kind of thing changed ("cmd", "sync",
--     "watch") and which PC it is for; the PC then calls the same functions as before, with its key.
--   * the Live page listens on a private channel, live:<workspace>, which only people who may run services in that
--     workspace can join (the policy on realtime.messages below). It too only learns that a status or a result changed
--     and reads them with remote_computers / live_computers, as before.
-- Purely additive: no existing table, column or function changes. A PC or a website that does not know about this keeps
-- working exactly as before. A ring that fails (Realtime off, a quota) is ignored, so it can never break a command or a
-- sync. Switch push off for everyone with:  update public.live_push set enabled = false;
-- Run once in the Supabase SQL editor, after 0015. Undo: rollback/0016_live_push_down.sql.

-- ---------- The switch (one row) ----------
create table public.live_push (
  id boolean primary key default true check (id),
  enabled boolean not null default true
);
insert into public.live_push (id, enabled) values (true, true) on conflict (id) do nothing;
alter table public.live_push enable row level security;
-- No client policies: read by the functions below only.

-- ---------- Each workspace's bell (secret, functions only) ----------
create table public.workspace_bells (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  bell text not null unique check (bell ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.workspace_bells enable row level security;
-- No client policies: a PC learns its workspace's bell from computer_hello, nobody else needs it.

-- ---------- What the Live page and the PC need to know about each other ----------
alter table public.computers add column if not exists watched_until timestamptz;    -- a Live page is open on this PC
alter table public.computers add column if not exists control_seen_at timestamptz;  -- this PC takes commands (asleep or not)

create or replace function public.push_on()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.live_push where id), false);
$$;

create or replace function public.workspace_bell(org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_bell text;
begin
  select bell into found_bell from public.workspace_bells where organization_id = org;
  if found_bell is null then
    insert into public.workspace_bells (organization_id, bell)
    values (org, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
    on conflict (organization_id) do nothing;
    select bell into found_bell from public.workspace_bells where organization_id = org;
  end if;
  return found_bell;
end;
$$;

-- Send one Realtime message. Never raises: a ring is a hint, the polling safety net catches anything it misses.
create or replace function public.live_send(topic text, event text, payload jsonb, private boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.push_on() then
    return;
  end if;
  begin
    execute 'select realtime.send($1, $2, $3, $4)' using payload, event, topic, private;
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.ring(org uuid, event text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  found_bell text;
begin
  if not public.push_on() then
    return;
  end if;
  select bell into found_bell from public.workspace_bells where organization_id = org;
  if found_bell is not null then                -- no bell yet: no PC of this workspace has asked for one
    perform public.live_send('bell:' || found_bell, event, payload, false);
  end if;
end;
$$;

-- ---------- The PC ----------
-- Called by a linked PC (its key header) when it starts and about once a minute while it is not connected to its bell,
-- or every few minutes while it is. Tells it whether push is on, its workspace's bell, whether a Live page is watching
-- it, and the workspace's change counter (so an asleep PC pulls only when something changed). control: the PC has
-- "Allow control from the companion" on, so the Live page can show it as ready to wake.
create or replace function public.computer_hello(control boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  on_now boolean := public.push_on();
begin
  if caller.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if control and (caller.control_seen_at is null or caller.control_seen_at < now() - interval '50 seconds') then
    update public.computers set control_seen_at = now() where id = caller.id;
  elsif not control and caller.control_seen_at is not null then
    update public.computers set control_seen_at = null where id = caller.id;
  end if;
  return jsonb_build_object(
    'push', on_now,
    'bell', case when on_now then public.workspace_bell(caller.organization_id) end,
    'watched', coalesce(caller.watched_until > now(), false),
    'seq', coalesce((select seq from public.workspace_sync where organization_id = caller.organization_id), 0),
    'now', now()
  );
end;
$$;

-- ---------- The Live page ----------
-- Called while a Live page shows this PC (about once a minute): the PC sends its status while watched, and an asleep
-- PC wakes up (it sees "watched" in its next computer_hello, or at once when it is listening to its bell).
create or replace function public.remote_watch(computer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.computers;
begin
  select * into target from public.computers where id = computer and revoked_at is null;
  if not found or auth.uid() is null or not public.can_run_services(target.organization_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if target.watched_until is null or target.watched_until < now() + interval '90 seconds' then
    update public.computers set watched_until = now() + interval '2 minutes' where id = target.id;
    perform public.ring(target.organization_id, 'watch', jsonb_build_object('pc', target.id));
  end if;
end;
$$;

-- remote_computers (0005) plus what the page needs to tell an asleep PC from an offline one.
create or replace function public.live_computers(org uuid)
returns table (id uuid, name text, status jsonb, updated_at timestamptz, server_now timestamptz,
               control_seen_at timestamptz, push boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, s.status, s.updated_at, now(), c.control_seen_at, public.push_on()
  from public.computers c
  left join public.remote_status s on s.computer_id = c.id
  where c.organization_id = org and c.revoked_at is null and public.can_run_services(org)
  order by c.created_at;
$$;

-- Who may listen on a private channel: live:<workspace id>, people who may run services there.
create or replace function public.live_topic_allowed(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if topic is null or topic !~ '^live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_run_services(substr(topic, 6)::uuid);
end;
$$;

-- ---------- The rings (after the row is written; Realtime delivers only once the transaction commits) ----------
create or replace function public.live_on_command()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.ring(new.organization_id, 'cmd', jsonb_build_object('pc', new.computer_id));
  elsif new.taken_at is distinct from old.taken_at or new.result is distinct from old.result then
    perform public.live_send('live:' || new.organization_id, 'result',
                             jsonb_build_object('pc', new.computer_id, 'id', new.id), true);
  end if;
  return null;
end;
$$;

create or replace function public.live_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.live_send('live:' || new.organization_id, 'status', jsonb_build_object('pc', new.computer_id), true);
  return null;
end;
$$;

-- A sync push writes many records in one transaction: ring once per transaction and workspace.
create or replace function public.live_on_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  flag text := 'framedecks.rang_' || replace(new.organization_id::text, '-', '');
begin
  if coalesce(current_setting(flag, true), '') <> '1' then
    perform set_config(flag, '1', true);
    perform public.ring(new.organization_id, 'sync', '{}'::jsonb);
  end if;
  return null;
end;
$$;

-- An unlinked PC must not keep hearing its old workspace: a new bell (PCs still linked learn it from computer_hello).
create or replace function public.live_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    delete from public.workspace_bells where organization_id = new.organization_id;
  end if;
  return null;
end;
$$;

create trigger live_command after insert or update on public.remote_commands
  for each row execute function public.live_on_command();
create trigger live_status after insert or update on public.remote_status
  for each row execute function public.live_on_status();
create trigger live_entity after insert or update on public.entities
  for each row execute function public.live_on_entity();
create trigger live_revoke after update of revoked_at on public.computers
  for each row execute function public.live_on_revoke();

-- ---------- The private channel's door (Supabase Realtime Authorization) ----------
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists framedecks_live_read on realtime.messages';
    execute $p$create policy framedecks_live_read on realtime.messages for select to authenticated
      using (public.live_topic_allowed((select realtime.topic())))$p$;
  end if;
end;
$$;

-- ---------- Grants ----------
revoke execute on function public.push_on() from public, anon, authenticated;
revoke execute on function public.workspace_bell(uuid) from public, anon, authenticated;
revoke execute on function public.live_send(text, text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.ring(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.live_on_command() from public, anon, authenticated;
revoke execute on function public.live_on_status() from public, anon, authenticated;
revoke execute on function public.live_on_entity() from public, anon, authenticated;
revoke execute on function public.live_on_revoke() from public, anon, authenticated;
revoke execute on function public.computer_hello(boolean) from public;
revoke execute on function public.remote_watch(uuid) from public, anon;
revoke execute on function public.live_computers(uuid) from public, anon;
revoke execute on function public.live_topic_allowed(text) from public, anon;
grant execute on function public.computer_hello(boolean) to anon, authenticated;
grant execute on function public.remote_watch(uuid) to authenticated;
grant execute on function public.live_computers(uuid) to authenticated;
grant execute on function public.live_topic_allowed(text) to authenticated;
