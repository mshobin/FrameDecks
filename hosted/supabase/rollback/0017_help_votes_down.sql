-- Undo 0017: the Help pages' votes are removed (the widget hides itself when help_vote is missing). Nothing else changes.
drop function if exists public.help_vote(text, boolean);
drop table if exists public.help_votes;
