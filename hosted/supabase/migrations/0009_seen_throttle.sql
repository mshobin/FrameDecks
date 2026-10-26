-- 0009: a linked PC's "last seen" time is written at most once a minute (production audit M10).
-- Before, every sync read (sync_pull/sync_push) also wrote public.computers.last_seen_at, one database write per poll.
-- Same answer, same checks, same grants: only the write is skipped when the time is less than a minute old.
-- Run once in the Supabase SQL editor, after 0008. Undo: rollback/0009_seen_throttle_down.sql.

create or replace function public.request_computer()
returns public.computers
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := nullif(current_setting('request.headers', true), '')::json ->> 'x-framedecks-computer';
  found_computer public.computers;
begin
  if key is null or char_length(key) < 32 then
    return null;
  end if;
  select * into found_computer from public.computers
  where key_hash = public.sha256_hex(key) and revoked_at is null;
  if found_computer.id is null then
    return null;
  end if;
  if found_computer.last_seen_at is null or found_computer.last_seen_at < now() - interval '1 minute' then
    update public.computers set last_seen_at = now() where id = found_computer.id
    returning * into found_computer;
  end if;
  return found_computer;
end;
$$;

revoke execute on function public.request_computer() from public, anon, authenticated;
