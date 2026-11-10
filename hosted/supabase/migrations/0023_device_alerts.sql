-- FrameDecks 26.11.36: new-device alerts (docs/architecture/passwordless.md, "New PCs and devices are announced").
-- Whenever a PC is connected to a workspace (a link code, 0003 / 0018, or a grant from the website, 0021) or a person's
-- device joins its team (scanning a code, being allowed, a recovery code: 0018; Add a device signing a phone in as you:
-- 0021), a row is written to device_alerts. The website shows the last 30 days at the top of Devices for owners and
-- admins (device_alerts_recent), and the Edge Function device-alert (hosted/supabase/functions/device-alert), called
-- by a Database Webhook on INSERT, emails the workspace's owners and admins once (device_alert_take, service key only).
-- The alerts come from AFTER INSERT triggers on the tables every path already writes to (computers, and the security
-- events 0018 and 0021 log), so no earlier function changes.
-- Run once in the Supabase SQL editor, after 0022_room_polls.sql. Undo: supabase/rollback/0023_device_alerts_down.sql.

create table public.device_alerts (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('pc', 'device')),
  device_name text not null check (char_length(device_name) between 1 and 80),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index device_alerts_org_idx on public.device_alerts (organization_id, created_at desc);
alter table public.device_alerts enable row level security;   -- no policies: only the functions below touch it

create or replace function public.device_alert_add(org uuid, what text, device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if org is null or not exists (select 1 from public.organizations where id = org) then
    return;
  end if;
  delete from public.device_alerts where created_at < now() - interval '1 year';
  insert into public.device_alerts (organization_id, kind, device_name)
  values (org, what, left(coalesce(nullif(trim(device), ''), case when what = 'pc' then 'A PC' else 'A device' end), 80));
end;
$$;

-- Every way a PC is connected inserts into computers
create or replace function public.device_alert_on_computer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.device_alert_add(new.organization_id, 'pc', new.name);
  return null;
end;
$$;

-- Every way a person's device joins a team is in their security events with the team: 'joined' (join_team),
-- 'team.recovered' (recover_team) and 'signed-in-by-code' (Add a device, through device-sign-in)
create or replace function public.device_alert_on_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  if new.action not in ('joined', 'team.recovered', 'signed-in-by-code') then
    return null;
  end if;
  begin
    org := (new.detail ->> 'team')::uuid;
  exception when others then
    return null;
  end;
  perform public.device_alert_add(org, 'device',
    coalesce(nullif(trim(new.detail ->> 'name'), ''), (select display_name from public.profiles where user_id = new.user_id)));
  return null;
end;
$$;

drop trigger if exists device_alert_computer on public.computers;
create trigger device_alert_computer after insert on public.computers
  for each row execute function public.device_alert_on_computer();
drop trigger if exists device_alert_event on public.security_events;
create trigger device_alert_event after insert on public.security_events
  for each row execute function public.device_alert_on_event();

-- The website's Devices page (owners and admins): the last 30 days, newest first, at most 20
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

-- The Edge Function device-alert (service key only): takes an alert once (sent_at is set here, so a webhook that
-- fires twice sends once) and says what to email and to whom: the workspace's owners and admins with an email.
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

-- If no email could be sent, the function gives the alert back so a retry can send it
create or replace function public.device_alert_release(alert bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.device_alerts set sent_at = null where id = alert
$$;

-- ---------- grants ----------
revoke execute on function public.device_alert_add(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.device_alert_on_computer() from public, anon, authenticated;
revoke execute on function public.device_alert_on_event() from public, anon, authenticated;
revoke execute on function public.device_alert_take(bigint) from public, anon, authenticated;
revoke execute on function public.device_alert_release(bigint) from public, anon, authenticated;
grant execute on function public.device_alert_take(bigint), public.device_alert_release(bigint) to service_role;
revoke execute on function public.device_alerts_recent(uuid) from public, anon;
grant execute on function public.device_alerts_recent(uuid) to authenticated;
