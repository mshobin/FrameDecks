-- Undo 0015: Trusted Devices and security events are removed, and the Data API stops checking devices before each
-- request. Workspaces, memberships, synced records and linked PCs are untouched. Browsers that trusted themselves
-- stay connected until their session ends; nobody can remove a device any more, so only run this to roll back a
-- problem with 0015.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator reset pgrst.db_pre_request';
    perform pg_notify('pgrst', 'reload config');
  end if;
end;
$$;

drop trigger if exists workspace_sync_audit on public.workspace_sync;
drop function if exists public.audit_workspace_sync();
drop function if exists public.check_trusted_session();
drop function if exists public.security_event_list(integer);
drop function if exists public.device_revoke(uuid);
drop function if exists public.device_list();
drop function if exists public.device_check(text);
drop function if exists public.trust_device(text);
drop function if exists public.magic_link_used();
drop function if exists public.magic_link_requested(text);
drop function if exists public.security_log(uuid, text, uuid, jsonb);
drop function if exists public.request_session();
drop table if exists public.security_events;
drop table if exists public.trusted_devices;
