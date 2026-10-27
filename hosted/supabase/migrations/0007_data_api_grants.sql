-- FrameDecks: explicit Data API grants (Supabase change of 30 October 2026).
-- From that date Supabase no longer lets the API roles reach a new table in `public` by default: each table needs an
-- explicit GRANT, or the companion gets "permission denied" (42501). Tables made before the change keep their grants,
-- but 0002-0006 may be run after it, so this grants every table the companion reads or writes, exactly the
-- operations its row-level security policies allow (RLS still decides which rows). Nothing is granted to anon: PCs
-- and linking go through security definer functions, which keep their own EXECUTE grants.
-- Safe to run more than once, and before or after 30 October. Run after 0006_audit_log.sql.
-- Undo: supabase/rollback/0007_data_api_grants_down.sql.

grant select, insert, update, delete on table public.organizations to authenticated;
grant select, insert, update, delete on table public.memberships to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, delete on table public.invitations to authenticated;
grant select on table public.entities, public.entity_history, public.computers, public.remote_commands,
  public.remote_status, public.audit_log to authenticated;

-- The server-side role (never in a browser or on a PC), as Supabase granted it before.
grant select, insert, update, delete on all tables in schema public to service_role;
