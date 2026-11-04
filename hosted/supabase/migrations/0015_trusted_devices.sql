-- FrameDecks 9.8: Trusted Devices for the passwordless workspace (docs/architecture/trusted-workspace.md).
-- After an emailed one-time link, a browser may become a Trusted Device: it gets a random device token that only it
-- keeps; the cloud keeps the token's SHA-256 hash. A trusted device stays connected for 180 days, then asks for a new
-- link (revalidation). Removing a device ends its access at once: its session is deleted and every Data API request
-- still carrying that session is refused before it runs (check_trusted_session, PostgREST's pre-request hook).
-- Security events (link requested, link used, device trusted, device removed, device expired) are kept for each
-- person, and device events and workspace syncs also go to the workspace's audit log (0006) for owners and admins.
-- Nothing here changes workspaces, memberships, entities, sync_push / sync_pull or PC linking.
-- Run once in the Supabase SQL editor, after 0014_audit_93.sql. Undo: supabase/rollback/0015_trusted_devices_down.sql.

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  session_id uuid,                -- the session it was trusted with (removed with the device)
  trusted_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  revoked_at timestamptz
);
create index trusted_devices_user_idx on public.trusted_devices (user_id);
create index trusted_devices_session_idx on public.trusted_devices (session_id) where session_id is not null;
alter table public.trusted_devices enable row level security;   -- no policies: only the functions below touch it

create table public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,     -- null for a link request (before the person is known)
  email_hash text,                -- link requests: the address only as a hash
  action text not null,           -- link.requested, link.used, device.trusted, device.revoked, device.expired
  device_id uuid,
  source_hash text,               -- the network, hashed (0014 request_source)
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index security_events_user_idx on public.security_events (user_id, at desc);
create index security_events_email_idx on public.security_events (email_hash, at desc);
alter table public.security_events enable row level security;  -- read through security_event_list()

-- The current request's session (Supabase puts it in the token as session_id); null without one
create or replace function public.request_session()
returns uuid
language sql
stable
set search_path = public
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', '')::uuid
$$;

create or replace function public.security_log(uid uuid, what text, device uuid, extra jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
begin
  delete from public.security_events where at < now() - interval '1 year';
  insert into public.security_events (user_id, action, device_id, source_hash, detail)
  values (uid, what, device, public.request_source(), coalesce(extra, '{}'::jsonb));
  if what like 'device.%' then                                  -- the workspaces' owners and admins see it too
    for w in select organization_id from public.memberships where user_id = uid loop
      perform public.audit_write(w.organization_id, what, coalesce(device::text, ''), coalesce(extra, '{}'::jsonb));
    end loop;
  end if;
end;
$$;

-- Before the link is sent (no session yet): the address is kept only as a hash, and requests are limited per address
-- and per network so the log cannot be flooded.
create or replace function public.magic_link_requested(email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  address text := lower(trim(coalesce(email, '')));
  h text := public.sha256_hex('email:' || address);
  src text := public.request_source();
begin
  if address !~ '^[^@\s]+@[^@\s]+$' or char_length(address) > 254 then
    raise exception 'Enter an email address' using errcode = '22023';
  end if;
  if (select count(*) from public.security_events where email_hash = h and at > now() - interval '1 hour') >= 10
     or (src is not null and (select count(*) from public.security_events
                              where source_hash = src and action = 'link.requested' and at > now() - interval '1 hour') >= 30) then
    raise exception 'Too many links asked for. Wait a little and try again.' using errcode = 'P0001';
  end if;
  insert into public.security_events (email_hash, action, source_hash) values (h, 'link.requested', src);
end;
$$;

-- After the link was opened: one record per session
create or replace function public.magic_link_used()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.request_session();
begin
  if uid is null then
    raise exception 'No workspace session' using errcode = '42501';
  end if;
  if sid is not null and exists (select 1 from public.security_events
                                 where user_id = uid and action = 'link.used' and detail ->> 'session' = sid::text) then
    return;
  end if;
  perform public.security_log(uid, 'link.used', null, jsonb_build_object('session', coalesce(sid::text, '')));
end;
$$;

-- Trust This Device: a new random token, returned once; the cloud keeps its hash. At most 20 trusted devices each.
create or replace function public.trust_device(device_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  token text;
  row_id uuid;
  ends timestamptz;
begin
  if uid is null then
    raise exception 'No workspace session' using errcode = '42501';
  end if;
  if (select count(*) from public.trusted_devices
      where user_id = uid and revoked_at is null and expires_at > now()) >= 20 then
    raise exception 'Remove a device in Manage Devices first (20 at most).' using errcode = 'P0001';
  end if;
  token := translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/=', '-_');
  insert into public.trusted_devices (user_id, name, token_hash, session_id)
  values (uid, left(coalesce(nullif(trim(device_name), ''), 'This device'), 80), public.sha256_hex(token), public.request_session())
  returning id, expires_at into row_id, ends;
  perform public.security_log(uid, 'device.trusted', row_id, jsonb_build_object('name', left(coalesce(nullif(trim(device_name), ''), 'This device'), 80)));
  return jsonb_build_object('token', token, 'id', row_id, 'expires_at', ends);
end;
$$;

-- At every start of a trusted browser: 'trusted', 'revoked', 'expired' (180 days: ask for a new link) or 'unknown'
create or replace function public.device_check(token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.trusted_devices;
begin
  if uid is null or coalesce(token, '') = '' then
    return 'unknown';
  end if;
  select * into d from public.trusted_devices where token_hash = public.sha256_hex(token) and user_id = uid;
  if d.id is null then
    return 'unknown';
  end if;
  if d.revoked_at is not null then
    return 'revoked';
  end if;
  if d.expires_at <= now() then
    if not exists (select 1 from public.security_events where device_id = d.id and action = 'device.expired') then
      perform public.security_log(uid, 'device.expired', d.id, jsonb_build_object('name', d.name));
    end if;
    return 'expired';
  end if;
  -- the session it uses now (a new link on a trusted device starts a new one), and when it was last seen (hourly)
  update public.trusted_devices
  set session_id = coalesce(public.request_session(), session_id), last_seen_at = now()
  where id = d.id and (last_seen_at < now() - interval '1 hour' or session_id is distinct from coalesce(public.request_session(), session_id));
  return 'trusted';
end;
$$;

create or replace function public.device_list()
returns table (id uuid, name text, trusted_at timestamptz, last_seen_at timestamptz, expires_at timestamptz, current boolean)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.trusted_at, d.last_seen_at, d.expires_at,
         d.session_id is not null and d.session_id = public.request_session()
  from public.trusted_devices d
  where d.user_id = auth.uid() and d.revoked_at is null and d.expires_at > now()
  order by d.last_seen_at desc
$$;

-- Remove a device: it is untrusted at once, its session is deleted, and its requests are refused from now on
create or replace function public.device_revoke(device uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.trusted_devices;
begin
  select * into d from public.trusted_devices where id = device and user_id = uid;
  if uid is null or d.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if d.revoked_at is not null then
    return;
  end if;
  update public.trusted_devices set revoked_at = now() where id = d.id;
  if d.session_id is not null and to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where id = $1 and user_id = $2' using d.session_id, uid;
  end if;
  perform public.security_log(uid, 'device.revoked', d.id, jsonb_build_object('name', d.name));
end;
$$;

-- The person's own security events, newest first (Manage Devices → Activity)
create or replace function public.security_event_list(max_rows integer default 50)
returns table (action text, device_name text, at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.action, coalesce(e.detail ->> 'name', d.name), e.at
  from public.security_events e
  left join public.trusted_devices d on d.id = e.device_id
  where e.user_id = auth.uid()
     or e.email_hash = (select public.sha256_hex('email:' || lower(trim(u.email))) from auth.users u where u.id = auth.uid())
  order by e.at desc
  limit least(greatest(coalesce(max_rows, 50), 1), 200)
$$;

-- Before every Data API request (PostgREST's pre-request hook): a request from a removed or expired device's session
-- is refused, even while its short-lived access token has not run out. Requests without such a session (linked PCs,
-- untrusted browsers, the anonymous key) are not affected.
create or replace function public.check_trusted_session()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid := public.request_session();
begin
  if sid is not null and exists (select 1 from public.trusted_devices
                                 where session_id = sid and (revoked_at is not null or expires_at <= now())) then
    raise exception 'This device is no longer trusted. Sync Workspace again.' using errcode = '42501';
  end if;
end;
$$;

-- Workspace sync in the audit log: at most one entry per workspace every 10 minutes (sync_push is unchanged)
create or replace function public.audit_workspace_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.seq is distinct from old.seq and not exists (
       select 1 from public.audit_log
       where organization_id = new.organization_id and action = 'workspace.synced' and at > now() - interval '10 minutes') then
    perform public.audit_write(new.organization_id, 'workspace.synced', null,
                               jsonb_build_object('seq', new.seq, 'by', case when auth.uid() is null then 'computer' else 'person' end));
  end if;
  return new;
end;
$$;
create trigger workspace_sync_audit after update on public.workspace_sync
  for each row execute function public.audit_workspace_sync();

revoke all on table public.trusted_devices from public, anon, authenticated;
revoke all on table public.security_events from public, anon, authenticated;
revoke execute on function public.security_log(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_workspace_sync() from public, anon, authenticated;
revoke execute on function public.magic_link_used() from public, anon;
revoke execute on function public.trust_device(text) from public, anon;
revoke execute on function public.device_check(text) from public, anon;
revoke execute on function public.device_list() from public, anon;
revoke execute on function public.device_revoke(uuid) from public, anon;
revoke execute on function public.security_event_list(integer) from public, anon;
grant execute on function public.magic_link_used(), public.trust_device(text), public.device_check(text), public.device_list(),
  public.device_revoke(uuid), public.security_event_list(integer) to authenticated;
-- Open to anon by design: asking for a link happens before there is a session (rate-limited, the address hashed), and
-- the pre-request check runs for every request (it only reads, and only refuses).
grant execute on function public.magic_link_requested(text) to anon, authenticated;
grant execute on function public.check_trusted_session(), public.request_session() to anon, authenticated;

-- Switch the pre-request check on for the Data API (Supabase's API role); skipped where that role does not exist.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_trusted_session''';
    perform pg_notify('pgrst', 'reload config');
  end if;
end;
$$;
