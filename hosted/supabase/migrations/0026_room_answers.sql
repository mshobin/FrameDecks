-- 0026 (26.11.57) Typed answers from members' phones, for a discussion question.
-- While members' phones are open (0020), the leader can ask people to type a short answer to the question on screen
-- ("What stood out to you?"). Phones on framedecks.com/follow show the prompt under the screen; each phone sends one
-- answer (up to 280 characters) and can change it while the prompt is open. Nothing reaches the screen by itself: the
-- leader reads the answers in the Studio and chooses which to show (as a Memory Card, without a name).
-- One answer per phone: the phone sends a random id it keeps for itself; only its SHA-256 is stored, never the id, no
-- names and no accounts. Opening a new prompt removes the last one and its answers. A prompt belongs to the room it was
-- opened in: a new room (a new code) never shows an old prompt.
-- Only the PC opens, closes and reads the answers (by its key). A phone reads the prompt and answers with only the
-- room's code; wrong codes are limited like room_view (join_blocked / join_failed, 0018).

create table public.room_answer_prompts (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  prompt text not null check (char_length(prompt) between 1 and 200),
  opened_at timestamptz not null default now(),
  closed boolean not null default false,
  rev bigint not null default 1
);
alter table public.room_answer_prompts enable row level security;   -- no policies: only the functions below touch it

create table public.room_answers (
  prompt_id uuid not null references public.room_answer_prompts (id) on delete cascade,
  voter_hash text not null check (voter_hash ~ '^[0-9a-f]{64}$'),
  body text not null check (char_length(body) between 1 and 280),
  sent_at timestamptz not null default now(),
  primary key (prompt_id, voter_hash)
);
alter table public.room_answers enable row level security;          -- no policies: only the functions below touch it

-- By the church PC (its key header): ask for typed answers in the open room (the last prompt and its answers go)
create or replace function public.pc_room_answers_open(prompt text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  words text := left(btrim(regexp_replace(coalesce(prompt, ''), '[[:cntrl:]]+', ' ', 'g')), 200);
  prev public.room_answer_prompts;
  r public.room_answer_prompts;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member_rooms m where m.computer_id = pc.id and m.closed_at is null and m.closes_at > now()) then
    raise exception 'Open members’ phones first' using errcode = '22023';
  end if;
  if char_length(words) < 1 then
    raise exception 'Type what people should answer' using errcode = '22023';
  end if;
  select * into prev from public.room_answer_prompts x where x.computer_id = pc.id;
  delete from public.room_answer_prompts x where x.computer_id = pc.id;    -- its answers go with it
  insert into public.room_answer_prompts (computer_id, prompt, opened_at, closed, rev)
  values (pc.id, words, now(), false, coalesce(prev.rev, 0) + 1)
  returning * into r;
  update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;   -- phones look again
  return jsonb_build_object('id', r.id, 'prompt', r.prompt, 'openedAt', r.opened_at);
end;
$$;

create or replace function public.pc_room_answers_close()
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
  update public.room_answer_prompts set closed = true, rev = rev + 1 where computer_id = pc.id and not closed;
  if found then
    update public.member_rooms m set rev = m.rev + 1 where m.computer_id = pc.id;
  end if;
end;
$$;

-- The leader's view: the last prompt (open or closed) with its answers, newest first, or null when there is none
create or replace function public.pc_room_answers_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  r public.room_answer_prompts;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into r from public.room_answer_prompts x where x.computer_id = pc.id;
  if r.id is null then
    return null;
  end if;
  return jsonb_build_object('id', r.id, 'prompt', r.prompt, 'open', not r.closed, 'openedAt', r.opened_at,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('id', substr(a.voter_hash, 1, 12), 'body', a.body, 'at', a.sent_at)
                                          order by a.sent_at desc), '[]'::jsonb)
                from (select * from public.room_answers y where y.prompt_id = r.id order by y.sent_at desc limit 300) a));
end;
$$;

-- The open prompt of the room a code belongs to, or null (helper for the two phone functions below)
create or replace function public.room_open_prompt(m public.member_rooms)
returns public.room_answer_prompts
language sql
stable
security definer
set search_path = public
as $$
  select * from public.room_answer_prompts r
  where r.computer_id = m.computer_id and not r.closed and r.opened_at >= m.opened_at
    and m.closed_at is null and m.closes_at > now()
$$;

-- A phone in the meeting: the open prompt (and this phone's own answer when it sends its id), or null
create or replace function public.room_prompt(code text, voter text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.member_rooms;
  r public.room_answer_prompts;
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
  r := public.room_open_prompt(m);
  if r.id is null then
    return jsonb_build_object('status', 'open', 'prompt', null);
  end if;
  return jsonb_build_object('status', 'open', 'prompt', jsonb_build_object('id', r.id, 'text', r.prompt,
    'mine', (select y.body from public.room_answers y where y.prompt_id = r.id
             and y.voter_hash = public.sha256_hex(coalesce(voter, '')) and char_length(coalesce(voter, '')) between 8 and 100)));
end;
$$;

-- A phone sends (or changes) its answer. `prompt` (optional) is the prompt the phone saw: when the leader has asked
-- something else since, nothing is kept and the phone is told to look again.
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

revoke execute on function public.room_open_prompt(public.member_rooms) from public, anon, authenticated;
-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer);
-- people in the meeting read the prompt and answer with only the room's code (no account), limited like wrong codes.
revoke execute on function public.pc_room_answers_open(text), public.pc_room_answers_close(), public.pc_room_answers_list(),
  public.room_prompt(text, text), public.room_answer(text, text, text, uuid) from public;
grant execute on function public.pc_room_answers_open(text), public.pc_room_answers_close(), public.pc_room_answers_list(),
  public.room_prompt(text, text), public.room_answer(text, text, text, uuid) to anon, authenticated;
