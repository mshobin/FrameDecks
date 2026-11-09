-- Undo 0021: Add a device signs in as you, and Connect this PC from the website, are removed. Codes of those kinds are
-- deleted; join_code_peek goes back to 0018's. Only run this to roll back a problem with 0021.
drop function if exists public.pc_link_with_grant(text, text, text);
drop function if exists public.pc_grant_peek(text);
drop function if exists public.pc_grant_create(uuid);
drop function if exists public.device_code_redeem(text, text, text);
drop function if exists public.pc_device_code_create();
drop function if exists public.device_code_create(uuid);
delete from public.join_codes where kind in ('self', 'grant');
alter table public.join_codes drop constraint if exists join_codes_kind_check;
alter table public.join_codes add constraint join_codes_kind_check check (kind in ('invite', 'request'));

create or replace function public.join_code_peek(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := public.code_hash(code);
  j public.join_codes;
  link public.computer_links;
begin
  if public.join_blocked(20) then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into j from public.join_codes where code_hash = h and kind = 'invite';
  if found then
    if j.used_at is not null or j.expires_at <= now() then
      return jsonb_build_object('status', 'expired');
    end if;
    return jsonb_build_object('status', 'invite', 'team', (select name from public.organizations where id = j.organization_id),
                              'role', j.role, 'byPc', j.computer_id is not null);
  end if;
  select * into link from public.computer_links where code_hash = h and organization_id is null;
  if found then
    if link.expires_at <= now() then
      return jsonb_build_object('status', 'expired');
    end if;
    return jsonb_build_object('status', 'pc', 'pc', link.name);
  end if;
  perform public.join_failed();
  return jsonb_build_object('status', 'unknown');
end;
$$;

drop function if exists public.masked_email(text);
drop function if exists public.code_person(uuid, uuid);
