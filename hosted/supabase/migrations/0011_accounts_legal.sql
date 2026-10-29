-- FrameDecks 7.0: accepting the Terms and Privacy Policy, exporting your data, and deleting your account
-- (docs/project/2026-10-29-commercial-model-plan.md; docs/legal/privacy.md "Your rights").
-- Run once in the Supabase SQL editor, after 0010_link_by_url.sql. Undo: supabase/rollback/0011_accounts_legal_down.sql.

-- Which version of the Terms and Privacy Policy each person accepted, and when (set only through accept_terms)
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms(version text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  at timestamptz := now();
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if version is null or version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Unknown terms version' using errcode = '22023';
  end if;
  insert into public.profiles (user_id, terms_version, terms_accepted_at)
  values (uid, version, at)
  on conflict (user_id) do update set terms_version = excluded.terms_version, terms_accepted_at = excluded.terms_accepted_at;
  return at;
end;
$$;

-- Everything FrameDecks keeps about the person asking, as one JSON document (Your account → Download my data). The
-- website adds the workspace records the person can see, through sync_pull, to the same file.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
      from (select * from public.audit_log where actor = uid order by at desc limit 1000) a), '[]'::jsonb)
  );
end;
$$;

-- Delete the account of the person asking (Your account → Delete my account). A workspace they are the only person
-- in goes with it. A workspace where they are the only owner but not the only person is never left without an
-- owner: the call is refused, naming those workspaces, until someone else is made an owner. Workspaces they
-- created but share with other owners pass to another owner. Their name leaves the change log.
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

revoke execute on function public.accept_terms(text) from public, anon;
revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
