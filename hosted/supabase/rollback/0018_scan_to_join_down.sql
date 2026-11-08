-- Undo 0018: scanning to join, join requests, the team Devices list and recovery codes are removed, and anonymous
-- (device-only) people may again insert a team themselves (the 0001 policy). Teams, memberships, linked PCs and
-- synced records are untouched: devices that already joined keep their membership until it is removed. Only run this
-- to roll back a problem with 0018.
drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated with check (created_by = auth.uid());

drop function if exists public.recover_team(text, text);
drop function if exists public.recovery_status(uuid);
drop function if exists public.recovery_code_create(uuid);
drop function if exists public.pc_device_remove(uuid);
drop function if exists public.device_remove(uuid, uuid);
drop function if exists public.leave_team(uuid, uuid, uuid);
drop function if exists public.pc_devices();
drop function if exists public.workspace_devices(uuid);
drop function if exists public.devices_of(uuid);
drop function if exists public.pc_join_request_allow(text, text);
drop function if exists public.join_request_allow(text, uuid, text);
drop function if exists public.join_request_peek(text);
drop function if exists public.join_request_status(text);
drop function if exists public.join_request_create(text);
drop function if exists public.join_with_code(text, text, uuid);
drop function if exists public.join_code_peek(text);
drop function if exists public.pc_invite_create(text);
drop function if exists public.invite_create(uuid, text);
drop function if exists public.join_team(uuid, uuid, text, text, text);
drop function if exists public.join_role_allowed(uuid, text, boolean);
drop function if exists public.join_failed();
drop function if exists public.join_blocked(integer);
drop table if exists public.recovery_codes;
drop table if exists public.join_failures;
drop table if exists public.join_codes;
drop function if exists public.code_hash(text);
drop function if exists public.random_code(integer);
drop function if exists public.request_is_anonymous();
