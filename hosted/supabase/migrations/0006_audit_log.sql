-- FrameDecks migration step 1: one audit log of who changed a workspace's people and computers
-- (docs/migration-plan.md §7). Written only by triggers; owners and admins can read their workspace's log; kept one
-- year. Nothing in the companion or on the PC reads it yet, so nothing visible changes.
-- Run once in the Supabase SQL editor, after 0005_remote_live.sql. Undo: supabase/rollback/0006_audit_log_down.sql.

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor uuid,                     -- the signed-in person; null for a PC (its key) or the system
  action text not null,           -- member.joined, member.role_changed, member.can_run_services, member.removed,
                                  -- invitation.sent, invitation.removed, computer.linked, computer.revoked
  target text,                    -- the person's id, the invited email, or the computer's id
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index audit_log_org_at_idx on public.audit_log (organization_id, at desc);

alter table public.audit_log enable row level security;

-- Read-only for owners and admins; no policy lets anyone write, change or delete a row.
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_org_admin(organization_id));

create or replace function public.audit_write(org uuid, what text, about text, extra jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A workspace being deleted takes its log with it; rows removed along with it are not logged.
  if not exists (select 1 from public.organizations where id = org) then
    return;
  end if;
  delete from public.audit_log where organization_id = org and at < now() - interval '1 year';
  insert into public.audit_log (organization_id, actor, action, target, detail)
  values (org, auth.uid(), what, about, coalesce(extra, '{}'::jsonb));
end;
$$;

create or replace function public.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.organization_id, 'member.joined', new.user_id::text,
                               jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform public.audit_write(old.organization_id, 'member.removed', old.user_id::text,
                               jsonb_build_object('role', old.role));
  else
    if new.role is distinct from old.role then
      perform public.audit_write(new.organization_id, 'member.role_changed', new.user_id::text,
                                 jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    if new.can_run_services is distinct from old.can_run_services then
      perform public.audit_write(new.organization_id, 'member.can_run_services', new.user_id::text,
                                 jsonb_build_object('to', new.can_run_services));
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.audit_invitations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.organization_id, 'invitation.sent', new.email, jsonb_build_object('role', new.role));
  else
    perform public.audit_write(old.organization_id, 'invitation.removed', old.email, '{}'::jsonb);
  end if;
  return null;
end;
$$;

create or replace function public.audit_computers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.organization_id, 'computer.linked', new.id::text, jsonb_build_object('name', new.name));
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform public.audit_write(new.organization_id, 'computer.revoked', new.id::text, jsonb_build_object('name', new.name));
  end if;
  return null;
end;
$$;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_memberships();
create trigger invitations_audit after insert or delete on public.invitations
  for each row execute function public.audit_invitations();
create trigger computers_audit after insert or update on public.computers
  for each row execute function public.audit_computers();

revoke execute on function public.audit_write(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_memberships() from public, anon, authenticated;
revoke execute on function public.audit_invitations() from public, anon, authenticated;
revoke execute on function public.audit_computers() from public, anon, authenticated;
