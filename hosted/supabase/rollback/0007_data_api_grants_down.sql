-- Undoes 0007_data_api_grants.sql. Only for a project where the tables were created before 30 October 2026 (they
-- keep Supabase's old automatic grants); on a project where they were created later, this cuts the companion off.
revoke select, insert, update, delete on table public.organizations, public.memberships, public.profiles,
  public.invitations, public.entities, public.entity_history, public.computers, public.remote_commands,
  public.remote_status, public.audit_log from authenticated;
