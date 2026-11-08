-- FrameDecks 26.11.12: Scan to join (docs/architecture/scan-to-join.md).
-- A phone, tablet or browser joins a team by scanning a QR code (or typing its short code) shown by a device that is
-- already in: the church PC (by its key), or a signed-in device. The new device needs no email and no password: it is
-- a Supabase anonymous user (owner step: Authentication > Sign In / Providers > "Allow anonymous sign-ins" on) that
-- becomes a member of the team when the code is used. The other way round, a new browser shows its own code and a
-- device that is already in (or the PC) allows it. Codes are random, kept only as a SHA-256 hash, work once, and run
-- out after 2 minutes (5 for a browser that waits to be allowed); wrong codes are limited per device and per network
-- (a wrong code is an answer, {"status": "wrong"}, not an error, so the count of wrong tries is kept).
-- One Devices list per team (people's devices and PCs), with Remove. A recovery code (owner only, kept as a hash)
-- gets a team back when every device is lost. An emergency email is the Supabase address of an anonymous user
-- (supabase.auth.updateUser on the website): nothing here.
-- Nothing earlier changes: email links, Trusted Devices (0015), invitations, roles, sync_push / sync_pull and PC
-- linking (0003, 0010) work as before; joining a PC to a team reuses computer_links.
-- NOT YET: the website and PC screens that use it are still being built; run it only when the release notes say so.
-- Run once in the Supabase SQL editor, after 0017_help_votes.sql. Undo: supabase/rollback/0018_scan_to_join_down.sql.

-- Is the request's person an anonymous (device-only) user? Supabase puts is_anonymous in the token.
create or replace function public.request_is_anonymous()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false)
$$;

-- A random code of n characters from an alphabet without look-alikes (no 0/O, 1/I/L)
create or replace function public.random_code(n integer)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- 31 characters
  bytes bytea := decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex');
  out text := '';
  i integer;
begin
  for i in 0..least(n, 32) - 1 loop
    out := out || substr(alphabet, get_byte(bytes, i) % 31 + 1, 1);
  end loop;
  return out;
end;
$$;

-- What the person typed or the QR carried, tidied (spaces, dashes, case), then hashed
create or replace function public.code_hash(code text)
returns text
language sql
immutable
set search_path = public
as $$
  select public.sha256_hex(upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')))
$$;

create table public.join_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('invite', 'request')),     -- invite: shown by a device that is in; request: by a new one
  organization_id uuid references public.organizations (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  device_name text check (device_name is null or char_length(device_name) <= 80),
  requester uuid references auth.users (id) on delete cascade, -- request: the device waiting to be allowed
  created_by uuid references auth.users (id) on delete set null,
  computer_id uuid references public.computers (id) on delete cascade,
  source_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
create index join_codes_org_idx on public.join_codes (organization_id) where used_at is null;
create index join_codes_requester_idx on public.join_codes (requester) where kind = 'request';
alter table public.join_codes enable row level security;      -- no policies: only the functions below touch it

create table public.join_failures (
  who text not null,              -- 'user:<id>', 'pc:<id>' or 'net:<hashed network>'
  at timestamptz not null default now()
);
create index join_failures_idx on public.join_failures (who, at desc);
alter table public.join_failures enable row level security;

create table public.recovery_codes (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;

-- Too many wrong codes from this person, this PC or this network in the last hour?
create or replace function public.join_blocked(limit_each integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  src text := public.request_source();
begin
  delete from public.join_failures where at < now() - interval '1 hour';
  return (auth.uid() is not null and (select count(*) from public.join_failures where who = 'user:' || auth.uid()) >= limit_each)
      or (pc.id is not null and (select count(*) from public.join_failures where who = 'pc:' || pc.id) >= limit_each)
      or (src is not null and (select count(*) from public.join_failures where who = 'net:' || src) >= limit_each * 3);
end;
$$;

create or replace function public.join_failed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  src text := public.request_source();
begin
  if auth.uid() is not null then insert into public.join_failures (who) values ('user:' || auth.uid()); end if;
  if pc.id is not null then insert into public.join_failures (who) values ('pc:' || pc.id); end if;
  if src is not null then insert into public.join_failures (who) values ('net:' || src); end if;
end;
$$;

-- Owners may let a device in as Admin or Helper; admins only as Helper (only the owner adds admins, as 0013 keeps
-- it). The church PC itself may add an Admin: being at the PC is the proof.
create or replace function public.join_role_allowed(org uuid, wanted text, by_pc boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select wanted in ('admin', 'member') and (
    by_pc
    or public.is_org_owner(org)
    or (wanted = 'member' and public.is_org_admin(org)))
$$;

-- Puts a person in a team (never lowers a role, never makes an owner). The team's audit log gets it from the
-- memberships trigger (0006); the person's own security events get 'joined'.
create or replace function public.join_team(org uuid, person uuid, wanted text, device text, via text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (organization_id, user_id, role) values (org, person, wanted)
  on conflict (organization_id, user_id) do update
    set role = case when public.memberships.role = 'member' and excluded.role = 'admin' then 'admin' else public.memberships.role end;
  if nullif(trim(coalesce(device, '')), '') is not null then
    insert into public.profiles (user_id, display_name) values (person, left(trim(device), 80))
    on conflict (user_id) do update set display_name = coalesce(public.profiles.display_name, excluded.display_name);
  end if;
  perform public.security_log(person, 'joined', null,
    jsonb_build_object('name', left(coalesce(nullif(trim(device), ''), 'A device'), 80), 'via', via, 'team', org, 'role', wanted));
end;
$$;

-- ---------- 1. A device that is in shows a QR code: Add a device / Invite someone ----------

-- By a signed-in person (owner or admin)
create or replace function public.invite_create(org uuid, wanted text default 'member')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := public.random_code(8);
  ends timestamptz := now() + interval '2 minutes';
begin
  if auth.uid() is null or not public.join_role_allowed(org, wanted, false) then
    raise exception 'Only the team''s owner can add an Admin; admins can add Helpers' using errcode = '42501';
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where organization_id = org and kind = 'invite'
      and used_at is null and expires_at > now()) >= 20 then
    raise exception 'Too many codes are open; wait a minute' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, organization_id, role, created_by, source_hash, expires_at)
  values (public.code_hash(code), 'invite', org, wanted, auth.uid(), public.request_source(), ends);
  return jsonb_build_object('code', code, 'expiresAt', ends, 'role', wanted);
end;
$$;

-- By the church PC (its key header): Add a device and Invite someone in FrameDecks
create or replace function public.pc_invite_create(wanted text default 'admin')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(8);
  ends timestamptz := now() + interval '2 minutes';
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if wanted not in ('admin', 'member') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where computer_id = pc.id and kind = 'invite'
      and used_at is null and expires_at > now()) >= 10 then
    raise exception 'Too many codes are open; wait a minute' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, organization_id, role, computer_id, source_hash, expires_at)
  values (public.code_hash(code), 'invite', pc.organization_id, wanted, pc.id, public.request_source(), ends);
  return jsonb_build_object('code', code, 'expiresAt', ends, 'role', wanted);
end;
$$;

-- What a code is, before anyone is signed in (so a wrong code never makes a new device): an invite to a team, a PC
-- waiting to be connected, expired or unknown. Limited like wrong codes.
create or replace function public.join_code_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  j public.join_codes;
  link public.computer_links;
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes where code_hash = h and kind = 'invite';
  if found then
    if j.used_at is not null or j.expires_at <= now() then
      return jsonb_build_object('status', 'expired');
    end if;
    return jsonb_build_object('status', 'invite', 'team', (select name from public.organizations where id = j.organization_id),
                              'role', j.role, 'byPc', j.computer_id is not null);
  end if;
  select * into link from public.computer_links where code_hash = h and organization_id is null;
  if found then
    if link.expires_at <= now() then
      return jsonb_build_object('status', 'expired');
    end if;
    return jsonb_build_object('status', 'pc', 'pc', link.name);
  end if;
  perform public.join_failed();
  return jsonb_build_object('status', 'unknown');
end;
$$;

-- The new device uses the code (it is signed in by now, usually as an anonymous user):
--   an invite         -> it joins that team;
--   a PC's link code  -> the PC is connected: to `org` if given (owner or admin there), to the caller's only team, or
--                        to a new team the caller owns when they have none (a brand-new phone at a brand-new PC).
create or replace function public.join_with_code(code text, device_name text default null, org uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h text := public.code_hash(code);
  j public.join_codes;
  link public.computer_links;
  target uuid;
  admin_teams uuid[];
  new_pc uuid;
begin
  if uid is null then
    raise exception 'Not signed in on this device' using errcode = '42501';
  end if;
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes
  where code_hash = h and kind = 'invite' and used_at is null and expires_at > now()
  for update;
  if found then
    update public.join_codes set used_at = now(), used_by = uid where code_hash = h;
    perform public.join_team(j.organization_id, uid, j.role, device_name, case when j.computer_id is null then 'device' else 'pc' end);
    return jsonb_build_object('status', 'joined', 'organizationId', j.organization_id, 'role', j.role,
                              'organizationName', (select name from public.organizations where id = j.organization_id));
  end if;

  select * into link from public.computer_links
  where code_hash = h and organization_id is null and expires_at > now()
  for update;
  if not found then
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'wrong');
  end if;
  select coalesce(array_agg(organization_id order by created_at), '{}') into admin_teams
  from public.memberships where user_id = uid and role in ('owner', 'admin');
  if org is not null then
    if not public.is_org_admin(org) then
      raise exception 'Only owners and admins can connect a PC' using errcode = '42501';
    end if;
    target := org;
  elsif cardinality(admin_teams) = 1 then
    target := admin_teams[1];
  elsif cardinality(admin_teams) > 1 then
    return jsonb_build_object('status', 'choose', 'teams',
      (select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.created_at)
       from public.organizations o where o.id = any (admin_teams)));
  elsif exists (select 1 from public.memberships where user_id = uid) then
    raise exception 'Only owners and admins can connect a PC' using errcode = '42501';
  else
    if not exists (select 1 from public.profiles where user_id = uid and terms_accepted_at is not null) then
      raise exception 'Accept the Terms first' using errcode = 'P0001', hint = 'terms';
    end if;
    insert into public.organizations (name, created_by) values ('My Workspace', uid) returning id into target;
    if nullif(trim(coalesce(device_name, '')), '') is not null then
      insert into public.profiles (user_id, display_name) values (uid, left(trim(device_name), 80))
      on conflict (user_id) do update set display_name = coalesce(public.profiles.display_name, excluded.display_name);
    end if;
  end if;
  insert into public.computers (organization_id, name, key_hash, created_by)
  values (target, link.name, link.key_hash, uid)
  returning id into new_pc;
  update public.computer_links set organization_id = target, computer_id = new_pc where code_hash = link.code_hash;
  return jsonb_build_object('status', 'linked', 'organizationId', target, 'pc', link.name,
                            'organizationName', (select name from public.organizations where id = target));
end;
$$;

-- ---------- 2. A new browser shows its own code; a device that is in (or the PC) allows it ----------

create or replace function public.join_request_create(device_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text := public.random_code(8);
  ends timestamptz := now() + interval '5 minutes';
begin
  if uid is null then
    raise exception 'Not signed in on this device' using errcode = '42501';
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where requester = uid and kind = 'request'
      and used_at is null and expires_at > now()) >= 3 then
    raise exception 'Use the code already on screen' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, requester, device_name, source_hash, expires_at)
  values (public.code_hash(code), 'request', uid,
          left(coalesce(nullif(trim(device_name), ''), 'A browser'), 80), public.request_source(), ends);
  return jsonb_build_object('code', code, 'expiresAt', ends);
end;
$$;

-- The waiting browser asks whether it was allowed (only its own codes)
create or replace function public.join_request_status(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.join_codes;
begin
  select * into j from public.join_codes
  where code_hash = public.code_hash(code) and kind = 'request' and requester = auth.uid();
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;
  if j.used_at is not null then
    return jsonb_build_object('status', 'allowed', 'organizationId', j.organization_id, 'role', j.role,
                              'organizationName', (select name from public.organizations where id = j.organization_id));
  end if;
  return jsonb_build_object('status', case when j.expires_at <= now() then 'expired' else 'pending' end);
end;
$$;

-- Before allowing: which device asked, and how long ago
create or replace function public.join_request_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.join_codes;
begin
  if auth.uid() is null and public.request_computer() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes where code_hash = public.code_hash(code) and kind = 'request' and used_at is null;
  if not found then
    perform public.join_failed();
    return jsonb_build_object('status', 'unknown');
  end if;
  if j.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'pending', 'device', j.device_name,
                            'ageSeconds', greatest(0, extract(epoch from (now() - j.created_at))::integer));
end;
$$;

-- Allow it, from a signed-in device (owner or admin of `org`)...
create or replace function public.join_request_allow(code text, org uuid, wanted text default 'member')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  j public.join_codes;
begin
  if auth.uid() is null or not public.join_role_allowed(org, wanted, false) then
    raise exception 'Only the team''s owner can add an Admin; admins can add Helpers' using errcode = '42501';
  end if;
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes
  where code_hash = h and kind = 'request' and used_at is null and expires_at > now()
  for update;
  if not found then
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'wrong');
  end if;
  update public.join_codes set used_at = now(), used_by = auth.uid(), organization_id = org, role = wanted where code_hash = h;
  perform public.join_team(org, j.requester, wanted, j.device_name, 'device');
  return jsonb_build_object('status', 'allowed', 'device', j.device_name, 'role', wanted);
end;
$$;

-- ...or from the church PC (its key header): type the code shown on the new browser into FrameDecks
create or replace function public.pc_join_request_allow(code text, wanted text default 'admin')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  h text := public.code_hash(code);
  j public.join_codes;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if wanted not in ('admin', 'member') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes
  where code_hash = h and kind = 'request' and used_at is null and expires_at > now()
  for update;
  if not found then
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'wrong');
  end if;
  update public.join_codes set used_at = now(), organization_id = pc.organization_id, role = wanted, computer_id = pc.id
  where code_hash = h;
  perform public.join_team(pc.organization_id, j.requester, wanted, j.device_name, 'pc');
  return jsonb_build_object('status', 'allowed', 'device', j.device_name, 'role', wanted);
end;
$$;

-- ---------- 3. One Devices list per team, with Remove ----------

create or replace function public.devices_of(org uuid)
returns table (kind text, id uuid, name text, role text, is_me boolean, last_seen_at timestamptz, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select 'person', m.user_id,
         coalesce(p.display_name, nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'A device'),
         m.role, m.user_id = auth.uid(),
         (select max(d.last_seen_at) from public.trusted_devices d where d.user_id = m.user_id and d.revoked_at is null),
         m.created_at
  from public.memberships m
  left join public.profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.organization_id = org
  union all
  select 'pc', c.id, c.name, 'pc', false, c.last_seen_at, c.created_at
  from public.computers c
  where c.organization_id = org and c.revoked_at is null
$$;

create or replace function public.workspace_devices(org uuid)
returns table (kind text, id uuid, name text, role text, is_me boolean, last_seen_at timestamptz, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_org_member(org) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.devices_of(org) order by 1 desc, 7;
end;
$$;

create or replace function public.pc_devices()
returns table (kind text, id uuid, name text, role text, is_me boolean, last_seen_at timestamptz, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  return query select d.kind, d.id, d.name, d.role, d.kind = 'pc' and d.id = pc.id, d.last_seen_at, d.joined_at
               from public.devices_of(pc.organization_id) d order by 1 desc, 7;
end;
$$;

-- Removes a person's device from a team: its membership goes; when it is in no team any more, its sessions end and
-- its trusted-device record is closed, so it is refused at once (0015's pre-request check).
create or replace function public.leave_team(org uuid, person uuid, by_whom uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  delete from public.memberships where organization_id = org and user_id = person;
  if not exists (select 1 from public.memberships where user_id = person) then
    for d in select id, session_id from public.trusted_devices where user_id = person and revoked_at is null loop
      update public.trusted_devices set revoked_at = now() where id = d.id;
    end loop;
    if to_regclass('auth.sessions') is not null then
      execute 'delete from auth.sessions where user_id = $1' using person;
    end if;
  end if;
  perform public.security_log(person, 'removed', null, jsonb_build_object('team', org, 'by', coalesce(by_whom::text, 'pc')));
end;
$$;

-- From a signed-in device: anyone may remove themselves; admins remove Helpers; the owner removes anyone but itself
create or replace function public.device_remove(org uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  select role into target_role from public.memberships where organization_id = org and user_id = person;
  if auth.uid() is null or target_role is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if target_role = 'owner' then
    raise exception 'The owner cannot be removed; hand the team to someone else first' using errcode = '42501';
  end if;
  if not (person = auth.uid() or public.is_org_owner(org) or (target_role = 'member' and public.is_org_admin(org))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.leave_team(org, person, auth.uid());
end;
$$;

-- From the church PC: remove any device but the owner's
create or replace function public.pc_device_remove(person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  target_role text;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select role into target_role from public.memberships where organization_id = pc.organization_id and user_id = person;
  if target_role is null or target_role = 'owner' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.leave_team(pc.organization_id, person, null);
end;
$$;

-- ---------- 4. Recovery: a printed code gets the team back when every device is lost ----------

create or replace function public.recovery_code_create(org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := public.random_code(16);
begin
  if auth.uid() is null or not public.is_org_owner(org) then
    raise exception 'Only the team''s owner can make a recovery code' using errcode = '42501';
  end if;
  insert into public.recovery_codes (organization_id, code_hash, created_by)
  values (org, public.code_hash(code), auth.uid())
  on conflict (organization_id) do update set code_hash = excluded.code_hash, created_by = excluded.created_by, created_at = now();
  perform public.audit_write(org, 'recovery.created', null, '{}'::jsonb);
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4) || '-' || substr(code, 13, 4);
end;
$$;

create or replace function public.recovery_status(org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if auth.uid() is null or not public.is_org_member(org) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select user_id into owner_id from public.memberships where organization_id = org and role = 'owner' limit 1;
  return jsonb_build_object(
    'hasCode', exists (select 1 from public.recovery_codes where organization_id = org),
    'codeMadeAt', (select created_at from public.recovery_codes where organization_id = org),
    'ownerHasEmail', exists (select 1 from auth.users where id = owner_id and coalesce(email, '') <> ''),
    'iAmOwner', owner_id = auth.uid());
end;
$$;

-- On a new device (signed in, usually as an anonymous user): the code makes this device the team's owner. The code
-- works once; the old owner stays in the team as an Admin and can be removed from the Devices list.
create or replace function public.recover_team(code text, device_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.recovery_codes;
  old_owner uuid;
begin
  if uid is null then
    raise exception 'Not signed in on this device' using errcode = '42501';
  end if;
  if public.join_blocked(5) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into r from public.recovery_codes where code_hash = public.code_hash(code) for update;
  if not found then
    perform public.join_failed();
    return jsonb_build_object('status', 'wrong');
  end if;
  select user_id into old_owner from public.memberships where organization_id = r.organization_id and role = 'owner';
  delete from public.recovery_codes where organization_id = r.organization_id;
  if old_owner is distinct from uid then
    update public.memberships set role = 'admin' where organization_id = r.organization_id and user_id = old_owner;
    insert into public.memberships (organization_id, user_id, role) values (r.organization_id, uid, 'owner')
    on conflict (organization_id, user_id) do update set role = 'owner';
    update public.organizations set created_by = uid where id = r.organization_id;
  end if;
  if nullif(trim(coalesce(device_name, '')), '') is not null then
    insert into public.profiles (user_id, display_name) values (uid, left(trim(device_name), 80))
    on conflict (user_id) do update set display_name = coalesce(public.profiles.display_name, excluded.display_name);
  end if;
  perform public.security_log(uid, 'team.recovered', null, jsonb_build_object('team', r.organization_id));
  perform public.audit_write(r.organization_id, 'team.recovered', uid::text, '{}'::jsonb);
  return jsonb_build_object('status', 'recovered', 'organizationId', r.organization_id,
                            'organizationName', (select name from public.organizations where id = r.organization_id));
end;
$$;

-- ---------- 5. A device-only (anonymous) person cannot start a team on its own ----------
-- Only a PC's link code (join_with_code) or an email sign-in starts a team, so anonymous sign-ins cannot be used to
-- fill the database with empty teams.
drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated with check (created_by = auth.uid() and not public.request_is_anonymous());

-- ---------- grants ----------
revoke all on table public.join_codes, public.join_failures, public.recovery_codes from public, anon, authenticated;
-- internal helpers: only the functions above call them
revoke execute on function public.random_code(integer) from public, anon, authenticated;
revoke execute on function public.join_blocked(integer) from public, anon, authenticated;
revoke execute on function public.join_failed() from public, anon, authenticated;
revoke execute on function public.join_role_allowed(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.join_team(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.devices_of(uuid) from public, anon, authenticated;
revoke execute on function public.leave_team(uuid, uuid, uuid) from public, anon, authenticated;
-- a signed-in device (an anonymous one included)
revoke execute on function public.invite_create(uuid, text) from public, anon;
revoke execute on function public.join_with_code(text, text, uuid) from public, anon;
revoke execute on function public.join_request_create(text) from public, anon;
revoke execute on function public.join_request_status(text) from public, anon;
revoke execute on function public.join_request_allow(text, uuid, text) from public, anon;
revoke execute on function public.workspace_devices(uuid) from public, anon;
revoke execute on function public.device_remove(uuid, uuid) from public, anon;
revoke execute on function public.recovery_code_create(uuid) from public, anon;
revoke execute on function public.recovery_status(uuid) from public, anon;
revoke execute on function public.recover_team(text, text) from public, anon;
grant execute on function public.invite_create(uuid, text), public.join_with_code(text, text, uuid),
  public.join_request_create(text), public.join_request_status(text), public.join_request_allow(text, uuid, text),
  public.workspace_devices(uuid), public.device_remove(uuid, uuid), public.recovery_code_create(uuid),
  public.recovery_status(uuid), public.recover_team(text, text) to authenticated;
-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer),
-- and a code is looked at before the new device signs in (limited like wrong codes).
revoke execute on function public.pc_invite_create(text), public.pc_join_request_allow(text, text), public.pc_devices(),
  public.pc_device_remove(uuid), public.join_code_peek(text), public.join_request_peek(text) from public;
grant execute on function public.pc_invite_create(text), public.pc_join_request_allow(text, text), public.pc_devices(),
  public.pc_device_remove(uuid), public.join_code_peek(text), public.join_request_peek(text) to anon, authenticated;
grant execute on function public.request_is_anonymous(), public.code_hash(text) to anon, authenticated;
