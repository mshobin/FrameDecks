-- 0028 (26.11.58, release sign-off items 2-6):
--  * M4: a wrong-code lock is checked only after a code is not found, so one network that guessed wrong (church Wi-Fi,
--    a carrier's shared address) never blocks phones that have the right code: prayer_peek, prayer_send, room_respond,
--    room_answer. prayer_send now answers {"sent": false, "status": "closed"} for an unknown code instead of an error,
--    so the wrong guess is counted (an error undid the count).
--  * M3: room and prayer codes have 8 characters (31^8, about 8.5e11) instead of 6; an IPv6 address counts as its /64,
--    so one home or phone network is one source.
--  * M5: owner-only admin rules on the tables too (0013/0018 already had them in the functions): only the owner invites
--    an admin or removes one; admins invite and remove members.
--  * M6: a source is hashed with a key that changes every day and is deleted after two days, so a stored hash can never
--    be turned back into an address; closing a room removes its poll, votes, typed-answer prompt and answers; a sweep
--    (hourly with pg_cron when it is switched on, and whenever a PC opens a room or wall) clears rooms and walls that
--    timed out, with their slides, polls, answers and untaken prayer requests.
-- Rollback: supabase/rollback/0028_codes_limits_retention_down.sql.

-- M6: the daily key for hashing a source ---------------------------------------------------------------------------
create table if not exists public.request_salts (
  day date primary key,
  salt text not null
);
alter table public.request_salts enable row level security;     -- no policies: only the functions below touch it
revoke all on public.request_salts from public, anon, authenticated;

create or replace function public.request_salts_keep()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.request_salts (day, salt)
  select d::date, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  from generate_series(current_date - 1, current_date + 7, interval '1 day') d
  on conflict (day) do nothing;
  delete from public.request_salts where day < current_date - 1;
end;
$$;
revoke execute on function public.request_salts_keep() from public, anon, authenticated;
select public.request_salts_keep();

create or replace function public.request_source()
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  a text := trim(split_part(coalesce(
              nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
              nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
  s text;
begin
  -- the caller's address as Supabase's gateway passes it, hashed with today's key; null outside the API
  if a is null or a = '' then
    return null;
  end if;
  if position(':' in a) > 0 then
    begin
      a := host(network(set_masklen(a::inet, 64)));   -- 0028: an IPv6 address counts as its /64
    exception when others then
      null;
    end;
  end if;
  select r.salt into s from public.request_salts r where r.day = current_date;
  return public.sha256_hex('source:' || coalesce(s, '') || ':' || a);
end;
$$;
revoke execute on function public.request_source() from public, anon, authenticated;

-- M6: the sweep ------------------------------------------------------------------------------------------------------
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
revoke execute on function public.members_phones_sweep() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('framedecks-members-phones-sweep', '17 * * * *', 'select public.members_phones_sweep()');
  end if;
end;
$$;

-- M4, M3, M6: the functions that change ------------------------------------------------------------------------------
create or replace function public.prayer_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.prayer_walls := public.prayer_wall_of(code);
begin
  if w.computer_id is null then
    if not exists (select 1 from public.prayer_walls x where x.code_hash = public.code_hash(code)) then
      if public.join_blocked(20) then
        raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
      end if;
      perform public.join_failed();
      return jsonb_build_object('status', 'unknown');
    end if;
    return jsonb_build_object('status', 'closed');
  end if;
  return jsonb_build_object('status', 'open', 'team', (select o.name from public.organizations o where o.id = w.organization_id));
end;
$$;

create or replace function public.prayer_send(code text, body text, name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.prayer_walls := public.prayer_wall_of(code);
  src text := public.request_source();
  words text := left(btrim(regexp_replace(coalesce(body, ''), '[[:cntrl:]]+', ' ', 'g')), 500);
  who text := nullif(left(btrim(regexp_replace(coalesce(name, ''), '[[:cntrl:]]+', ' ', 'g')), 40), '');
begin
  if w.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('sent', false, 'status', 'closed');
  end if;
  if char_length(words) < 2 then
    raise exception 'Write your prayer request first' using errcode = '22023';
  end if;
  if src is not null and (select count(*) from public.prayer_requests r
                          where r.source_hash = src and r.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Thank you: please wait a few minutes before sending another' using errcode = '53400';
  end if;
  if (select count(*) from public.prayer_requests r where r.computer_id = w.computer_id) >= 300 then
    raise exception 'The prayer wall is full for now; please try again in a minute' using errcode = '53400';
  end if;
  insert into public.prayer_requests (computer_id, body, name, source_hash) values (w.computer_id, words, who, src);
  return jsonb_build_object('sent', true);
end;
$$;

create or replace function public.room_respond(code text, voter text, choice integer, response uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  r public.room_responses;
  who text := public.sha256_hex(coalesce(voter, ''));
begin
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'unknown');
  end if;
  r := public.room_open_response(m);
  if r.id is null then
    return jsonb_build_object('status', 'closed');
  end if;
  if response is not null and response <> r.id then
    return jsonb_build_object('status', 'changed');
  end if;
  if char_length(coalesce(voter, '')) not between 8 and 100 then
    raise exception 'This phone could not be told apart; reload the page' using errcode = '22023';
  end if;
  if choice is null or choice < 0 or choice >= jsonb_array_length(r.options) then
    raise exception 'Choose one of the answers' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_votes y where y.response_id = r.id and y.voter_hash = who)
     and (select count(*) from public.room_votes y where y.response_id = r.id) >= 2000 then
    raise exception 'This question has all the answers it can take' using errcode = '53400';
  end if;
  insert into public.room_votes (response_id, voter_hash, choice) values (r.id, who, room_respond.choice)
  on conflict (response_id, voter_hash) do update set choice = excluded.choice, voted_at = now();
  if r.show_results then
    update public.room_responses x set rev = x.rev + 1 where x.computer_id = r.computer_id;   -- the bars move
  end if;
  return jsonb_build_object('status', 'in', 'choice', room_respond.choice);
end;
$$;

create or replace function public.room_answer(code text, voter text, body text, prompt uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  r public.room_answer_prompts;
  who text := public.sha256_hex(coalesce(voter, ''));
  words text := left(btrim(regexp_replace(coalesce(body, ''), '[[:cntrl:]]+', ' ', 'g')), 280);
begin
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'unknown');
  end if;
  r := public.room_open_prompt(m);
  if r.id is null then
    return jsonb_build_object('status', 'closed');
  end if;
  if prompt is not null and prompt <> r.id then
    return jsonb_build_object('status', 'changed');
  end if;
  if char_length(coalesce(voter, '')) not between 8 and 100 then
    raise exception 'This phone could not be told apart; reload the page' using errcode = '22023';
  end if;
  if char_length(words) < 1 then
    raise exception 'Type your answer first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_answers y where y.prompt_id = r.id and y.voter_hash = who)
     and (select count(*) from public.room_answers y where y.prompt_id = r.id) >= 1000 then
    raise exception 'This question has all the answers it can take' using errcode = '53400';
  end if;
  insert into public.room_answers (prompt_id, voter_hash, body) values (r.id, who, words)
  on conflict (prompt_id, voter_hash) do update set body = excluded.body, sent_at = now();
  return jsonb_build_object('status', 'in');
end;
$$;

create or replace function public.pc_prayer_open(hours integer default 4)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(8);
  ends timestamptz := now() + make_interval(hours => least(greatest(coalesce(hours, 4), 1), 12));
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  perform public.members_phones_sweep();
  insert into public.prayer_walls (computer_id, organization_id, code_hash, opened_at, closes_at, closed_at)
  values (pc.id, pc.organization_id, public.code_hash(code), now(), ends, null)
  on conflict (computer_id) do update set organization_id = excluded.organization_id, code_hash = excluded.code_hash,
    opened_at = excluded.opened_at, closes_at = excluded.closes_at, closed_at = null;
  return jsonb_build_object('code', code, 'closesAt', ends);
end;
$$;

create or replace function public.pc_room_open(hours integer default 6)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(8);
  ends timestamptz := now() + make_interval(hours => least(greatest(coalesce(hours, 6), 1), 12));
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  perform public.members_phones_sweep();
  insert into public.member_rooms (computer_id, organization_id, code_hash, opened_at, closes_at, closed_at, rev, screen, notes)
  values (pc.id, pc.organization_id, public.code_hash(code), now(), ends, null, 1, '{}'::jsonb, null)
  on conflict (computer_id) do update set organization_id = excluded.organization_id, code_hash = excluded.code_hash,
    opened_at = excluded.opened_at, closes_at = excluded.closes_at, closed_at = null,
    rev = public.member_rooms.rev + 1, screen = '{}'::jsonb, notes = null;
  return jsonb_build_object('code', code, 'closesAt', ends);
end;
$$;

create or replace function public.pc_room_close()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  update public.member_rooms set closed_at = now(), screen = '{}'::jsonb, notes = null, rev = rev + 1
  where computer_id = pc.id and closed_at is null;
  delete from public.room_responses where computer_id = pc.id;          -- 0028 (M6): the poll and its votes go too
  delete from public.room_answer_prompts where computer_id = pc.id;     -- and the typed-answer prompt with its answers
end;
$$;

-- M5: owner-only admin rules on the tables -----------------------------------------------------------------------
drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (invited_by = auth.uid()
              and (public.is_org_owner(organization_id) or (public.is_org_admin(organization_id) and role = 'member')));

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (user_id = auth.uid()
         or (public.is_org_owner(organization_id) and role <> 'owner')
         or (public.is_org_admin(organization_id) and role = 'member'));
