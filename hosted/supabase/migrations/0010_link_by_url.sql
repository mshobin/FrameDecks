-- 0010 (6.13): one-click linking. The program opens https://framedecks.com/connect#code=… so nobody types the code.
-- Before an owner or admin allows the PC, the page shows which PC asked and how long ago (computer_link_peek).
-- Codes, the PC's key and computer_link_start / _approve / _poll are unchanged (0003); typing the code still works.

create or replace function public.computer_link_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.computer_links;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- The same limit as typing codes (0003): looking codes up cannot be used to guess them
  if (select count(*) from public.computer_link_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into link from public.computer_links
  where code_hash = public.sha256_hex(upper(replace(trim(code), ' ', ''))) and organization_id is null;
  if not found then
    insert into public.computer_link_failures (user_id) values (auth.uid());
    return jsonb_build_object('status', 'unknown');
  end if;
  if link.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  -- A code lives 10 minutes (computer_link_start), so it was asked for 10 minutes before it expires
  return jsonb_build_object(
    'status', 'pending',
    'name', link.name,
    'ageSeconds', greatest(0, extract(epoch from (now() - (link.expires_at - interval '10 minutes')))::integer));
end;
$$;

revoke execute on function public.computer_link_peek(text) from public, anon;
grant execute on function public.computer_link_peek(text) to authenticated;
