-- FrameDecks Phase 4: syncing service plans (design: docs/architecture/metadata-sync.md).
-- Records ("entities") are text only; media never reaches the cloud. Writes go through sync_push only.
-- Linked PCs ("computers") authenticate with their own key in the x-framedecks-computer header; the cloud keeps
-- only its SHA-256 hash.

create table public.entities (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in (
    'frame', 'template', 'order', 'library_question', 'library_verse', 'theme', 'brand', 'layout', 'meeting', 'member'
  )),
  id text not null check (char_length(id) between 1 and 80),
  rev integer not null check (rev >= 1),
  seq bigint not null,
  deleted boolean not null default false,
  body jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind, id),
  check ((deleted and body is null) or (not deleted and body is not null))
);

create index entities_seq_idx on public.entities (organization_id, seq);

-- Every overwritten or deleted version, kept 30 days (sync_push purges older rows).
create table public.entity_history (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  id text not null,
  rev integer not null,
  deleted boolean not null,
  body jsonb,
  updated_by text not null,
  replaced_at timestamptz not null default now(),
  primary key (organization_id, kind, id, rev)
);

-- One change counter per workspace. sync_push locks this row first, so pushes to one workspace commit in seq order
-- and a reader can never skip a record. It also holds a one-minute write window for the rate limit.
create table public.workspace_sync (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  seq bigint not null default 0,
  window_start timestamptz not null default now(),
  window_writes integer not null default 0
);

create table public.computers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create table public.computer_links (
  code_hash text primary key,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 80),
  expires_at timestamptz not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  computer_id uuid references public.computers (id) on delete cascade
);

create table public.computer_link_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);

create index computer_link_failures_user_idx on public.computer_link_failures (user_id, at);

alter table public.entities enable row level security;
alter table public.entity_history enable row level security;
alter table public.workspace_sync enable row level security;
alter table public.computers enable row level security;
alter table public.computer_links enable row level security;
alter table public.computer_link_failures enable row level security;

-- Member records (phones, emails, birthdays) are for owners and admins only; everything else for every member.
create policy entities_select on public.entities
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (kind <> 'member' or public.is_org_admin(organization_id))
  );
create policy entity_history_select on public.entity_history
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (kind <> 'member' or public.is_org_admin(organization_id))
  );
create policy computers_select on public.computers
  for select to authenticated
  using (public.is_org_admin(organization_id));
-- workspace_sync, computer_links and computer_link_failures: no client policies (functions only).

create or replace function public.sha256_hex(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(value, 'UTF8')), 'hex');
$$;

-- The linked PC making this request, from its key header; null for anyone else. Revoked keys never match.
create or replace function public.request_computer()
returns public.computers
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := nullif(current_setting('request.headers', true), '')::json ->> 'x-framedecks-computer';
  found_computer public.computers;
begin
  if key is null or char_length(key) < 32 then
    return null;
  end if;
  update public.computers set last_seen_at = now()
  where key_hash = public.sha256_hex(key) and revoked_at is null
  returning * into found_computer;
  return found_computer;
end;
$$;

create or replace function public.sync_pull(org uuid, since bigint default 0, max_rows integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  sees_members boolean;
  page jsonb;
  last_seq bigint;
  more boolean;
begin
  if caller.id is not null and caller.organization_id = org then
    sees_members := true;
  elsif auth.uid() is not null and public.is_org_member(org) then
    sees_members := public.is_org_admin(org);
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  max_rows := least(greatest(coalesce(max_rows, 500), 1), 500);

  with batch as (
    select * from public.entities
    where organization_id = org and seq > coalesce(since, 0)
    order by seq
    limit max_rows + 1
  ), numbered as (
    select *, row_number() over (order by seq) as n from batch
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object('kind', kind, 'id', id, 'rev', rev, 'seq', seq, 'deleted', deleted, 'body', body,
                         'updatedBy', updated_by, 'updatedAt', updated_at)
      order by seq
    ) filter (where n <= max_rows and (kind <> 'member' or sees_members)), '[]'::jsonb),
    max(seq) filter (where n <= max_rows),
    count(*) > max_rows
  into page, last_seq, more
  from numbered;

  return jsonb_build_object('entities', page, 'seq', coalesce(last_seq, coalesce(since, 0)), 'more', more);
end;
$$;

create or replace function public.sync_push(org uuid, changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  author text;
  counter public.workspace_sync;
  change jsonb;
  current_row public.entities;
  base_rev integer;
  is_delete boolean;
  new_body jsonb;
  next_seq bigint;
  results jsonb := '[]'::jsonb;
begin
  if caller.id is not null and caller.organization_id = org then
    author := 'computer:' || caller.id;
  elsif auth.uid() is not null and public.is_org_admin(org) then
    author := 'user:' || auth.uid();
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) = 0 or jsonb_array_length(changes) > 200 then
    raise exception 'Send between 1 and 200 changes' using errcode = '22023';
  end if;
  if octet_length(changes::text) > 2 * 1024 * 1024 then
    raise exception 'Changes are larger than 2 MB' using errcode = '54000';
  end if;

  -- Lock the workspace counter first: pushes to one workspace run one at a time and commit in seq order.
  insert into public.workspace_sync (organization_id) values (org) on conflict (organization_id) do nothing;
  select * into counter from public.workspace_sync where organization_id = org for update;
  if counter.window_start < now() - interval '1 minute' then
    counter.window_start := now();
    counter.window_writes := 0;
  end if;
  if counter.window_writes + jsonb_array_length(changes) > 600 then
    raise exception 'Too many changes this minute; try again shortly' using errcode = '53400';
  end if;

  for change in select value from jsonb_array_elements(changes) loop
    is_delete := coalesce((change ->> 'deleted')::boolean, false);
    new_body := case when is_delete then null else change -> 'body' end;
    base_rev := coalesce((change ->> 'baseRev')::integer, 0);
    if (change ->> 'kind') is null or (change ->> 'id') is null or (not is_delete and new_body is null) then
      raise exception 'Each change needs kind, id and a body (or deleted: true)' using errcode = '22023';
    end if;
    if new_body is not null and octet_length(new_body::text) > 256 * 1024 then
      raise exception 'Record %/% is larger than 256 KB', change ->> 'kind', change ->> 'id' using errcode = '54000';
    end if;

    select * into current_row from public.entities
    where organization_id = org and kind = change ->> 'kind' and id = change ->> 'id'
    for update;

    if coalesce(current_row.rev, 0) <> base_rev then
      results := results || jsonb_build_object(
        'kind', change ->> 'kind', 'id', change ->> 'id', 'status', 'conflict',
        'current', jsonb_build_object('rev', coalesce(current_row.rev, 0), 'deleted', coalesce(current_row.deleted, true),
                                      'body', current_row.body, 'updatedBy', current_row.updated_by));
      continue;
    end if;

    update public.workspace_sync set seq = seq + 1 where organization_id = org returning seq into next_seq;
    if current_row.rev is not null then
      insert into public.entity_history (organization_id, kind, id, rev, deleted, body, updated_by)
      values (org, current_row.kind, current_row.id, current_row.rev, current_row.deleted, current_row.body,
              current_row.updated_by);
    end if;
    insert into public.entities (organization_id, kind, id, rev, seq, deleted, body, updated_by, updated_at)
    values (org, change ->> 'kind', change ->> 'id', base_rev + 1, next_seq, is_delete, new_body, author, now())
    on conflict (organization_id, kind, id) do update
      set rev = excluded.rev, seq = excluded.seq, deleted = excluded.deleted, body = excluded.body,
          updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    results := results || jsonb_build_object('kind', change ->> 'kind', 'id', change ->> 'id', 'status', 'ok',
                                             'rev', base_rev + 1, 'seq', next_seq);
  end loop;

  update public.workspace_sync
  set window_start = counter.window_start, window_writes = counter.window_writes + jsonb_array_length(changes)
  where organization_id = org
  returning seq into next_seq;
  delete from public.entity_history where organization_id = org and replaced_at < now() - interval '30 days';

  return jsonb_build_object('results', results, 'seq', next_seq);
end;
$$;

-- Step 1 of linking, on the PC (no account yet): it made a key, keeps it, and sends only the key's hash.
-- Answers an 8-character code to type into the companion. Codes work for 10 minutes.
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

-- Step 2, in the companion: an owner or admin types the code and picks the workspace.
create or replace function public.computer_link_approve(code text, org uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.computer_links;
  new_id uuid;
begin
  if auth.uid() is null or not public.is_org_admin(org) then
    raise exception 'Only owners and admins can link a computer' using errcode = '42501';
  end if;
  if (select count(*) from public.computer_link_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many wrong codes; try again in an hour' using errcode = '53400';
  end if;
  select * into link from public.computer_links
  where code_hash = public.sha256_hex(upper(replace(trim(code), ' ', '')))
    and organization_id is null and expires_at > now()
  for update;
  if not found then
    insert into public.computer_link_failures (user_id) values (auth.uid());
    raise exception 'That code is wrong or has expired' using errcode = 'P0002';
  end if;
  insert into public.computers (organization_id, name, key_hash, created_by)
  values (org, link.name, link.key_hash, auth.uid())
  returning id into new_id;
  update public.computer_links set organization_id = org, computer_id = new_id where code_hash = link.code_hash;
  return new_id;
end;
$$;

-- Step 3, on the PC: asks with its key whether the code was approved. Once approved it gets its workspace and the
-- link row is removed; from then on the key in the header is all it needs.
create or replace function public.computer_link_poll(key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.computer_links;
  workspace_name text;
begin
  select * into link from public.computer_links where key_hash = public.sha256_hex(key);
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;
  if link.computer_id is null then
    return jsonb_build_object('status', case when link.expires_at < now() then 'expired' else 'pending' end);
  end if;
  select name into workspace_name from public.organizations where id = link.organization_id;
  delete from public.computer_links where code_hash = link.code_hash;
  return jsonb_build_object('status', 'approved', 'computerId', link.computer_id,
                            'organizationId', link.organization_id, 'organizationName', workspace_name);
end;
$$;

-- Unlink: an owner or admin of its workspace, or the computer itself (its key header). It keeps working offline.
create or replace function public.computer_revoke(computer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.computers := public.request_computer();
  target public.computers;
begin
  select * into target from public.computers where id = computer;
  -- coalesce: with no key, caller.id is null and the comparison would be null, which an IF treats as "allowed".
  if not found or not (
    coalesce(caller.id = target.id, false)
    or (auth.uid() is not null and public.is_org_admin(target.organization_id))
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.computers set revoked_at = coalesce(revoked_at, now()) where id = computer;
end;
$$;

-- Called with the anon key: by a PC (authorised by its key header inside) or before it has a key (linking).
revoke execute on function public.request_computer() from public, anon, authenticated;
revoke execute on function public.sync_pull(uuid, bigint, integer) from public;
revoke execute on function public.sync_push(uuid, jsonb) from public;
revoke execute on function public.computer_link_start(text, text) from public;
revoke execute on function public.computer_link_poll(text) from public;
revoke execute on function public.computer_revoke(uuid) from public;
grant execute on function public.sync_pull(uuid, bigint, integer) to anon, authenticated;
grant execute on function public.sync_push(uuid, jsonb) to anon, authenticated;
grant execute on function public.computer_link_start(text, text) to anon;
grant execute on function public.computer_link_poll(text) to anon;
grant execute on function public.computer_revoke(uuid) to anon, authenticated;
revoke execute on function public.computer_link_approve(text, uuid) from public, anon;
grant execute on function public.computer_link_approve(text, uuid) to authenticated;
