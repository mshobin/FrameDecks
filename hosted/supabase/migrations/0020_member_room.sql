-- 0020 (26.11.24) Members' phones: follow along, and the sermon notes.
-- The church PC opens a room for the meeting and shows one code (and a QR to framedecks.com/follow#c=CODE). Anyone in
-- the meeting opens it on their phone with no account and sees what is on the meeting screen as it changes: the Frame's
-- name, the question, the scripture (the text people can already see). When the prayer wall is open the room tells the
-- page its code, so the same page takes prayer requests. After the meeting the leader can share the sermon notes there.
-- Only the PC writes (by its key). A phone reads one row by its code; wrong codes are limited like join codes (0018).
-- The room closes by itself after a few hours; what it held is gone when it closes or when a new room is opened.

create table public.member_rooms (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  closed_at timestamptz,
  rev bigint not null default 0,
  screen jsonb not null default '{}'::jsonb check (octet_length(screen::text) <= 16000),
  notes jsonb check (notes is null or octet_length(notes::text) <= 120000)
);
alter table public.member_rooms enable row level security;      -- no policies: only the functions below touch it

-- By the church PC (its key header): open a room (a new code each time; the old one stops working, its content goes)
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

-- What phones show: the screen now, and the notes when shared (null: not shared, or taken back)
create or replace function public.pc_room_publish(screen jsonb, notes jsonb default null, set_notes boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.computers := public.request_computer();
  r bigint;
begin
  if pc.id is null then
    raise exception 'This PC is not connected' using errcode = '42501';
  end if;
  if jsonb_typeof(screen) is distinct from 'object' then
    raise exception 'The screen must be an object' using errcode = '22023';
  end if;
  update public.member_rooms m set screen = pc_room_publish.screen,
    notes = case when set_notes then pc_room_publish.notes else m.notes end, rev = m.rev + 1
  where m.computer_id = pc.id and m.closed_at is null and m.closes_at > now()
  returning m.rev into r;
  if r is null then
    raise exception 'The room is closed' using errcode = '22023';
  end if;
  return r;
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

-- A phone in the meeting: the room's screen and notes, or {"same": true} when nothing changed since `after`.
-- An open room is read without touching the wrong-code counters (phones ask every few seconds).
create or replace function public.room_view(code text, after bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  m public.member_rooms;
begin
  select * into m from public.member_rooms r where r.code_hash = h;
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
  if m.rev = coalesce(after, 0) then
    return jsonb_build_object('status', 'open', 'rev', m.rev, 'same', true);
  end if;
  return jsonb_build_object('status', 'open', 'rev', m.rev, 'screen', m.screen, 'notes', m.notes,
                            'team', (select o.name from public.organizations o where o.id = m.organization_id));
end;
$$;

-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer);
-- people in the meeting read one room with only its code (no account), limited like wrong codes.
revoke execute on function public.pc_room_open(integer), public.pc_room_publish(jsonb, jsonb, boolean),
  public.pc_room_close(), public.room_view(text, bigint) from public;
grant execute on function public.pc_room_open(integer), public.pc_room_publish(jsonb, jsonb, boolean),
  public.pc_room_close(), public.room_view(text, bigint) to anon, authenticated;
