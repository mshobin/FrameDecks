-- 0030 (26.11.63) Meeting together on members' phones: who is here, raised hands, a quick quiz and a take-home page.
-- While members' phones are open (0020), people can say they are here (with a first name if they wish), raise a hand
-- to say "I'd like to share", and answer a short quiz question the leader asks (one answer per phone, timed by the
-- server). Only the PC sees who is here, the hands and the quiz answers; the correct answer reaches phones only once
-- the leader reveals it. After the meeting the leader can publish a take-home page (verses, questions, songs, notes,
-- prayers the leader marked OK to share, next time) that members open with the same code during the week.
-- Privacy: no accounts. Each phone sends a random id it keeps for itself; only its SHA-256 is stored, never the id.
-- Names are optional, and the names, hands, quiz and answers are gone when the room closes, times out or a new room is
-- opened. The take-home page is kept for the days the leader chooses, up to 14, then removed. prayer_send now also
-- returns the new request's id, so the asker's phone can follow whether it was prayed for or answered (the take-home
-- page lists only ids and a status, never the words, unless the leader marked a request OK to share).
-- Only the PC writes these (by its key). A phone uses only the room's code; wrong codes are limited like room_answer
-- (0028: join_blocked / join_failed, checked only after a code is not found).
-- Rollback: supabase/rollback/0030_meeting_together_down.sql.

create table public.room_people (
  computer_id uuid not null references public.computers (id) on delete cascade,
  voter_hash text not null check (voter_hash ~ '^[0-9a-f]{64}$'),
  name text check (name is null or char_length(name) between 1 and 40),
  joined_at timestamptz not null default now(),
  hand_at timestamptz,
  seen_at timestamptz not null default now(),
  primary key (computer_id, voter_hash)
);
alter table public.room_people enable row level security;       -- no policies: only the functions below touch it
revoke all on public.room_people from public, anon, authenticated;

create table public.room_quiz (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 200),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  correct integer not null check (correct between 0 and 3),
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  revealed boolean not null default false,
  rev bigint not null default 1,
  check (correct < jsonb_array_length(options))
);
alter table public.room_quiz enable row level security;         -- no policies: only the functions below touch it
revoke all on public.room_quiz from public, anon, authenticated;

create table public.room_quiz_answers (
  quiz_id uuid not null references public.room_quiz (id) on delete cascade,
  voter_hash text not null check (voter_hash ~ '^[0-9a-f]{64}$'),
  choice integer not null check (choice between 0 and 3),
  ms integer not null check (ms >= 0),                          -- milliseconds after the quiz opened (by the server)
  primary key (quiz_id, voter_hash)
);
alter table public.room_quiz_answers enable row level security; -- no policies: only the functions below touch it
revoke all on public.room_quiz_answers from public, anon, authenticated;

create table public.room_takehome (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),   -- the same hash as member_rooms.code_hash
  body jsonb not null check (octet_length(body::text) <= 64000),
  published_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.room_takehome enable row level security;     -- no policies: only the functions below touch it
revoke all on public.room_takehome from public, anon, authenticated;

-- A room that closes (by the PC, timed out in the sweep, or a revoked PC) or a new room (a new code) takes who was here,
-- the hands, the quiz and its answers with it. The take-home page stays: members read it during the week.
create or replace function public.room_together_forget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (old.closed_at is null and new.closed_at is not null) or new.code_hash is distinct from old.code_hash then
    delete from public.room_people p where p.computer_id = new.computer_id;
    delete from public.room_quiz q where q.computer_id = new.computer_id;   -- its answers go with it
  end if;
  return new;
end;
$$;
revoke execute on function public.room_together_forget() from public, anon, authenticated;

drop trigger if exists room_together_forget on public.member_rooms;
create trigger room_together_forget after update of closed_at, code_hash on public.member_rooms
  for each row execute function public.room_together_forget();

-- By the church PC (its key header) ----------------------------------------------------------------------------------

-- Who is here in the open room, first in first: [{"id", "name", "joined", "hand"}] ([] when no room is open)
create or replace function public.pc_room_people()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  m public.member_rooms;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into m from public.member_rooms x where x.computer_id = pc.id and x.closed_at is null and x.closes_at > now();
  if m.computer_id is null then
    return '[]'::jsonb;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', substr(p.voter_hash, 1, 12), 'name', p.name,
                                                       'joined', p.joined_at, 'hand', p.hand_at)
                                    order by p.joined_at, p.voter_hash), '[]'::jsonb)
          from public.room_people p where p.computer_id = pc.id and p.joined_at >= m.opened_at);
end;
$$;

-- Lower one hand (`who` is the 12-character id from pc_room_people) or, with no id, every hand
create or replace function public.pc_room_hand_down(who text default null)
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
  update public.room_people p set hand_at = null
   where p.computer_id = pc.id and p.hand_at is not null
     and (who is null or substr(p.voter_hash, 1, 12) = lower(btrim(who)));
  if found then
    update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;   -- phones look again
  end if;
end;
$$;

-- Ask a quiz question in the open room (the last quiz and its answers go). seconds: how long phones may answer.
create or replace function public.pc_room_quiz_open(question text, options jsonb, correct integer, seconds integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  words text := left(btrim(regexp_replace(coalesce(pc_room_quiz_open.question, ''), '[[:cntrl:]]+', ' ', 'g')), 200);
  answers jsonb := '[]'::jsonb;
  item jsonb;
  one_answer text;
  prev public.room_quiz;
  r public.room_quiz;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member_rooms m where m.computer_id = pc.id and m.closed_at is null and m.closes_at > now()) then
    raise exception 'Open members’ phones first' using errcode = '22023';
  end if;
  if char_length(words) < 1 then
    raise exception 'Type the question first' using errcode = '22023';
  end if;
  if pc_room_quiz_open.options is null or jsonb_typeof(pc_room_quiz_open.options) <> 'array'
     or jsonb_array_length(pc_room_quiz_open.options) not between 2 and 4 then
    raise exception 'Give 2 to 4 answers' using errcode = '22023';
  end if;
  for item in select x.value from jsonb_array_elements(pc_room_quiz_open.options) x loop
    if jsonb_typeof(item) <> 'string' then
      raise exception 'Give 2 to 4 answers' using errcode = '22023';
    end if;
    one_answer := left(btrim(regexp_replace(item #>> '{}', '[[:cntrl:]]+', ' ', 'g')), 80);
    if char_length(one_answer) < 1 then
      raise exception 'Every answer needs some words' using errcode = '22023';
    end if;
    answers := answers || jsonb_build_array(one_answer);
  end loop;
  if pc_room_quiz_open.correct is null or pc_room_quiz_open.correct < 0
     or pc_room_quiz_open.correct >= jsonb_array_length(answers) then
    raise exception 'Choose the right answer' using errcode = '22023';
  end if;
  select * into prev from public.room_quiz x where x.computer_id = pc.id;
  delete from public.room_quiz x where x.computer_id = pc.id;    -- its answers go with it
  insert into public.room_quiz (computer_id, question, options, correct, opened_at, closes_at, revealed, rev)
  values (pc.id, words, answers, pc_room_quiz_open.correct, now(),
          now() + make_interval(secs => least(greatest(coalesce(pc_room_quiz_open.seconds, 20), 5), 120)),
          false, coalesce(prev.rev, 0) + 1)
  returning * into r;
  update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;   -- phones look again
  return jsonb_build_object('id', r.id, 'closesAt', r.closes_at);
end;
$$;

-- Show the right answer on phones (answering stops)
create or replace function public.pc_room_quiz_reveal()
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
  update public.room_quiz q set revealed = true, closes_at = least(q.closes_at, now()), rev = q.rev + 1
   where q.computer_id = pc.id;
  if found then
    update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;
  end if;
end;
$$;

-- Take the quiz off phones (its answers go)
create or replace function public.pc_room_quiz_close()
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
  delete from public.room_quiz q where q.computer_id = pc.id;
  if found then
    update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;
  end if;
end;
$$;

-- The leader's view: the quiz with every answer (fastest first), or null when there is none
create or replace function public.pc_room_quiz_results()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  r public.room_quiz;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into r from public.room_quiz x where x.computer_id = pc.id;
  if r.id is null then
    return null;
  end if;
  return jsonb_build_object('id', r.id, 'question', r.question, 'options', r.options, 'correct', r.correct,
    'revealed', r.revealed, 'closesAt', r.closes_at,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('id', substr(a.voter_hash, 1, 12), 'choice', a.choice, 'ms', a.ms)
                                          order by a.ms, a.voter_hash), '[]'::jsonb)
                from public.room_quiz_answers a where a.quiz_id = r.id));
end;
$$;

-- Publish (or replace) the take-home page under this PC's room code (the room may already be closed). days: 1 to 14.
create or replace function public.pc_takehome_publish(body jsonb, days integer default 8)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pc public.computers := public.request_computer();
  m public.member_rooms;
  ends timestamptz := now() + make_interval(days => least(greatest(coalesce(pc_takehome_publish.days, 8), 1), 14));
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into m from public.member_rooms x where x.computer_id = pc.id;
  if m.computer_id is null then
    raise exception 'Open members’ phones first' using errcode = '22023';
  end if;
  if pc_takehome_publish.body is null or jsonb_typeof(pc_takehome_publish.body) <> 'object' then
    raise exception 'The take-home page is empty' using errcode = '22023';
  end if;
  if octet_length(pc_takehome_publish.body::text) > 64000 then
    raise exception 'The take-home page is too long' using errcode = '22023';
  end if;
  delete from public.room_takehome t where t.expires_at <= now();
  delete from public.room_takehome t where t.code_hash = m.code_hash and t.computer_id <> pc.id;   -- the code is this room's now
  insert into public.room_takehome (computer_id, code_hash, body, published_at, expires_at)
  values (pc.id, m.code_hash, pc_takehome_publish.body, now(), ends)
  on conflict (computer_id) do update set code_hash = excluded.code_hash, body = excluded.body,
    published_at = excluded.published_at, expires_at = excluded.expires_at;
  if m.closed_at is null and m.closes_at > now() then
    update public.member_rooms x set rev = x.rev + 1 where x.computer_id = pc.id;   -- phones look again
  end if;
  return jsonb_build_object('expiresAt', ends);
end;
$$;

create or replace function public.pc_takehome_remove()
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
  delete from public.room_takehome t where t.computer_id = pc.id;
end;
$$;

-- By a phone in the meeting (only the room's code) ------------------------------------------------------------------

-- Say "I'm here", with a first name or none. Checking in again keeps the time joined and changes the name.
create or replace function public.room_checkin(code text, voter text, name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  who text := public.sha256_hex(coalesce(voter, ''));
  first_name text := nullif(btrim(left(btrim(regexp_replace(coalesce(room_checkin.name, ''), '[[:cntrl:]]+', '', 'g')), 40)), '');
begin
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'unknown');
  end if;
  if m.closed_at is not null or m.closes_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  if char_length(coalesce(voter, '')) not between 8 and 100 then
    raise exception 'This phone could not be told apart; reload the page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_people p where p.computer_id = m.computer_id and p.voter_hash = who)
     and (select count(*) from public.room_people p where p.computer_id = m.computer_id) >= 300 then
    raise exception 'This meeting is full' using errcode = '53400';
  end if;
  insert into public.room_people (computer_id, voter_hash, name) values (m.computer_id, who, first_name)
  on conflict (computer_id, voter_hash) do update set name = excluded.name, seen_at = now();
  return jsonb_build_object('status', 'in');
end;
$$;

-- Raise or lower this phone's hand ("I'd like to share"). The PC sees it in pc_room_people.
create or replace function public.room_hand(code text, voter text, up boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  who text := public.sha256_hex(coalesce(voter, ''));
  raised boolean := coalesce(up, false);           -- up null: only report the hand, change nothing
begin
  select * into m from public.member_rooms x where x.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
    return jsonb_build_object('status', 'unknown');
  end if;
  if m.closed_at is not null or m.closes_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  if char_length(coalesce(voter, '')) not between 8 and 100 then
    raise exception 'This phone could not be told apart; reload the page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_people p where p.computer_id = m.computer_id and p.voter_hash = who)
     and (select count(*) from public.room_people p where p.computer_id = m.computer_id) >= 300 then
    raise exception 'This meeting is full' using errcode = '53400';
  end if;
  if up is null then                               -- just asking: is my hand still up (the leader may have lowered it)
    return jsonb_build_object('status', 'in', 'hand', exists (select 1 from public.room_people p
      where p.computer_id = m.computer_id and p.voter_hash = who and p.hand_at is not null));
  end if;
  insert into public.room_people (computer_id, voter_hash, name, hand_at)
  values (m.computer_id, who, null, case when raised then now() end)
  on conflict (computer_id, voter_hash) do update
    set hand_at = case when raised then coalesce(public.room_people.hand_at, now()) end, seen_at = now();
  return jsonb_build_object('status', 'in', 'hand', raised);
end;
$$;

-- The quiz in the open room (and this phone's own answer when it sends its id). The right answer only once revealed.
create or replace function public.room_quiz_view(code text, voter text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  r public.room_quiz;
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
  select * into r from public.room_quiz q where q.computer_id = m.computer_id and q.opened_at >= m.opened_at;
  if r.id is null then
    return jsonb_build_object('status', 'open', 'quiz', null);
  end if;
  return jsonb_build_object('status', 'open', 'quiz', jsonb_build_object('id', r.id, 'question', r.question,
    'options', r.options, 'closesAt', r.closes_at, 'revealed', r.revealed,
    'mine', (select a.choice from public.room_quiz_answers a where a.quiz_id = r.id
             and a.voter_hash = public.sha256_hex(coalesce(voter, '')) and char_length(coalesce(voter, '')) between 8 and 100))
    || case when r.revealed then jsonb_build_object('correct', r.correct) else '{}'::jsonb end);   -- never before
end;
$$;

-- A phone answers the quiz, once (no changing). `quiz` is the quiz the phone saw: when the leader has asked another
-- since, nothing is kept and the phone is told to look again. After the time runs out or the answer is shown: late.
create or replace function public.room_quiz_answer(code text, voter text, quiz uuid, choice integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.member_rooms;
  r public.room_quiz;
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
  if m.closed_at is not null or m.closes_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  select * into r from public.room_quiz q where q.computer_id = m.computer_id and q.opened_at >= m.opened_at;
  if r.id is null then
    return jsonb_build_object('status', 'closed');
  end if;
  if room_quiz_answer.quiz is not null and room_quiz_answer.quiz <> r.id then
    return jsonb_build_object('status', 'changed');
  end if;
  if char_length(coalesce(voter, '')) not between 8 and 100 then
    raise exception 'This phone could not be told apart; reload the page' using errcode = '22023';
  end if;
  if exists (select 1 from public.room_quiz_answers a where a.quiz_id = r.id and a.voter_hash = who) then
    return jsonb_build_object('status', 'already');
  end if;
  if r.revealed or r.closes_at <= now() then
    return jsonb_build_object('status', 'late');
  end if;
  if room_quiz_answer.choice is null or room_quiz_answer.choice < 0 or room_quiz_answer.choice >= jsonb_array_length(r.options) then
    raise exception 'Choose one of the answers' using errcode = '22023';
  end if;
  if (select count(*) from public.room_quiz_answers a where a.quiz_id = r.id) >= 2000 then
    raise exception 'This question has all the answers it can take' using errcode = '53400';
  end if;
  insert into public.room_quiz_answers (quiz_id, voter_hash, choice, ms)
  values (r.id, who, room_quiz_answer.choice,
          least(greatest(floor(extract(epoch from (now() - r.opened_at)) * 1000), 0), 2147483647)::integer)
  on conflict (quiz_id, voter_hash) do nothing;
  if not found then
    return jsonb_build_object('status', 'already');
  end if;
  return jsonb_build_object('status', 'in');
end;
$$;

-- The take-home page for a room's code (open or closed), while it has not run out
create or replace function public.room_takehome(code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text := public.code_hash(code);
  t public.room_takehome;
begin
  delete from public.room_takehome x where x.expires_at <= now();
  select * into t from public.room_takehome x where x.code_hash = h and x.expires_at > now();
  if t.computer_id is not null then
    return jsonb_build_object('status', 'ok', 'body', t.body, 'expiresAt', t.expires_at);
  end if;
  if not exists (select 1 from public.member_rooms x where x.code_hash = h) then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();                  -- an answer, not an error: an error would undo the count
  end if;
  return jsonb_build_object('status', 'none');
end;
$$;

-- prayer_send as 0028, but a request that is sent also returns its id, so the asker's phone can follow its status
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
  new_id uuid;
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
  insert into public.prayer_requests (computer_id, body, name, source_hash) values (w.computer_id, words, who, src)
  returning id into new_id;
  return jsonb_build_object('sent', true, 'id', new_id);
end;
$$;

-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer);
-- people in the meeting check in, raise a hand, answer the quiz and read the take-home page with only the room's code
-- (no account), limited like wrong codes.
revoke execute on function public.pc_room_people(), public.pc_room_hand_down(text),
  public.pc_room_quiz_open(text, jsonb, integer, integer), public.pc_room_quiz_reveal(), public.pc_room_quiz_close(),
  public.pc_room_quiz_results(), public.pc_takehome_publish(jsonb, integer), public.pc_takehome_remove(),
  public.room_checkin(text, text, text), public.room_hand(text, text, boolean), public.room_quiz_view(text, text),
  public.room_quiz_answer(text, text, uuid, integer), public.room_takehome(text) from public;
grant execute on function public.pc_room_people(), public.pc_room_hand_down(text),
  public.pc_room_quiz_open(text, jsonb, integer, integer), public.pc_room_quiz_reveal(), public.pc_room_quiz_close(),
  public.pc_room_quiz_results(), public.pc_takehome_publish(jsonb, integer), public.pc_takehome_remove(),
  public.room_checkin(text, text, text), public.room_hand(text, text, boolean), public.room_quiz_view(text, text),
  public.room_quiz_answer(text, text, uuid, integer), public.room_takehome(text) to anon, authenticated;
