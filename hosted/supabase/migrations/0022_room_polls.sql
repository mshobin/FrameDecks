-- 0022 (26.11.33) Quick responses and polls from members' phones.
-- While members' phones are open (0020), the leader can ask one thing at a time: Yes / No, a poll (pick one of 2 to 6
-- answers the leader typed) or a rating from 1 to 5. Phones on framedecks.com/follow show the question under the
-- screen; each phone answers once and can change its answer while the question is open. The leader chooses whether
-- phones see the live results.
-- One answer per phone: the phone sends a random id it keeps for itself; only its SHA-256 is stored, never the id, no
-- names and no accounts. Opening a new question removes the last one and its answers. A question belongs to the room
-- it was opened in: a new room (a new code) never shows an old question.
-- Only the PC opens, closes and counts (by its key). A phone reads and answers with only the room's code; wrong codes
-- are limited like room_view (join_blocked / join_failed, 0018).

create table public.room_responses (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 200),
  kind text not null check (kind in ('yesno', 'choice', 'rating')),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6
                                and octet_length(options::text) <= 1000),
  show_results boolean not null default false,
  opened_at timestamptz not null default now(),
  closed boolean not null default false,
  closed_at timestamptz,
  rev bigint not null default 1
);
alter table public.room_responses enable row level security;     -- no policies: only the functions below touch it

create table public.room_votes (
  response_id uuid not null references public.room_responses (id) on delete cascade,
  voter_hash text not null check (voter_hash ~ '^[0-9a-f]{64}$'),
  choice smallint not null check (choice between 0 and 5),
  voted_at timestamptz not null default now(),
  primary key (response_id, voter_hash)
);
alter table public.room_votes enable row level security;         -- no policies: only the functions below touch it

-- The counts of one question: one number per answer, and how many phones answered
create or replace function public.room_response_counts(r public.room_responses)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'counts', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by i.i), '[]'::jsonb)
               from generate_series(0, jsonb_array_length(r.options) - 1) as i(i)
               left join (select v.choice, count(*)::int as n from public.room_votes v
                          where v.response_id = r.id group by v.choice) c on c.choice = i.i),
    'total', (select count(*)::int from public.room_votes v where v.response_id = r.id))
$$;

-- By the church PC (its key header): ask one thing in the open room (the last question and its answers go)
create or replace function public.pc_room_response_open(question text, kind text, options jsonb default null,
                                                        show_results boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  words text := left(btrim(regexp_replace(coalesce(question, ''), '[[:cntrl:]]+', ' ', 'g')), 200);
  k text := lower(btrim(coalesce(kind, '')));
  opts jsonb;
  prev public.room_responses;
  r public.room_responses;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member_rooms m where m.computer_id = pc.id and m.closed_at is null and m.closes_at > now()) then
    raise exception 'Open members’ phones first' using errcode = '22023';
  end if;
  if k = 'poll' then
    k := 'choice';                                  -- "poll" is what people call a choice
  end if;
  if char_length(words) < 1 then
    raise exception 'Type the question first' using errcode = '22023';
  end if;
  if k = 'yesno' then
    opts := '["Yes", "No"]'::jsonb;
  elsif k = 'rating' then
    opts := '["1", "2", "3", "4", "5"]'::jsonb;
  elsif k = 'choice' then
    if jsonb_typeof(pc_room_response_open.options) is distinct from 'array' then
      raise exception 'A poll needs its answers' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(t.o order by t.n), '[]'::jsonb) into opts
    from (select left(btrim(regexp_replace(coalesce(e.v, ''), '[[:cntrl:]]+', ' ', 'g')), 60) as o, e.n
          from jsonb_array_elements_text(pc_room_response_open.options) with ordinality as e(v, n)) t
    where t.o <> '';
    if jsonb_array_length(opts) not between 2 and 6 then
      raise exception 'A poll needs 2 to 6 answers' using errcode = '22023';
    end if;
  else
    raise exception 'Choose Yes / No, a poll or a rating' using errcode = '22023';
  end if;
  select * into prev from public.room_responses x where x.computer_id = pc.id;
  delete from public.room_responses x where x.computer_id = pc.id;    -- its answers go with it
  insert into public.room_responses (computer_id, question, kind, options, show_results, opened_at, closed, closed_at, rev)
  values (pc.id, words, k, opts, coalesce(pc_room_response_open.show_results, false), now(), false, null, coalesce(prev.rev, 0) + 1)
  returning * into r;
  update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;   -- phones look again
  return jsonb_build_object('id', r.id, 'question', r.question, 'kind', r.kind, 'options', r.options,
                            'showResults', r.show_results, 'openedAt', r.opened_at);
end;
$$;

create or replace function public.pc_room_response_close()
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
  update public.room_responses set closed = true, closed_at = now(), rev = rev + 1
  where computer_id = pc.id and not closed;
  if found then
    update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;
  end if;
end;
$$;

-- The leader's view: the last question (open or closed) with its counts, or null when there is none
create or replace function public.pc_room_response_results()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  r public.room_responses;
  m public.member_rooms;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into r from public.room_responses x where x.computer_id = pc.id;
  if r.id is null then
    return null;
  end if;
  select * into m from public.member_rooms x where x.computer_id = pc.id;
  return jsonb_build_object('id', r.id, 'question', r.question, 'kind', r.kind, 'options', r.options,
                            'showResults', r.show_results, 'openedAt', r.opened_at,
                            'open', coalesce(not r.closed and m.closed_at is null and m.closes_at > now() and r.opened_at >= m.opened_at, false))
         || public.room_response_counts(r);
end;
$$;

-- The open question of the room a code belongs to, or null (helper for the two phone functions below)
create or replace function public.room_open_response(m public.member_rooms)
returns public.room_responses
language sql
stable
security definer
set search_path = public
as $$
  select * from public.room_responses r
  where r.computer_id = m.computer_id and not r.closed and r.opened_at >= m.opened_at
    and m.closed_at is null and m.closes_at > now()
$$;

-- A phone in the meeting: the open question, or {"same": true} when nothing changed since `after`. The counts only
-- when the leader shows the results; `mine` is this phone's own answer when it sends its id.
-- An open room is read without touching the wrong-code counters (phones ask every few seconds).
create or replace function public.room_response(code text, after bigint default 0, voter text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.member_rooms;
  r public.room_responses;
  v bigint;
  body jsonb;
begin
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();
    return jsonb_build_object('status', 'unknown');
  end if;
  if m.closed_at is not null or m.closes_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  r := public.room_open_response(m);
  v := coalesce((select x.rev from public.room_responses x where x.computer_id = m.computer_id), 0);
  if v = coalesce(after, 0) and v > 0 then
    return jsonb_build_object('status', 'open', 'rev', v, 'same', true);
  end if;
  if r.id is null then
    return jsonb_build_object('status', 'open', 'rev', v, 'response', null);
  end if;
  body := jsonb_build_object('id', r.id, 'question', r.question, 'kind', r.kind, 'options', r.options,
                            'showResults', r.show_results,
                            'mine', (select y.choice from public.room_votes y where y.response_id = r.id
                                     and y.voter_hash = public.sha256_hex(coalesce(voter, ''))
                                     and char_length(coalesce(voter, '')) between 8 and 100));
  if r.show_results then
    body := body || public.room_response_counts(r);
  end if;
  return jsonb_build_object('status', 'open', 'rev', v, 'response', body);
end;
$$;

-- A phone answers (or changes its answer). `response` (optional) is the question the phone saw: when the leader has
-- asked something else since, nothing is counted and the phone is told to look again.
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

revoke execute on function public.room_response_counts(public.room_responses) from public, anon, authenticated;
revoke execute on function public.room_open_response(public.member_rooms) from public, anon, authenticated;
-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer);
-- people in the meeting read and answer with only the room's code (no account), limited like wrong codes.
revoke execute on function public.pc_room_response_open(text, text, jsonb, boolean), public.pc_room_response_close(),
  public.pc_room_response_results(), public.room_response(text, bigint, text),
  public.room_respond(text, text, integer, uuid) from public;
grant execute on function public.pc_room_response_open(text, text, jsonb, boolean), public.pc_room_response_close(),
  public.pc_room_response_results(), public.room_response(text, bigint, text),
  public.room_respond(text, text, integer, uuid) to anon, authenticated;
