-- Undo 0009: back to writing last_seen_at on every call (the 0003 version of request_computer).
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
  update public.computers set last_seen_at = now()
  where key_hash = public.sha256_hex(key) and revoked_at is null
  returning * into found_computer;
  return found_computer;
end;
$$;

revoke execute on function public.request_computer() from public, anon, authenticated;
