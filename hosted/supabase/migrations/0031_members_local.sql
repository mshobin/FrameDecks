-- 0031 (26.11.65) Member details stay on the church's PC unless the workspace owner chooses to share them.
-- Member records (names, phones, emails, birthdays, groups) used to sync to the cloud like plans do. From now on a
-- workspace keeps them only on its PC unless its owner turns on "Share member details". New workspaces start with
-- sharing off; workspaces made before this keep sharing as they do today, and their owner can turn it off in one click.
-- Two locks: the PC leaves member records out of sync while sharing is off (it reads the setting from sync_pull), and
-- the database itself refuses to store a member record for a workspace that has not chosen to share, whoever sends it.
-- Turning sharing off deletes the workspace's member records, their history and who is in which group from the cloud at
-- once (group names stay); the PC's own list is not touched. Only the owner can change it (not admins), and every
-- change goes to the audit log.
-- Run once in the Supabase SQL editor, after 0030_meeting_together.sql. Undo: supabase/rollback/0031_members_local_down.sql.

alter table public.organizations add column members_shared boolean not null default false;
update public.organizations set members_shared = true;     -- workspaces made before 26.11.65 keep sharing for now

-- Only set_members_shared changes the setting: admins may update a workspace's name, but not this.
create or replace function public.guard_members_shared()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('framedecks.members_shared', true), '') = 'set' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.members_shared := false;                           -- a new workspace always starts with member details local
  elsif new.members_shared is distinct from old.members_shared then
    raise exception 'Only the workspace owner can change where member details are kept' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_members_shared
before insert or update on public.organizations
for each row execute function public.guard_members_shared();

-- The database's own lock: a member record for a workspace that keeps member details local is never stored.
-- (Returning null skips just that row, so the rest of a sync batch still goes through.)
create or replace function public.entities_members_local()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'member'
     and not coalesce((select o.members_shared from public.organizations o where o.id = new.organization_id), false) then
    return null;
  end if;
  return new;
end;
$$;

create trigger entities_members_local
before insert or update on public.entities
for each row execute function public.entities_members_local();

create trigger entity_history_members_local
before insert or update on public.entity_history
for each row execute function public.entities_members_local();

-- The owner's switch. Turning it off removes the workspace's member records and their history from the cloud.
create or replace function public.set_members_shared(org uuid, shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was boolean;
  removed integer := 0;
begin
  if auth.uid() is null or not public.is_org_owner(org) then
    raise exception 'Only the workspace owner can change where member details are kept' using errcode = '42501';
  end if;
  if shared is null then
    raise exception 'Choose on or off' using errcode = '22023';
  end if;
  select members_shared into was from public.organizations where id = org for update;
  if was is distinct from shared then
    perform set_config('framedecks.members_shared', 'set', true);
    update public.organizations set members_shared = shared where id = org;
    perform set_config('framedecks.members_shared', '', true);
    perform public.audit_write(org, 'workspace.members_shared', org::text, jsonb_build_object('to', shared));
  end if;
  if not shared then
    delete from public.entities where organization_id = org and kind = 'member';
    get diagnostics removed = row_count;
    delete from public.entity_history where organization_id = org and kind = 'member';
    delete from public.member_group_members where organization_id = org;     -- who is in which group (names stay)
  end if;
  return jsonb_build_object('shared', shared, 'removed', removed);
end;
$$;

revoke execute on function public.set_members_shared(uuid, boolean) from public, anon;
grant execute on function public.set_members_shared(uuid, boolean) to authenticated;
revoke execute on function public.guard_members_shared() from public, anon, authenticated;
revoke execute on function public.entities_members_local() from public, anon, authenticated;

-- sync_pull as 0003, and it now tells the PC whether member details are shared ("membersShared"), so the PC knows
-- whether to send them. Member records are listed only while sharing is on.
create or replace function public.sync_pull(org uuid, since bigint default 0, max_rows integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller public.computers := public.request_computer();
  sees_members boolean;
  shared boolean := coalesce((select members_shared from public.organizations where id = org), false);
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
  sees_members := sees_members and shared;
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

  return jsonb_build_object('entities', page, 'seq', coalesce(last_seq, coalesce(since, 0)), 'more', more,
                            'membersShared', shared);
end;
$$;
