-- FRAMEDECKS Phase 5: controlling a service from the companion (design: docs/architecture/remote-control.md).
-- A person's phone leaves a command for a linked PC; the PC takes its commands with its computer key (as in sync) and
-- publishes a small text status back. The companion never connects to the PC.

-- R3: owners and admins may always run services; a member only when given this permission.
alter table public.memberships add column can_run_services boolean not null default false;

create or replace function public.can_run_services(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid()
      and (role in ('owner', 'admin') or can_run_services)
  );
$$;

create table public.remote_commands (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  computer_id uuid not null references public.computers (id) on delete cascade,
  op text not null check (op in ('next', 'previous', 'go_live', 'hide_all', 'blackout', 'question', 'scripture')),
  args jsonb not null default '{}'::jsonb check (octet_length(args::text) <= 1024),
  sent_by uuid references auth.users (id) on delete set null,
  sent_by_name text not null,
  created_at timestamptz not null default now(),
  taken_at timestamptz,
  result text check (result is null or char_length(result) <= 200)
);

create index remote_commands_waiting_idx on public.remote_commands (computer_id, id) where taken_at is null;

create table public.remote_status (
  computer_id uuid primary key references public.computers (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status jsonb not null check (octet_length(status::text) <= 65536),
  updated_at timestamptz not null default now()
);

alter table public.remote_commands enable row level security;
alter table public.remote_status enable row level security;

-- People who may run services see the commands and the status of their workspace's PCs ("who did what").
create policy remote_commands_select on public.remote_commands
  for select to authenticated using (public.can_run_services(organization_id));
create policy remote_status_select on public.remote_status
  for select to authenticated using (public.can_run_services(organization_id));
-- No insert/update policies: commands are sent with remote_send, taken and answered by the PC's functions.

-- The phone: leave a command for a PC. Checks the person, the PC, the action and a rate limit.
create or replace function public.remote_send(computer uuid, op text, args jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.computers;
  sender text;
  new_id bigint;
begin
  select * into target from public.computers where id = computer and revoked_at is null;
  if not found or auth.uid() is null or not public.can_run_services(target.organization_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.remote_commands
      where sent_by = auth.uid() and created_at > now() - interval '10 seconds') >= 30 then
    raise exception 'Too many commands; slow down' using errcode = '53400';
  end if;
  select coalesce(nullif(trim(p.display_name), ''), public.current_user_email(), 'Someone') into sender
  from (select 1) one left join public.profiles p on p.user_id = auth.uid();
  insert into public.remote_commands (organization_id, computer_id, op, args, sent_by, sent_by_name)
  values (target.organization_id, target.id, op, coalesce(args, '{}'::jsonb), auth.uid(), left(sender, 120))
  returning id into new_id;
  return new_id;
end;
$$;

-- The PC (its key header): take its waiting commands, oldest first, each once. Commands older than 10 seconds are
-- answered "expired" instead of being run late; commands whose sender lost the permission are answered "refused".
create or replace function public.remote_take()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  taken jsonb;
begin
  if caller.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.remote_commands set taken_at = now(), result = 'expired'
  where computer_id = caller.id and taken_at is null and created_at < now() - interval '10 seconds';
  update public.remote_commands c set taken_at = now(), result = 'refused'
  where c.computer_id = caller.id and c.taken_at is null
    and not exists (
      select 1 from public.memberships m
      where m.organization_id = c.organization_id and m.user_id = c.sent_by
        and (m.role in ('owner', 'admin') or m.can_run_services)
    );
  with picked as (
    update public.remote_commands set taken_at = now()
    where computer_id = caller.id and taken_at is null
    returning id, op, args, sent_by_name, created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'op', op, 'args', args, 'by', sent_by_name,
                                               'at', created_at) order by id), '[]'::jsonb)
  into taken from picked;
  delete from public.remote_commands
  where organization_id = caller.organization_id and created_at < now() - interval '7 days';
  return taken;
end;
$$;

-- The PC: record what happened to commands it took ("done", or why not).
create or replace function public.remote_report(results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  item jsonb;
begin
  if caller.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(results) <> 'array' or jsonb_array_length(results) > 100 then
    raise exception 'Send up to 100 results' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(results) loop
    update public.remote_commands set result = left(coalesce(item ->> 'result', ''), 200)
    where id = (item ->> 'id')::bigint and computer_id = caller.id and taken_at is not null;
  end loop;
end;
$$;

-- The PC: publish what is on screen now (text only: the live Frame, what is visible, its script).
create or replace function public.remote_publish(status jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
begin
  if caller.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.remote_status (computer_id, organization_id, status, updated_at)
  values (caller.id, caller.organization_id, status, now())
  on conflict (computer_id) do update set status = excluded.status, updated_at = excluded.updated_at;
end;
$$;

revoke execute on function public.can_run_services(uuid) from public, anon;
revoke execute on function public.remote_send(uuid, text, jsonb) from public, anon;
revoke execute on function public.remote_take() from public;
revoke execute on function public.remote_report(jsonb) from public;
revoke execute on function public.remote_publish(jsonb) from public;
grant execute on function public.can_run_services(uuid) to authenticated;
grant execute on function public.remote_send(uuid, text, jsonb) to authenticated;
grant execute on function public.remote_take() to anon, authenticated;
grant execute on function public.remote_report(jsonb) to anon, authenticated;
grant execute on function public.remote_publish(jsonb) to anon, authenticated;
