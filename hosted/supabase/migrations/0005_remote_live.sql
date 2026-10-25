-- FRAMEDECKS Phase 5 step 3: what the companion's Live page reads (design: docs/architecture/remote-control.md).
-- The computers table is visible to owners and admins only; people given "Can run services" also need the PCs they
-- may control, with each PC's latest status. Run once in the Supabase SQL editor, after 0004_remote.sql.

create or replace function public.remote_computers(org uuid)
returns table (id uuid, name text, status jsonb, updated_at timestamptz, server_now timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, s.status, s.updated_at, now()
  from public.computers c
  left join public.remote_status s on s.computer_id = c.id
  where c.organization_id = org and c.revoked_at is null and public.can_run_services(org)
  order by c.created_at;
$$;

revoke execute on function public.remote_computers(uuid) from public, anon;
grant execute on function public.remote_computers(uuid) to authenticated;
