-- 0029 (26.11.58, release sign-off, cloud hardening):
--  * H2: a church PC's key could open the website as the person who connected that PC: its Add a device code (0021)
--    signed the phone straight in. Now a code made by a PC asks the account holder first: device_code_redeem answers
--    'confirm' (the code is not used), the server function device-sign-in emails that person a one-time 6-digit code,
--    and only once Supabase Auth has accepted those digits does device_code_confirm use the code and sign the phone in.
--    A wrong 6-digit code never uses the scanned code; five wrong ones end it, and wrong codes still count against the
--    network. A code made on the website by a signed-in person (computer_id null) works exactly as before.
--  * L6: workspace_members shows email addresses to owners and admins only; everyone else sees their own address and
--    null for the others (same columns, so the website keeps working).
--  * L12: a removed or expired Trusted Device's session cannot join a live channel either (Realtime's door,
--    live_topic_allowed), as the Data API already refuses it (0015 check_trusted_session).
--  * L9: before an owner or admin allows a PC (/connect), computer_link_peek also says whether the PC asked from the same
--    network as this browser (compared through the hashed source; no address is stored or returned).
--  * L10: deleting an account also takes that person's device names out of the change log.
--  * The sweep (0028 members_phones_sweep) also removes anonymous phone sign-ins older than 30 days that are in no team
--    and started none. A phone that joined a team is never removed.
-- Rollback: supabase/rollback/0029_cloud_hardening_down.sql.

-- H2 -------------------------------------------------------------------------------------------------------------
alter table public.join_codes add column if not exists confirm_sent_at timestamptz;   -- the account holder was emailed
alter table public.join_codes add column if not exists confirm_failures integer not null default 0;

-- The server function's first step (service key only), as 0021, except for a code made by a PC: that one is not used
-- here. It answers 'confirm' with the address to email (`send` says whether to email now: at most once a minute), and
-- the code then lasts 10 minutes so there is time to read the email.
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
  send boolean;
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
  if j.computer_id is not null then
    -- 0029 (H2): made by a PC: the account holder confirms with an emailed code first
    send := j.confirm_sent_at is null or j.confirm_sent_at < now() - interval '60 seconds';
    update public.join_codes
       set confirm_sent_at = case when send then now() else confirm_sent_at end,
           expires_at = case when j.confirm_sent_at is null then greatest(expires_at, now() + interval '10 minutes')
                             else expires_at end
     where code_hash = h;
    return jsonb_build_object('status', 'confirm', 'email', email, 'who', public.masked_email(email), 'send', send);
  end if;
  update public.join_codes set used_at = now(), used_by = j.created_by where code_hash = h;
  perform public.security_log(j.created_by, 'signed-in-by-code', null,
    jsonb_build_object('name', left(coalesce(nullif(trim(device_name), ''), 'A device'), 80),
                       'via', 'device', 'team', j.organization_id));
  return jsonb_build_object('status', 'ok', 'email', email, 'userId', j.created_by, 'organizationId', j.organization_id,
                            'organizationName', (select name from public.organizations where id = j.organization_id));
end;
$$;

-- The server function, with the 6 digits in hand: which address to check them against. Nothing is used or changed.
create or replace function public.device_code_confirm_email(code text, net text default null)
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
  select * into j from public.join_codes
   where code_hash = h and kind = 'self' and computer_id is not null and confirm_sent_at is not null;
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
  return jsonb_build_object('status', 'confirm', 'email', email);
end;
$$;

-- The server function, after Supabase Auth checked the 6 digits: otp_ok true uses the code (the phone is signed in);
-- false counts a wrong try, and the fifth wrong try ends the code.
create or replace function public.device_code_confirm(code text, net text default null, device_name text default null,
                                                      otp_ok boolean default false)
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
  tries integer;
begin
  select * into j from public.join_codes
   where code_hash = h and kind = 'self' and computer_id is not null and confirm_sent_at is not null
   for update;
  if not found then
    if src is not null then insert into public.join_failures (who) values (src); end if;
    return jsonb_build_object('status', 'wrong');
  end if;
  if j.used_at is not null or j.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if not coalesce(otp_ok, false) then
    tries := j.confirm_failures + 1;
    update public.join_codes
       set confirm_failures = tries, used_at = case when tries >= 5 then now() else null end
     where code_hash = h;
    if src is not null then insert into public.join_failures (who) values (src); end if;
    return jsonb_build_object('status', case when tries >= 5 then 'otp-used-up' else 'otp-wrong' end,
                              'left', greatest(0, 5 - tries));
  end if;
  email := public.code_person(j.created_by, j.organization_id);
  if email is null then
    return jsonb_build_object('status', 'expired');
  end if;
  update public.join_codes set used_at = now(), used_by = j.created_by where code_hash = h;
  perform public.security_log(j.created_by, 'signed-in-by-code', null,
    jsonb_build_object('name', left(coalesce(nullif(trim(device_name), ''), 'A device'), 80),
                       'via', 'pc', 'confirmed', true, 'team', j.organization_id));
  return jsonb_build_object('status', 'ok', 'email', email, 'userId', j.created_by, 'organizationId', j.organization_id,
                            'organizationName', (select name from public.organizations where id = j.organization_id));
end;
$$;

revoke execute on function public.device_code_redeem(text, text, text) from public, anon, authenticated;
revoke execute on function public.device_code_confirm_email(text, text) from public, anon, authenticated;
revoke execute on function public.device_code_confirm(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.device_code_redeem(text, text, text), public.device_code_confirm_email(text, text),
  public.device_code_confirm(text, text, text, boolean) to service_role;

-- L6 -------------------------------------------------------------------------------------------------------------
create or replace function public.workspace_members(org uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, m.role, p.display_name,
         case when public.is_org_admin(org) or m.user_id = auth.uid() then u.email::text end,
         m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = org and public.is_org_member(org)
  order by m.created_at;
$$;
revoke execute on function public.workspace_members(uuid) from public, anon;
grant execute on function public.workspace_members(uuid) to authenticated;

-- L12 ------------------------------------------------------------------------------------------------------------
create or replace function public.live_topic_allowed(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := public.request_session();
begin
  if topic is null or topic !~ '^live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  -- 0029 (L12): the same refusal as the Data API's for a removed or expired Trusted Device's session
  if sid is not null and exists (select 1 from public.trusted_devices
                                 where session_id = sid and (revoked_at is not null or expires_at <= now())) then
    return false;
  end if;
  return public.can_run_services(substr(topic, 6)::uuid);
end;
$$;
revoke execute on function public.live_topic_allowed(text) from public, anon;
grant execute on function public.live_topic_allowed(text) to authenticated;

-- L9 -------------------------------------------------------------------------------------------------------------
-- Is a stored source hash this request's network? Hashes use a daily key (0028), so today's and yesterday's are tried
-- (a code lives 10 minutes and may cross midnight). Null when either side is unknown.
create or replace function public.request_source_matches(h text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a text := trim(split_part(coalesce(
              nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
              nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
begin
  if h is null or a is null or a = '' then
    return null;
  end if;
  if position(':' in a) > 0 then
    begin
      a := host(network(set_masklen(a::inet, 64)));   -- as request_source: an IPv6 address counts as its /64
    exception when others then
      null;
    end;
  end if;
  return h = public.sha256_hex('source::' || a)
      or exists (select 1 from public.request_salts r
                 where r.day in (current_date, current_date - 1)
                   and public.sha256_hex('source:' || r.salt || ':' || a) = h);
end;
$$;
revoke execute on function public.request_source_matches(text) from public, anon, authenticated;

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
  -- A code lives 10 minutes (computer_link_start), so it was asked for 10 minutes before it expires.
  -- 0029 (L9): and whether it came from this browser's network (true / false; null when it cannot be told)
  return jsonb_build_object(
    'status', 'pending',
    'name', link.name,
    'ageSeconds', greatest(0, extract(epoch from (now() - (link.expires_at - interval '10 minutes')))::integer),
    'sameNetwork', public.request_source_matches(link.source_hash));
end;
$$;
revoke execute on function public.computer_link_peek(text) from public, anon;
grant execute on function public.computer_link_peek(text) to authenticated;

-- L10 (as 0027, plus the device names in the change log) ----------------------------------------------------------
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
  -- 0029 (L10): the names they gave their devices leave the change log (the entries stay, as "A device")
  update public.audit_log set detail = detail || jsonb_build_object('name', 'A device')
   where action like 'device.%' and detail ? 'name'
     and (actor = uid or target in (select d.id::text from public.trusted_devices d where d.user_id = uid));
  delete from auth.users where id = uid;          -- memberships, profile and sent invitations follow (on delete cascade)

  -- the change log keeps what happened, not who did it
  update public.audit_log set actor = null where actor = uid;
  update public.audit_log set target = 'a deleted account' where target = uid::text or (mail is not null and lower(target) = lower(mail));
  return jsonb_build_object('deleted', true, 'workspacesDeleted', removed);
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- The sweep (as 0028, plus old anonymous sign-ins) ------------------------------------------------------------------
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
  -- 0029: anonymous phone sign-ins (no email) older than 30 days that are in no team and started none go, at most 200
  -- each time. A helper phone that joined a team has a membership and is never touched. Supabase's auth.users says
  -- is_anonymous; where it does not (an older Auth), nothing is removed. A problem here never stops the sweep.
  if exists (select 1 from information_schema.columns
             where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous') then
    begin
      execute $q$
        delete from auth.users u
         where u.id in (select x.id from auth.users x
                         where x.is_anonymous is true
                           and nullif(trim(coalesce(x.email, '')), '') is null
                           and x.created_at < now() - interval '30 days'
                           and not exists (select 1 from public.memberships m where m.user_id = x.id)
                           and not exists (select 1 from public.organizations o where o.created_by = x.id)
                         limit 200)
      $q$;
    exception when others then
      raise warning 'members_phones_sweep: anonymous sign-ins were not cleared (%)', sqlerrm;
    end;
  end if;
end;
$$;
revoke execute on function public.members_phones_sweep() from public, anon, authenticated;
