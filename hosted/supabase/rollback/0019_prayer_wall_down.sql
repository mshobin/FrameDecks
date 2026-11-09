-- Undo 0019: the prayer wall is removed. Waiting requests are deleted with it (they were never kept anyway).
-- Teams, linked PCs and everything else are untouched. Only run this to roll back a problem with 0019.
drop function if exists public.prayer_send(text, text, text);
drop function if exists public.prayer_peek(text);
drop function if exists public.prayer_wall_of(text);
drop function if exists public.pc_prayer_take();
drop function if exists public.pc_prayer_close();
drop function if exists public.pc_prayer_open(integer);
drop table if exists public.prayer_requests;
drop table if exists public.prayer_walls;
