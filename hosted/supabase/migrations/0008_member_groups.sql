-- FrameDecks migration step 8 (M-D6, docs/migration-plan.md): member groups, kept in the cloud and edited in the
-- companion only. The desktop is unchanged and never sees groups: a group lists member record ids (sync kind
-- 'member'), so the member records themselves, and what PCs sync, stay exactly as they are.
-- Owners and admins only, like the member records. Run once in the Supabase SQL editor, after
-- 0007_data_api_grants.sql. Undo: supabase/rollback/0008_member_groups_down.sql.

create table public.member_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (name = trim(name) and char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index member_groups_name_idx on public.member_groups (organization_id, lower(name));

create table public.member_group_members (
  organization_id uuid not null,
  group_id uuid not null,
  member_id text not null check (char_length(member_id) between 1 and 40),
  primary key (group_id, member_id),
  -- a group's people are always in the group's own workspace
  foreign key (group_id, organization_id) references public.member_groups (id, organization_id) on delete cascade
);

create index member_group_members_org_idx on public.member_group_members (organization_id, member_id);

alter table public.member_groups enable row level security;
alter table public.member_group_members enable row level security;

create policy member_groups_select on public.member_groups
  for select to authenticated using (public.is_org_admin(organization_id));
create policy member_groups_insert on public.member_groups
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy member_groups_update on public.member_groups
  for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy member_groups_delete on public.member_groups
  for delete to authenticated using (public.is_org_admin(organization_id));

create policy member_group_members_select on public.member_group_members
  for select to authenticated using (public.is_org_admin(organization_id));
create policy member_group_members_insert on public.member_group_members
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy member_group_members_delete on public.member_group_members
  for delete to authenticated using (public.is_org_admin(organization_id));

-- Supabase (from 30 October 2026) gives new tables no API access without these.
grant select, insert, update, delete on table public.member_groups to authenticated;
grant select, insert, delete on table public.member_group_members to authenticated;
grant select, insert, update, delete on table public.member_groups, public.member_group_members to service_role;

-- The audit log (0006): groups made, renamed and removed.
create or replace function public.audit_member_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.organization_id, 'group.created', new.id::text, jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    perform public.audit_write(old.organization_id, 'group.removed', old.id::text, jsonb_build_object('name', old.name));
  elsif new.name is distinct from old.name then
    perform public.audit_write(new.organization_id, 'group.renamed', new.id::text,
                               jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  return null;
end;
$$;

create trigger member_groups_audit after insert or update or delete on public.member_groups
  for each row execute function public.audit_member_groups();

revoke execute on function public.audit_member_groups() from public, anon, authenticated;
