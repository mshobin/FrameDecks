-- Undo 0016: live push is removed. PCs and the website go back to asking every few seconds, as before 0016 (a PC that
-- knows about live push sees computer_hello missing and polls; the Live page sees live_computers missing and polls).
-- Commands, statuses, synced records and linked PCs are untouched.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists framedecks_live_read on realtime.messages';
  end if;
end;
$$;

drop trigger if exists live_command on public.remote_commands;
drop trigger if exists live_status on public.remote_status;
drop trigger if exists live_entity on public.entities;
drop trigger if exists live_revoke on public.computers;

drop function if exists public.live_on_command();
drop function if exists public.live_on_status();
drop function if exists public.live_on_entity();
drop function if exists public.live_on_revoke();
drop function if exists public.live_topic_allowed(text);
drop function if exists public.live_computers(uuid);
drop function if exists public.remote_watch(uuid);
drop function if exists public.computer_hello(boolean);
drop function if exists public.ring(uuid, text, jsonb);
drop function if exists public.live_send(text, text, jsonb, boolean);
drop function if exists public.workspace_bell(uuid);
drop function if exists public.push_on();

alter table public.computers drop column if exists watched_until;
alter table public.computers drop column if exists control_seen_at;
drop table if exists public.workspace_bells;
drop table if exists public.live_push;
