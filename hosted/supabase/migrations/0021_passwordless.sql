-- FrameDecks 26.11.26: joining without typing (docs/architecture/passwordless.md).
-- 1. Add a device signs the phone in as you. A device that is already in (the church PC by its key, or a signed-in
--    browser) shows a QR code; the phone that scans it is signed in to the same person's own account, not as a
--    nameless guest. The code is random, kept only as a SHA-256 hash, works once and runs out after 2 minutes. Only
--    the server function device-sign-in (hosted/supabase/functions) can use it, with the service key: it marks the
--    code used here (device_code_redeem) and asks Supabase Auth for a one-time sign-in for that person's email, which
--    the phone turns into its session. No anonymous sign-ins are needed for this.
-- 2. Connect this PC from the website. A signed-in owner or admin presses Connect this PC; the website makes a
--    one-time grant (2 minutes) and hands it to the program through its framedecks:// link. The program shows which
--    team it is (pc_grant_peek), and one click connects it with its own new key (pc_link_with_grant). A web page
--    cannot connect a PC silently: the program always asks first.
-- Nothing earlier changes: invites to someone else, join requests, email links and Trusted Devices work as before.
-- Run once in the Supabase SQL editor, after 0020_member_room.sql. Undo: supabase/rollback/0021_passwordless_down.sql.

alter table public.join_codes drop constraint if exists join_codes_kind_check;
alter table public.join_codes add constraint join_codes_kind_check check (kind in ('invite', 'request', 'self', 'grant'));

-- The person a self code signs in as: a real account with an email, still in the team
create or replace function public.code_person(person uuid, org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email from auth.users u
  where u.id = person and nullif(trim(coalesce(u.email, '')), '') is not null
    and exists (select 1 from public.memberships m where m.organization_id = org and m.user_id = person)
$$;

-- An address shown on the PC and the phone so people see whose account it is, without spelling it out to a camera
create or replace function public.masked_email(email text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when position('@' in coalesce(email, '')) < 2 then null
              else left(email, 1) || repeat('•', least(6, greatest(1, position('@' in email) - 2))) || substr(email, position('@' in email))
         end
$$;

-- ---------- 1. Add a device: a code that signs the phone in as you ----------

-- From a signed-in browser (any member with an email account)
create or replace function public.device_code_create(org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := public.random_code(8);
  ends timestamptz := now() + interval '2 minutes';
  email text := public.code_person(auth.uid(), org);
begin
  if auth.uid() is null or email is null or public.request_is_anonymous() then
    raise exception 'Sign in with your email first' using errcode = '42501';
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where created_by = auth.uid() and kind = 'self'
      and used_at is null and expires_at > now()) >= 5 then
    raise exception 'Too many codes are open; wait a minute' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, organization_id, created_by, source_hash, expires_at)
  values (public.code_hash(code), 'self', org, auth.uid(), public.request_source(), ends);
  return jsonb_build_object('code', code, 'expiresAt', ends, 'who', public.masked_email(email));
end;
$$;

-- From the church PC (its key header): the phone signs in as the person who connected this PC
create or replace function public.pc_device_code_create()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(8);
  ends timestamptz := now() + interval '2 minutes';
  email text;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  email := public.code_person(pc.created_by, pc.organization_id);
  if email is null then
    -- connected by a device without an email (or by someone who has left): Invite someone still works
    return jsonb_build_object('status', 'no-person');
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where computer_id = pc.id and kind = 'self'
      and used_at is null and expires_at > now()) >= 5 then
    raise exception 'Too many codes are open; wait a minute' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, organization_id, created_by, computer_id, source_hash, expires_at)
  values (public.code_hash(code), 'self', pc.organization_id, pc.created_by, pc.id, public.request_source(), ends);
  return jsonb_build_object('status', 'ok', 'code', code, 'expiresAt', ends, 'who', public.masked_email(email));
end;
$$;

-- What a code is, before anyone is signed in: as 0018, plus a self code (whose account, which team)
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
  select * into j from public.join_codes where code_hash = h and kind in ('invite', 'self');
  if found then
    if j.used_at is not null or j.expires_at <= now() then
      return jsonb_build_object('status', 'expired');
    end if;
    if j.kind = 'self' then
      return jsonb_build_object('status', 'self', 'team', (select name from public.organizations where id = j.organization_id),
                                'who', public.masked_email(public.code_person(j.created_by, j.organization_id)),
                                'byPc', j.computer_id is not null);
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

-- The server function's half (service key only): uses a self code once and says whose account it signs in.
-- `net` is the phone's address as the function saw it; wrong codes count against it like 0018's.
create or replace function public.device_code_redeem(code text, net text default null, device_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  src text := case when nullif(trim(coalesce(net, '')), '') is null then null
                   else 'net:' || public.sha256_hex('source:' || trim(net)) end;
  j public.join_codes;
  email text;
begin
  delete from public.join_failures where at < now() - interval '1 hour';
  if src is not null and (select count(*) from public.join_failures f where f.who = src) >= 60 then
    return jsonb_build_object('status', 'too-many');
  end if;
  select * into j from public.join_codes where code_hash = h and kind = 'self' for update;
  if not found then
    if src is not null then insert into public.join_failures (who) values (src); end if;
    return jsonb_build_object('status', 'wrong');
  end if;
  if j.used_at is not null or j.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  email := public.code_person(j.created_by, j.organization_id);
  if email is null then
    return jsonb_build_object('status', 'expired');
  end if;
  update public.join_codes set used_at = now(), used_by = j.created_by where code_hash = h;
  perform public.security_log(j.created_by, 'signed-in-by-code', null,
    jsonb_build_object('name', left(coalesce(nullif(trim(device_name), ''), 'A device'), 80),
                       'via', case when j.computer_id is null then 'device' else 'pc' end, 'team', j.organization_id));
  return jsonb_build_object('status', 'ok', 'email', email, 'userId', j.created_by, 'organizationId', j.organization_id,
                            'organizationName', (select name from public.organizations where id = j.organization_id));
end;
$$;

-- ---------- 2. Connect this PC from the website ----------

create or replace function public.pc_grant_create(org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := public.random_code(8);
  ends timestamptz := now() + interval '2 minutes';
begin
  if auth.uid() is null or public.request_is_anonymous() or not public.is_org_admin(org) then
    raise exception 'Only owners and admins can connect a PC' using errcode = '42501';
  end if;
  delete from public.join_codes where expires_at < now() - interval '1 day';
  if (select count(*) from public.join_codes where created_by = auth.uid() and kind = 'grant'
      and used_at is null and expires_at > now()) >= 5 then
    raise exception 'Too many codes are open; wait a minute' using errcode = '53400';
  end if;
  insert into public.join_codes (code_hash, kind, organization_id, role, created_by, source_hash, expires_at)
  values (public.code_hash(code), 'grant', org, 'admin', auth.uid(), public.request_source(), ends);
  return jsonb_build_object('code', code, 'expiresAt', ends);
end;
$$;

-- The program, before it asks: which team, and who sent it
create or replace function public.pc_grant_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.join_codes;
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes where code_hash = public.code_hash(code) and kind = 'grant';
  if not found then
    perform public.join_failed();
    return jsonb_build_object('status', 'unknown');
  end if;
  if j.used_at is not null or j.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'grant', 'team', (select name from public.organizations where id = j.organization_id),
                            'by', public.masked_email((select email from auth.users where id = j.created_by)));
end;
$$;

-- The program, after its person said Connect: the PC joins that team with its new key
create or replace function public.pc_link_with_grant(code text, computer_name text, key_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  j public.join_codes;
  new_pc uuid;
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  if key_hash is null or key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad key' using errcode = '22023';
  end if;
  select * into j from public.join_codes
  where code_hash = h and kind = 'grant' and used_at is null and expires_at > now()
  for update;
  if not found then
    perform public.join_failed();
    return jsonb_build_object('status', 'wrong');
  end if;
  if not exists (select 1 from public.memberships where organization_id = j.organization_id and user_id = j.created_by
                 and role in ('owner', 'admin')) then
    return jsonb_build_object('status', 'wrong');
  end if;
  insert into public.computers (organization_id, name, key_hash, created_by)
  values (j.organization_id, left(coalesce(nullif(trim(computer_name), ''), 'Church PC'), 80), key_hash, j.created_by)
  returning id into new_pc;
  update public.join_codes set used_at = now(), used_by = j.created_by, computer_id = new_pc where code_hash = h;
  return jsonb_build_object('status', 'linked', 'computerId', new_pc, 'organizationId', j.organization_id,
                            'organizationName', (select name from public.organizations where id = j.organization_id));
end;
$$;

-- ---------- grants ----------
revoke execute on function public.code_person(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.masked_email(text) from public, anon, authenticated;
revoke execute on function public.device_code_redeem(text, text, text) from public, anon, authenticated;
grant execute on function public.device_code_redeem(text, text, text) to service_role;
revoke execute on function public.device_code_create(uuid) from public, anon;
revoke execute on function public.pc_grant_create(uuid) from public, anon;
grant execute on function public.device_code_create(uuid), public.pc_grant_create(uuid) to authenticated;
-- Open to anon by design: the PC proves itself with its key header (pc_device_code_create), and before it has a key it
-- only looks at and uses a one-time grant (limited like wrong codes)
revoke execute on function public.pc_device_code_create(), public.pc_grant_peek(text),
  public.pc_link_with_grant(text, text, text) from public;
grant execute on function public.pc_device_code_create(), public.pc_grant_peek(text),
  public.pc_link_with_grant(text, text, text) to anon, authenticated;
revoke execute on function public.join_code_peek(text) from public;
grant execute on function public.join_code_peek(text) to anon, authenticated;
