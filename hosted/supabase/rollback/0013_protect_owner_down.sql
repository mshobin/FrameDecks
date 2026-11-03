-- Undo 0013: the membership rules go back to 0001's (admins may update any membership row and add people directly).
-- Only run this to roll back a problem with 0013; it brings back the hole 0013 closed (an admin can demote and then
-- remove the owner).
drop trigger if exists memberships_guard on public.memberships;
drop function if exists public.guard_membership_update();

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id) and role <> 'owner');

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.is_org_admin(organization_id) and role <> 'owner');

drop function if exists public.is_org_owner(uuid);
