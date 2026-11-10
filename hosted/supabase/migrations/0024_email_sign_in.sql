-- FrameDecks 26.11.38: the email code is the main way in (docs/architecture/passwordless.md, "The email code").
-- After a person opens their workspace with an emailed code on a computer, the website calls email_sign_in: one row in
-- device_alerts (kind 'signin', with the person), which the Edge Function device-alert (called by the same Database
-- Webhook as 0023) emails to that person alone: "BSF Study was opened on Chrome on Windows". Owners' and admins' list of
-- new devices stays about devices (device_alerts_recent leaves sign-ins out). Once per session, at most 10 a day.
-- Run once in the Supabase SQL editor, after 0023_device_alerts.sql. Undo: supabase/rollback/0024_email_sign_in_down.sql.

alter table public.device_alerts drop constraint if exists device_alerts_kind_check;
alter table public.device_alerts add constraint device_alerts_kind_check check (kind in ('pc', 'device', 'signin'));
alter table public.device_alerts add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists device_alerts_user_idx on public.device_alerts (user_id, created_at desc) where user_id is not null;

-- Called by the website right after an email code opened the workspace (anonymous devices have no email: nothing)
create or replace function public.email_sign_in(device_name text, shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.request_session();
  mail text;
  org uuid;
  name text := left(coalesce(nullif(trim(device_name), ''), 'A computer'), 60);
begin
  if uid is null then
    raise exception 'No workspace session' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;
  if nullif(trim(coalesce(mail, '')), '') is null then
    return jsonb_build_object('status', 'no-email');
  end if;
  if sid is not null and exists (select 1 from public.security_events
                                 where user_id = uid and action = 'signed-in-by-email' and detail ->> 'session' = sid::text) then
    return jsonb_build_object('status', 'done');
  end if;
  if (select count(*) from public.device_alerts
      where user_id = uid and kind = 'signin' and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('status', 'enough');
  end if;
  select m.organization_id into org from public.memberships m where m.user_id = uid order by m.created_at desc limit 1;
  if org is null then
    return jsonb_build_object('status', 'no-team');
  end if;
  perform public.security_log(uid, 'signed-in-by-email', null,
    jsonb_build_object('session', coalesce(sid::text, ''), 'name', name, 'shared', coalesce(shared, false)));
  insert into public.device_alerts (organization_id, kind, device_name, user_id)
  values (org, 'signin', left(name || case when shared then ' (someone else''s computer)' else '' end, 80), uid);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- The owners' and admins' list of new devices: devices and PCs only
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
    where a.organization_id = org and a.kind <> 'signin' and a.created_at > now() - interval '30 days'
    order by a.created_at desc, a.id desc
    limit 20;
end;
$$;

-- A sign-in is emailed to the person who signed in; a PC or a device to the owners and admins (as in 0023)
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
    'to', case when a.kind = 'signin'
      then coalesce((select jsonb_agg(u.email) from auth.users u
                     where u.id = a.user_id and nullif(trim(coalesce(u.email, '')), '') is not null), '[]'::jsonb)
      else coalesce((select jsonb_agg(distinct u.email) from public.memberships m join auth.users u on u.id = m.user_id
                     where m.organization_id = a.organization_id and m.role in ('owner', 'admin')
                       and nullif(trim(coalesce(u.email, '')), '') is not null), '[]'::jsonb)
    end);
end;
$$;

revoke execute on function public.email_sign_in(text, boolean) from public, anon;
grant execute on function public.email_sign_in(text, boolean) to authenticated;
revoke execute on function public.device_alert_take(bigint) from public, anon, authenticated;
grant execute on function public.device_alert_take(bigint) to service_role;
revoke execute on function public.device_alerts_recent(uuid) from public, anon;
grant execute on function public.device_alerts_recent(uuid) to authenticated;
