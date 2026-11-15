-- 0025 (26.11.48) Members' phones: the slides, sharper and to look back at.
-- While members' phones are open (0020) and a PowerPoint deck is on the meeting screen, the church PC sends each slide
-- it shows, once: a sharp picture (a JPEG, at most about 300 KB), its title and its words. The room's screen (0020,
-- limited to 16,000 bytes) keeps only a small picture of the slide on screen now; phones fetch the sharp one by its
-- number to zoom in, look back at the slides already shown (never ahead), and keep them with the sermon notes.
-- Only slides that were on the meeting screen are sent, never the rest of the deck; a deck or slide the leader keeps
-- off the phones is never sent. Everything here goes when the room closes or a new room is opened.
-- Only the PC writes (by its key). A phone reads with only the room's code; wrong codes are limited like room_view.

create table public.room_slides (
  computer_id uuid not null references public.computers (id) on delete cascade,
  room_opened timestamptz not null,
  page integer not null check (page between 0 and 999),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 600),
  img text check (img is null or (char_length(img) <= 400000 and img ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')),
  shown_at timestamptz not null default now(),
  primary key (computer_id, page)
);
alter table public.room_slides enable row level security;       -- no policies: only the functions below touch it

-- A room that closes, or a new room opened by the same PC, takes its slides with it
create or replace function public.room_slides_forget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.closed_at is not null or new.opened_at is distinct from old.opened_at then
    delete from public.room_slides s where s.computer_id = new.computer_id;
  end if;
  return new;
end;
$$;
create trigger room_slides_forget after update of closed_at, opened_at on public.member_rooms
  for each row execute function public.room_slides_forget();

-- By the church PC (its key header): a slide that is on the meeting screen now. img null keeps the picture sent before.
create or replace function public.pc_room_slide(page integer, title text default '', body text default '', img text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  pc public.computers := public.request_computer();
  m public.member_rooms;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  select * into m from public.member_rooms r where r.computer_id = pc.id and r.closed_at is null and r.closes_at > now();
  if m.computer_id is null then
    raise exception 'The room is closed' using errcode = '22023';
  end if;
  if (select count(*) from public.room_slides s where s.computer_id = pc.id and s.page <> pc_room_slide.page) >= 300 then
    raise exception 'Too many slides in this meeting' using errcode = '22023';
  end if;
  insert into public.room_slides as s (computer_id, room_opened, page, title, body, img, shown_at)
  values (pc.id, m.opened_at, pc_room_slide.page, left(coalesce(pc_room_slide.title, ''), 120),
          left(coalesce(pc_room_slide.body, ''), 600), pc_room_slide.img, now())
  on conflict (computer_id, page) do update set room_opened = excluded.room_opened, title = excluded.title,
    body = excluded.body, img = coalesce(excluded.img, s.img), shown_at = now();
end;
$$;

-- The open room of a code, or null; a wrong code counts like room_view (0020)
create or replace function public.room_by_code(code text)
returns public.member_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.member_rooms;
begin
  select * into m from public.member_rooms r where r.code_hash = public.code_hash(code);
  if m.computer_id is null then
    if public.join_blocked(20) then
      raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
    end if;
    perform public.join_failed();
    return null;
  end if;
  if m.closed_at is not null or m.closes_at <= now() then
    return null;
  end if;
  return m;
end;
$$;

-- A phone: the slides shown so far in this room (number, title, words; no pictures), in the order of the deck
create or replace function public.room_slides(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.member_rooms := public.room_by_code(code);
begin
  if m.computer_id is null then
    return jsonb_build_object('status', 'unknown');
  end if;
  return jsonb_build_object('status', 'open', 'slides', coalesce((
    select jsonb_agg(jsonb_build_object('page', s.page, 'title', s.title, 'body', s.body, 'img', s.img is not null) order by s.page)
    from public.room_slides s where s.computer_id = m.computer_id and s.room_opened = m.opened_at), '[]'::jsonb));
end;
$$;

-- A phone: one slide shown in this room, with its sharp picture
create or replace function public.room_slide(code text, page integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  m public.member_rooms := public.room_by_code(code);
  s public.room_slides;
begin
  if m.computer_id is null then
    return jsonb_build_object('status', 'unknown');
  end if;
  select * into s from public.room_slides x
  where x.computer_id = m.computer_id and x.room_opened = m.opened_at and x.page = room_slide.page;
  if s.computer_id is null then
    return jsonb_build_object('status', 'none');
  end if;
  return jsonb_build_object('status', 'open', 'page', s.page, 'title', s.title, 'body', s.body, 'img', s.img);
end;
$$;

-- Open to anon by design, as 0020: the PC proves itself with its key header; phones read with only the room's code.
revoke execute on function public.pc_room_slide(integer, text, text, text), public.room_slides(text),
  public.room_slide(text, integer) from public;
revoke execute on function public.room_by_code(text) from public, anon, authenticated;
revoke execute on function public.room_slides_forget() from public, anon, authenticated;
grant execute on function public.pc_room_slide(integer, text, text, text), public.room_slides(text),
  public.room_slide(text, integer) to anon, authenticated;
