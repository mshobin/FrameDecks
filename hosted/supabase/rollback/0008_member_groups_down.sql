-- Undoes 0008_member_groups.sql: removes member groups (the groups and who is in them are lost; members are not).
drop trigger if exists member_groups_audit on public.member_groups;
drop function if exists public.audit_member_groups();
drop table if exists public.member_group_members;
drop table if exists public.member_groups;
