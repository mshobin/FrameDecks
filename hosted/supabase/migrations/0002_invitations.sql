-- FRAMEDECKS: workspace invitations and member list.
-- An invitation always waits until the invitee signs in and accepts it, so an admin never learns whether an
-- email address already has an account.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) <= 320
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index invitations_email_idx on public.invitations (email);

-- The signed-in person's email, read from auth.users (which the API roles cannot read directly).
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

alter table public.invitations enable row level security;

create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_org_admin(organization_id) or email = public.current_user_email());
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_org_admin(organization_id) and invited_by = auth.uid());
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.is_org_admin(organization_id) or email = public.current_user_email());

-- Invitations addressed to the signed-in person, with the workspace name they cannot otherwise read yet.
create or replace function public.my_invitations()
returns table (id uuid, organization_id uuid, organization_name text, role text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.organization_id, o.name, i.role, i.created_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.email = public.current_user_email()
  order by i.created_at;
$$;

create or replace function public.accept_invitation(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_invitation public.invitations;
begin
  select * into found_invitation from public.invitations
  where id = invitation and email = public.current_user_email();
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  insert into public.memberships (organization_id, user_id, role)
  values (found_invitation.organization_id, auth.uid(), found_invitation.role)
  on conflict (organization_id, user_id) do nothing;
  delete from public.invitations where id = found_invitation.id;
  return found_invitation.organization_id;
end;
$$;

-- Members of a workspace with their display name and email, for its members only.
create or replace function public.workspace_members(org uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role, p.display_name, u.email::text, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = org and public.is_org_member(org)
  order by m.created_at;
$$;

revoke execute on function public.current_user_email() from public, anon;
revoke execute on function public.my_invitations() from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.workspace_members(uuid) from public, anon;
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.my_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.workspace_members(uuid) to authenticated;

-- 0001 let an admin remove the owner; now admins remove only non-owners, and anyone may still leave.
drop policy memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (user_id = auth.uid() or (public.is_org_admin(organization_id) and role <> 'owner'));
