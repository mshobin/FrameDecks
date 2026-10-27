-- FrameDecks Phase 3: tenant foundation. Every table is tenant-scoped and protected by RLS.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- The creator becomes the owner automatically, so clients never choose their own role.
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger organizations_add_owner
after insert on public.organizations
for each row execute function public.add_creator_as_owner();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated using (created_by = auth.uid() or public.is_org_member(id));
create policy organizations_insert on public.organizations
  for insert to authenticated with check (created_by = auth.uid());
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy organizations_delete on public.organizations
  for delete to authenticated using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

create policy memberships_select on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy memberships_delete on public.memberships
  for delete to authenticated using (user_id = auth.uid() or public.is_org_admin(organization_id));

create policy profiles_select on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
