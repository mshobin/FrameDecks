-- Undo 0028: codes go back to 6 characters, the wrong-code lock is checked first again, prayer_send raises for an
-- unknown code, admins may invite admins and remove other admins on the tables, sources are hashed without a daily key,
-- and the sweep and its schedule are removed. Rooms and walls already swept stay cleared. Only run this to roll back a
-- problem with 0028.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('framedecks-members-phones-sweep');
  end if;
exception when others then
  null;
end;
$$;

create or replace function public.prayer_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.prayer_walls := public.prayer_wall_of(code);
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  if w.computer_id is null then
    if not exists (select 1 from public.prayer_walls x where x.code_hash = public.code_hash(code)) then
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
set search_path = public
as $$
declare
  w public.prayer_walls := public.prayer_wall_of(code);
  src text := public.request_source();
  words text := left(btrim(regexp_replace(coalesce(body, ''), '[[:cntrl:]]+', ' ', 'g')), 500);
  who text := nullif(left(btrim(regexp_replace(coalesce(name, ''), '[[:cntrl:]]+', ' ', 'g')), 40), '');
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  if w.computer_id is null then
    perform public.join_failed();
    raise exception 'This prayer wall is closed' using errcode = '22023';
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
set search_path = public
as $$
declare
  m public.member_rooms;
  r public.room_responses;
  who text := public.sha256_hex(coalesce(voter, ''));
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
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
set search_path = public
as $$
declare
  m public.member_rooms;
  r public.room_answer_prompts;
  who text := public.sha256_hex(coalesce(voter, ''));
  words text := left(btrim(regexp_replace(coalesce(body, ''), '[[:cntrl:]]+', ' ', 'g')), 280);
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
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
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(6);
  ends timestamptz := now() + make_interval(hours => least(greatest(coalesce(hours, 4), 1), 12));
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
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
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  code text := public.random_code(6);
  ends timestamptz := now() + make_interval(hours => least(greatest(coalesce(hours, 6), 1), 12));
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
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
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  update public.member_rooms set closed_at = now(), screen = '{}'::jsonb, notes = null, rev = rev + 1
  where computer_id = pc.id and closed_at is null;
end;
$$;

create or replace function public.request_source()
returns text
language sql
stable
set search_path = public
as $$
  -- the caller's address as Supabase's gateway passes it (first of x-forwarded-for), hashed; null outside the API
  select case when a is null or a = '' then null else public.sha256_hex('source:' || a) end
  from (select trim(split_part(coalesce(
          nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
          nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)) as a) s
$$;
revoke execute on function public.request_source() from public, anon, authenticated;

drop function if exists public.members_phones_sweep();
drop function if exists public.request_salts_keep();
drop table if exists public.request_salts;

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_org_admin(organization_id) and invited_by = auth.uid());

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (user_id = auth.uid() or (public.is_org_admin(organization_id) and role <> 'owner'));
