-- Undo 0031: the "Share member details" switch and the database's lock on member records are removed, and sync_pull
-- goes back to 0003 (it no longer says whether member details are shared). Member records deleted from the cloud while
-- sharing was off are not brought back; a PC that syncs again sends its list. Only run this to roll back a problem
-- with 0031.
drop trigger if exists entity_history_members_local on public.entity_history;
drop trigger if exists entities_members_local on public.entities;
drop trigger if exists organizations_members_shared on public.organizations;
drop function if exists public.set_members_shared(uuid, boolean);
drop function if exists public.entities_members_local();
drop function if exists public.guard_members_shared();
alter table public.organizations drop column if exists members_shared;

-- sync_pull as 0003 (with the pg_temp search path 0029 gave every function)
create or replace function public.sync_pull(org uuid, since bigint default 0, max_rows integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller public.computers := public.request_computer();
  sees_members boolean;
  page jsonb;
  last_seq bigint;
  more boolean;
begin
  if caller.id is not null and caller.organization_id = org then
    sees_members := true;
  elsif auth.uid() is not null and public.is_org_member(org) then
    sees_members := public.is_org_admin(org);
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  max_rows := least(greatest(coalesce(max_rows, 500), 1), 500);

  with batch as (
    select * from public.entities
    where organization_id = org and seq > coalesce(since, 0)
    order by seq
    limit max_rows + 1
  ), numbered as (
    select *, row_number() over (order by seq) as n from batch
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object('kind', kind, 'id', id, 'rev', rev, 'seq', seq, 'deleted', deleted, 'body', body,
                         'updatedBy', updated_by, 'updatedAt', updated_at)
      order by seq
    ) filter (where n <= max_rows and (kind <> 'member' or sees_members)), '[]'::jsonb),
    max(seq) filter (where n <= max_rows),
    count(*) > max_rows
  into page, last_seq, more
  from numbered;

  return jsonb_build_object('entities', page, 'seq', coalesce(last_seq, coalesce(since, 0)), 'more', more);
end;
$$;
