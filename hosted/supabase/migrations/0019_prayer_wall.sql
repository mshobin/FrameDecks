-- 0019 (26.11.23) Prayer requests wall.
-- The church PC opens a prayer wall for the meeting and shows a short code (and a QR to framedecks.com/pray#c=CODE).
-- Anyone in the meeting can send a prayer request from their phone, with no account and no sign-in: only the code.
-- The PC takes the requests in (and the cloud forgets them at that moment); the leader reads them first and chooses
-- what is shown, anonymously or with the first name the person gave. Nothing is kept in the cloud: requests the PC
-- never took are deleted after 24 hours, and the wall closes by itself after a few hours.
-- Limits: a wrong code counts like a wrong join code (join_blocked / join_failed, 0018); one network can send 5
-- requests in 10 minutes; a wall holds at most 300 waiting requests.

create table public.prayer_walls (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  closed_at timestamptz
);
alter table public.prayer_walls enable row level security;      -- no policies: only the functions below touch it

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  computer_id uuid not null references public.computers (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  name text check (name is null or char_length(name) between 1 and 40),
  source_hash text,
  created_at timestamptz not null default now()
);
create index prayer_requests_pc_idx on public.prayer_requests (computer_id, created_at);
create index prayer_requests_source_idx on public.prayer_requests (source_hash, created_at);
alter table public.prayer_requests enable row level security;   -- no policies: only the functions below touch it

-- By the church PC (its key header): open the wall (a new code each time; the old one stops working)
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

create or replace function public.pc_prayer_close()
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
  update public.prayer_walls set closed_at = now() where computer_id = pc.id and closed_at is null;
end;
$$;

-- The PC takes the waiting requests in; they are deleted from the cloud in the same step.
create or replace function public.pc_prayer_take()
returns table (id uuid, body text, name text, created_at timestamptz)
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
  delete from public.prayer_requests r where r.created_at < now() - interval '24 hours';
  return query
    with taken as (delete from public.prayer_requests r where r.computer_id = pc.id
                   returning r.id, r.body, r.name, r.created_at)
    select t.id, t.body, t.name, t.created_at from taken t order by t.created_at;
end;
$$;

-- The open wall a code belongs to (null when unknown, closed or run out)
create or replace function public.prayer_wall_of(code text)
returns public.prayer_walls
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prayer_walls w
  where w.code_hash = public.code_hash(code) and w.closed_at is null and w.closes_at > now()
$$;

-- Before anything is typed: is this code a wall that is open? (limited like wrong join codes)
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

-- A person in the meeting sends a request: only the words, and a first name if they want it said
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

revoke execute on function public.prayer_wall_of(text) from public, anon, authenticated;
-- Open to anon by design: the PC calls with the anon key and proves itself with its key header (request_computer);
-- people in the meeting send with only the code (no account), limited per network and like wrong codes.
revoke execute on function public.pc_prayer_open(integer), public.pc_prayer_close(), public.pc_prayer_take(),
  public.prayer_peek(text), public.prayer_send(text, text, text) from public;
grant execute on function public.pc_prayer_open(integer), public.pc_prayer_close(), public.pc_prayer_take(),
  public.prayer_peek(text), public.prayer_send(text, text, text) to anon, authenticated;
