-- Undo 0030: who is here, raised hands, the quiz and the take-home page are removed, with every row they held (only
-- hashed phone ids and optional first names). prayer_send goes back to 0028 (it no longer returns the request's id).
-- Members' phones (0020), polls (0022), typed answers (0026) and everything else are untouched. Only run this to roll
-- back a problem with 0030.
drop trigger if exists room_together_forget on public.member_rooms;
drop function if exists public.room_together_forget();
drop function if exists public.room_takehome(text);
drop function if exists public.room_quiz_answer(text, text, uuid, integer);
drop function if exists public.room_quiz_view(text, text);
drop function if exists public.room_hand(text, text, boolean);
drop function if exists public.room_checkin(text, text, text);
drop function if exists public.pc_takehome_remove();
drop function if exists public.pc_takehome_publish(jsonb, integer);
drop function if exists public.pc_room_quiz_results();
drop function if exists public.pc_room_quiz_close();
drop function if exists public.pc_room_quiz_reveal();
drop function if exists public.pc_room_quiz_open(text, jsonb, integer, integer);
drop function if exists public.pc_room_hand_down(text);
drop function if exists public.pc_room_people();
drop table if exists public.room_takehome;
drop table if exists public.room_quiz_answers;
drop table if exists public.room_quiz;
drop table if exists public.room_people;

-- prayer_send exactly as 0028
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
