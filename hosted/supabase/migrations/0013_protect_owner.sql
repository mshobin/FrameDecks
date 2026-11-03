-- 0013 (FrameDecks 9.1.2 audit, H5): a team's owner can no longer be demoted or removed by an admin.
--
-- 0001 let anyone who is an admin update any membership row, checking only that the new row is not an owner. An admin
-- could therefore turn the owner into a member and then remove them (0002 only stops removing an owner), leaving a
-- team with no owner that nobody can delete. The same rule let an admin move a membership to another person or team,
-- and add anyone at all directly (skipping the invitation the person accepts).
--
-- From now on:
--   * nobody changes an owner's membership through the website (owner rows are left out of the update rule);
--   * a membership always stays with its person and its team (user_id and organization_id cannot change);
--   * only the owner changes roles (admins still turn "Can run services" on and off and remove non-owners);
--   * only the owner adds someone directly; everyone else joins through an invitation (accept_invitation).
-- The website already works this way: it only updates can_run_services and deletes rows, and never inserts. The
-- database's own functions (creating a team, accepting an invitation, deleting an account) run as the database owner
-- and are not affected. Undo: supabase/rollback/0013_protect_owner_down.sql.

create or replace function public.is_org_owner(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid() and role = 'owner'
  );
$$;
revoke execute on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_owner(uuid) to authenticated;

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_org_admin(organization_id) and role <> 'owner')
  with check (public.is_org_admin(organization_id) and role <> 'owner');

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.is_org_owner(organization_id) and role <> 'owner');

-- What the update rule cannot say (it sees only the new row): which columns changed.
create or replace function public.guard_membership_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then          -- the website's requests; the database's own work is trusted
    if new.user_id is distinct from old.user_id or new.organization_id is distinct from old.organization_id then
      raise exception 'A membership cannot be moved to another person or team' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and not public.is_org_owner(old.organization_id) then
      raise exception 'Only the team owner can change roles' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_membership_update() from public, anon, authenticated;

drop trigger if exists memberships_guard on public.memberships;
create trigger memberships_guard before update on public.memberships
  for each row execute function public.guard_membership_update();
