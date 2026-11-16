-- Undo 0029: a code made by a PC signs the phone in without the account holder's emailed code again (0021), every
-- member sees every member's email address again (0002), the live channel's door no longer checks Trusted Devices
-- (0016), /connect no longer says whether the PC asked from the same network (0010), deleting an account keeps device
-- names in the change log (0027), and the sweep no longer removes old anonymous sign-ins (0028). Codes made by a PC that
-- are waiting for the emailed code are deleted first, so none of them can be used without it. Anonymous sign-ins
-- already removed stay removed. Only run this to roll back a problem with 0029.
delete from public.join_codes where kind = 'self' and computer_id is not null and used_at is null;
drop function if exists public.device_code_confirm(text, text, text, boolean);
drop function if exists public.device_code_confirm_email(text, text);

create or replace function public.device_code_redeem(code text, net text default null, device_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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

revoke execute on function public.device_code_redeem(text, text, text) from public, anon, authenticated;
grant execute on function public.device_code_redeem(text, text, text) to service_role;

alter table public.join_codes drop column if exists confirm_failures;
alter table public.join_codes drop column if exists confirm_sent_at;

create or replace function public.workspace_members(org uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, m.role, p.display_name, u.email::text, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = org and public.is_org_member(org)
  order by m.created_at;
$$;


create or replace function public.live_topic_allowed(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if topic is null or topic !~ '^live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_run_services(substr(topic, 6)::uuid);
end;
$$;


create or replace function public.computer_link_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.computer_links;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- The same limit as typing codes (0003): looking codes up cannot be used to guess them
  if (select count(*) from public.computer_link_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into link from public.computer_links
  where code_hash = public.sha256_hex(upper(replace(trim(code), ' ', ''))) and organization_id is null;
  if not found then
    insert into public.computer_link_failures (user_id) values (auth.uid());
    return jsonb_build_object('status', 'unknown');
  end if;
  if link.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  -- A code lives 10 minutes (computer_link_start), so it was asked for 10 minutes before it expires
  return jsonb_build_object(
    'status', 'pending',
    'name', link.name,
    'ageSeconds', greatest(0, extract(epoch from (now() - (link.expires_at - interval '10 minutes')))::integer));
end;
$$;

drop function if exists public.request_source_matches(text);

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  mail text;
  blockers text[];
  removed int := 0;
  w record;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;

  select array_agg(o.name order by o.name) into blockers
  from public.memberships m join public.organizations o on o.id = m.organization_id
  where m.user_id = uid and m.role = 'owner'
    and exists (select 1 from public.memberships x where x.organization_id = o.id and x.user_id <> uid)
    and not exists (select 1 from public.memberships x where x.organization_id = o.id and x.user_id <> uid and x.role = 'owner');
  if blockers is not null then
    raise exception 'Make someone else an owner of % first', array_to_string(blockers, ', ')
      using errcode = 'P0001', hint = 'sole-owner';
  end if;

  -- workspaces with nobody else in them go with the account
  for w in
    select o.id from public.organizations o
    where exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id = uid)
      and not exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id <> uid)
  loop
    delete from public.organizations where id = w.id;
    removed := removed + 1;
  end loop;
  -- an empty workspace this person created (no members left) goes too
  delete from public.organizations o
  where o.created_by = uid and not exists (select 1 from public.memberships m where m.organization_id = o.id);

  -- the workspaces they created and still share pass to another owner (or, failing that, an admin, then a member)
  update public.organizations o set created_by = (
    select m.user_id from public.memberships m
    where m.organization_id = o.id and m.user_id <> uid
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
    limit 1)
  where o.created_by = uid;

  -- 9.3 (L11): the name on commands they sent, and their id on synced records and history
  update public.remote_commands set sent_by_name = 'A deleted account' where sent_by = uid;
  update public.entities set updated_by = 'deleted' where updated_by = 'user:' || uid::text;
  update public.entity_history set updated_by = 'deleted' where updated_by = 'user:' || uid::text;

  delete from public.invitations where lower(email) = lower(mail);
  -- 0027 (audit L10): link requests made with this address (kept only as a hash) go with the account
  if mail is not null then
    delete from public.security_events where email_hash = public.sha256_hex('email:' || lower(trim(mail)));
  end if;
  delete from auth.users where id = uid;          -- memberships, profile and sent invitations follow (on delete cascade)

  -- the change log keeps what happened, not who did it
  update public.audit_log set actor = null where actor = uid;
  update public.audit_log set target = 'a deleted account' where target = uid::text or (mail is not null and lower(target) = lower(mail));
  return jsonb_build_object('deleted', true, 'workspacesDeleted', removed);
end;
$$;


create or replace function public.members_phones_sweep()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.request_salts_keep();
  -- rooms that timed out: their words, notes, slides, poll and answers go (a closed room already did this)
  update public.member_rooms
     set closed_at = coalesce(closed_at, closes_at), screen = '{}'::jsonb, notes = null, rev = rev + 1
   where closes_at <= now() and (closed_at is null or screen <> '{}'::jsonb or notes is not null);
  delete from public.room_responses x
   where exists (select 1 from public.member_rooms m where m.computer_id = x.computer_id
                 and (m.closed_at is not null or m.closes_at <= now()));
  delete from public.room_answer_prompts x
   where exists (select 1 from public.member_rooms m where m.computer_id = x.computer_id
                 and (m.closed_at is not null or m.closes_at <= now()));
  delete from public.room_slides x
   where exists (select 1 from public.member_rooms m where m.computer_id = x.computer_id
                 and (m.closed_at is not null or m.closes_at <= now()));
  -- prayer walls that closed or timed out: requests the PC never took go; none is kept longer than 24 hours
  delete from public.prayer_requests r
   where r.created_at < now() - interval '24 hours'
      or exists (select 1 from public.prayer_walls w where w.computer_id = r.computer_id
                 and (w.closed_at is not null or w.closes_at <= now()));
  delete from public.join_failures where at < now() - interval '1 hour';
end;
$$;

