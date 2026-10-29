-- Undo 0011_accounts_legal.sql: the three functions and the two profile columns (the acceptance records are lost).
drop function if exists public.delete_my_account();
drop function if exists public.export_my_data();
drop function if exists public.accept_terms(text);
alter table public.profiles drop column if exists terms_accepted_at;
alter table public.profiles drop column if exists terms_version;
