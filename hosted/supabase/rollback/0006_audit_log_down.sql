-- Undoes 0006_audit_log.sql: removes the audit log and its triggers. Nothing else changes; the log's rows are lost.
drop trigger if exists memberships_audit on public.memberships;
drop trigger if exists invitations_audit on public.invitations;
drop trigger if exists computers_audit on public.computers;
drop function if exists public.audit_memberships();
drop function if exists public.audit_invitations();
drop function if exists public.audit_computers();
drop function if exists public.audit_write(uuid, text, text, jsonb);
drop table if exists public.audit_log;
