-- Undo 0014: link codes, the PC's command check and account deletion go back to 0003 / 0004 / 0011, and
-- transfer_ownership is removed. Only run this to roll back a problem with 0014; it brings back the holes 0014 closed
-- (one network can block PC linking for everyone; idle PCs write every 15 seconds; a deleted account's name stays on
-- its commands; a sole owner has no way to hand a team on before deleting their account).
drop function if exists public.transfer_ownership(uuid, uuid);

create or replace function public.computer_link_start(computer_name text, key_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  code text := '';
  i integer;
begin
  if key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad key' using errcode = '22023';
  end if;
  delete from public.computer_links where expires_at < now() and organization_id is null;
  if (select count(*) from public.computer_links where organization_id is null) >= 1000 then
    raise exception 'Too many computers are waiting to be linked; try again shortly' using errcode = '53400';
  end if;
  random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..7 loop
    code := code || substr(alphabet, get_byte(random_bytes, i) % 32 + 1, 1);
  end loop;
  insert into public.computer_links (code_hash, key_hash, name, expires_at)
  values (public.sha256_hex(code), key_hash, left(coalesce(nullif(trim(computer_name), ''), 'Computer'), 80),
          now() + interval '10 minutes');
  return code;
end;
$$;

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

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text;
  blockers text[];
  removed int := 0;
  w record;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;

  select array_agg(o.name order by o.name) into blockers
  from public.memberships m join public.organizations o on o.id = m.organization_id
  where m.user_id = uid and m.role = 'owner'
    and exists (select 1 from public.memberships x where x.organization_id = o.id and x.user_id <> uid)
    and not exists (select 1 from public.memberships x where x.organization_id = o.id and x.user_id <> uid and x.role = 'owner');
  if blockers is not null then
    raise exception 'Make someone else an owner of % first', array_to_string(blockers, ', ')
      using errcode = 'P0001', hint = 'sole-owner';
  end if;

  -- workspaces with nobody else in them go with the account
  for w in
    select o.id from public.organizations o
    where exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id = uid)
      and not exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id <> uid)
  loop
    delete from public.organizations where id = w.id;
    removed := removed + 1;
  end loop;
  -- an empty workspace this person created (no members left) goes too
  delete from public.organizations o
  where o.created_by = uid and not exists (select 1 from public.memberships m where m.organization_id = o.id);

  -- the workspaces they created and still share pass to another owner (or, failing that, an admin, then a member)
  update public.organizations o set created_by = (
    select m.user_id from public.memberships m
    where m.organization_id = o.id and m.user_id <> uid
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
    limit 1)
  where o.created_by = uid;

  delete from public.invitations where lower(email) = lower(mail);
  delete from auth.users where id = uid;          -- memberships, profile and sent invitations follow (on delete cascade)

  -- the change log keeps what happened, not who did it
  update public.audit_log set actor = null where actor = uid;
  update public.audit_log set target = 'a deleted account' where target = uid::text or (mail is not null and lower(target) = lower(mail));
  return jsonb_build_object('deleted', true, 'workspacesDeleted', removed);
end;
$$;

drop function if exists public.request_source();
drop index if exists public.computer_links_source_idx;
alter table public.computer_links drop column if exists source_hash;
