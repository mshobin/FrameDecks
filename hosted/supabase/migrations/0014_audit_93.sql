-- 0014 (FrameDecks 9.3, production audit M6, L11, L13 and the owner hand-over that 0013 needs).
--
-- * Linking a PC (M6): anyone may ask for a link code (the PC has no account yet), and 0003 refused every new code
--   once 1,000 were waiting, so one script could stop all customers linking PCs. Now each network (the caller's
--   address, kept only as a hash) may hold at most 5 waiting codes, and the overall ceiling is 20,000.
-- * The PC's command check (L13): remote_take ran two UPDATEs and a DELETE every 15 seconds per PC even when nothing
--   was waiting. It now writes only when there is a command, and clears week-old commands only then.
-- * Deleting an account (L11): the name on commands sent from the website and the "user:<id>" stamp on synced records
--   and their history are cleared too.
-- * Handing a team to someone else: 0013 stopped role changes to "owner" through the website, and deleting an account
--   asks the sole owner to make someone else owner first. transfer_ownership(team, person) does that, for the owner
--   only, to someone already in the team; the old owner stays as an admin.
-- Undo: supabase/rollback/0014_audit_93_down.sql.

-- ---------- M6: link codes per network ----------
alter table public.computer_links add column if not exists source_hash text;
create index if not exists computer_links_source_idx on public.computer_links (source_hash) where organization_id is null;

create or replace function public.request_source()
returns text
language sql
stable
set search_path = public
as $$
  -- the caller's address as Supabase's gateway passes it (first of x-forwarded-for), hashed; null outside the API
  select case when a is null or a = '' then null else public.sha256_hex('source:' || a) end
  from (select trim(split_part(coalesce(
          nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
          nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)) as a) s
$$;

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
  src text := public.request_source();
begin
  if key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad key' using errcode = '22023';
  end if;
  delete from public.computer_links where expires_at < now() and organization_id is null;
  if src is not null and (select count(*) from public.computer_links
                          where organization_id is null and source_hash = src) >= 5 then
    raise exception 'Too many link codes were asked for from this network; wait 10 minutes and try again'
      using errcode = '53400';
  end if;
  if (select count(*) from public.computer_links where organization_id is null) >= 20000 then
    raise exception 'Too many computers are waiting to be linked; try again shortly' using errcode = '53400';
  end if;
  random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..7 loop
    code := code || substr(alphabet, get_byte(random_bytes, i) % 32 + 1, 1);
  end loop;
  insert into public.computer_links (code_hash, key_hash, name, expires_at, source_hash)
  values (public.sha256_hex(code), key_hash, left(coalesce(nullif(trim(computer_name), ''), 'Computer'), 80),
          now() + interval '10 minutes', src);
  return code;
end;
$$;

-- ---------- L13: no writes when nothing is waiting ----------
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
  if not exists (select 1 from public.remote_commands where computer_id = caller.id and taken_at is null) then
    return '[]'::jsonb;                         -- the usual answer: nothing waiting, nothing written
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

-- ---------- handing a team to someone else ----------
create or replace function public.transfer_ownership(org uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.memberships
                                where organization_id = org and user_id = uid and role = 'owner') then
    raise exception 'Only the team''s owner can hand it to someone else' using errcode = '42501';
  end if;
  if new_owner = uid then
    raise exception 'You are already the owner' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships where organization_id = org and user_id = new_owner) then
    raise exception 'Invite them to the team first' using errcode = '22023';
  end if;
  update public.memberships set role = 'owner' where organization_id = org and user_id = new_owner;
  update public.memberships set role = 'admin' where organization_id = org and user_id = uid;
  update public.organizations set created_by = new_owner where id = org;
end;
$$;

-- ---------- L11: deleting an account leaves no name or id behind ----------
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

  -- 9.3 (L11): the name on commands they sent, and their id on synced records and history
  update public.remote_commands set sent_by_name = 'A deleted account' where sent_by = uid;
  update public.entities set updated_by = 'deleted' where updated_by = 'user:' || uid::text;
  update public.entity_history set updated_by = 'deleted' where updated_by = 'user:' || uid::text;

  delete from public.invitations where lower(email) = lower(mail);
  delete from auth.users where id = uid;          -- memberships, profile and sent invitations follow (on delete cascade)

  -- the change log keeps what happened, not who did it
  update public.audit_log set actor = null where actor = uid;
  update public.audit_log set target = 'a deleted account' where target = uid::text or (mail is not null and lower(target) = lower(mail));
  return jsonb_build_object('deleted', true, 'workspacesDeleted', removed);
end;
$$;

revoke execute on function public.request_source() from public, anon, authenticated;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
