-- Undo 0024: sign-in alerts are removed and the alert functions are as 0023 left them. Devices, PCs, teams and
-- the new-device alerts are untouched; opening the workspace with an email code simply stops sending an email.
delete from public.device_alerts where kind = 'signin';
drop function if exists public.email_sign_in(text, boolean);
drop index if exists public.device_alerts_user_idx;
alter table public.device_alerts drop column if exists user_id;
alter table public.device_alerts drop constraint if exists device_alerts_kind_check;
alter table public.device_alerts add constraint device_alerts_kind_check check (kind in ('pc', 'device'));

create or replace function public.device_alerts_recent(org uuid)
returns table (id bigint, kind text, device_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_org_admin(org) then
    raise exception 'Only owners and admins see new devices' using errcode = '42501';
  end if;
  return query
    select a.id, a.kind, a.device_name, a.created_at from public.device_alerts a
    where a.organization_id = org and a.created_at > now() - interval '30 days'
    order by a.created_at desc, a.id desc
    limit 20;
end;
$$;

create or replace function public.device_alert_take(alert bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.device_alerts;
begin
  update public.device_alerts set sent_at = now() where id = alert and sent_at is null returning * into a;
  if not found then
    return jsonb_build_object('status', 'done');
  end if;
  return jsonb_build_object(
    'status', 'ok', 'kind', a.kind, 'deviceName', a.device_name, 'createdAt', a.created_at,
    'workspace', (select name from public.organizations where id = a.organization_id),
    'to', coalesce((select jsonb_agg(distinct u.email) from public.memberships m join auth.users u on u.id = m.user_id
                    where m.organization_id = a.organization_id and m.role in ('owner', 'admin')
                      and nullif(trim(coalesce(u.email, '')), '') is not null), '[]'::jsonb));
end;
$$;

revoke execute on function public.device_alert_take(bigint) from public, anon, authenticated;
grant execute on function public.device_alert_take(bigint) to service_role;
revoke execute on function public.device_alerts_recent(uuid) from public, anon;
grant execute on function public.device_alerts_recent(uuid) to authenticated;
