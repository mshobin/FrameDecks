-- 0027 (26.11.58, release sign-off audit; safe fixes only, no change to what anyone sees or does):
--  * L7: unlinking a PC closes its members' room and prayer wall at once, and removes what they held (screen words,
--    notes, slides, open poll and typed-answer prompt with their answers, prayer requests not yet taken). Before, a
--    revoked PC's room stayed readable until it timed out (up to 12 hours).
--  * L8: every SECURITY DEFINER function in public searches public then pg_temp (pg_temp last), as 0013 and 0017
--    already do, so a temporary object can never stand in for one of ours.
--  * L10: Download my data also lists the person's own Trusted Devices and security events, and deleting an account
--    also removes the link requests made with its address (kept only as a hash).
-- Rollback: supabase/rollback/0027_signoff_safe_down.sql.

-- L7 -------------------------------------------------------------------------------------------------------------
create or replace function public.pc_revoked_close_rooms()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.member_rooms
       set closed_at = coalesce(closed_at, now()), screen = '{}'::jsonb, notes = null, rev = rev + 1
     where computer_id = new.id;
    delete from public.room_slides where computer_id = new.id;
    delete from public.room_responses where computer_id = new.id;          -- its votes go with it
    delete from public.room_answer_prompts where computer_id = new.id;     -- its answers go with it
    update public.prayer_walls set closed_at = coalesce(closed_at, now()) where computer_id = new.id;
    delete from public.prayer_requests where computer_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.pc_revoked_close_rooms() from public, anon, authenticated;

drop trigger if exists rooms_close_on_revoke on public.computers;
create trigger rooms_close_on_revoke after update of revoked_at on public.computers
  for each row execute function public.pc_revoked_close_rooms();

-- L10 ------------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid;
  return jsonb_build_object(
    'exportedAt', now(),
    'account', jsonb_build_object('id', uid, 'email', mail),
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = uid),
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'role', m.role, 'joined', m.created_at,
                                          'createdByYou', o.created_by = uid) order by m.created_at)
      from public.memberships m join public.organizations o on o.id = m.organization_id
      where m.user_id = uid), '[]'::jsonb),
    'invitationsSent', coalesce((
      select jsonb_agg(jsonb_build_object('workspace', i.organization_id, 'email', i.email, 'role', i.role, 'sent', i.created_at))
      from public.invitations i where i.invited_by = uid), '[]'::jsonb),
    'invitationsReceived', coalesce((
      select jsonb_agg(jsonb_build_object('workspace', i.organization_id, 'role', i.role, 'sent', i.created_at))
      from public.invitations i where lower(i.email) = lower(mail)), '[]'::jsonb),
    'computersYouLinked', coalesce((
      select jsonb_agg(jsonb_build_object('workspace', c.organization_id, 'name', c.name, 'linked', c.created_at,
                                          'revoked', c.revoked_at))
      from public.computers c where c.created_by = uid), '[]'::jsonb),
    'changeLog', coalesce((
      select jsonb_agg(jsonb_build_object('workspace', a.organization_id, 'action', a.action, 'at', a.at) order by a.at desc)
      from (select * from public.audit_log where actor = uid order by at desc limit 1000) a), '[]'::jsonb),
    -- 0027 (audit L10): the person's own Trusted Devices and security events are part of their data too
    'trustedDevices', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'trusted', t.trusted_at, 'lastUsed', t.last_seen_at,
                                          'expires', t.expires_at, 'removed', t.revoked_at) order by t.trusted_at)
      from public.trusted_devices t where t.user_id = uid), '[]'::jsonb),
    'securityEvents', coalesce((
      select jsonb_agg(jsonb_build_object('action', e.action, 'at', e.at) order by e.at desc)
      from (select * from public.security_events s
            where s.user_id = uid
               or (mail is not null and s.email_hash = public.sha256_hex('email:' || lower(trim(mail))))
            order by s.at desc limit 1000) e), '[]'::jsonb)
  );
end;
$$;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
  -- 0027 (audit L10): link requests made with this address (kept only as a hash) go with the account
  if mail is not null then
    delete from public.security_events where email_hash = public.sha256_hex('email:' || lower(trim(mail)));
  end if;
  delete from auth.users where id = uid;          -- memberships, profile and sent invitations follow (on delete cascade)

  -- the change log keeps what happened, not who did it
  update public.audit_log set actor = null where actor = uid;
  update public.audit_log set target = 'a deleted account' where target = uid::text or (mail is not null and lower(target) = lower(mail));
  return jsonb_build_object('deleted', true, 'workspacesDeleted', removed);
end;
$$;

-- L8 (last, so the functions above are included) ------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=public%'
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%pg_temp%'
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end;
$$;
