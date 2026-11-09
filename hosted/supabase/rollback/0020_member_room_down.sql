-- Undo 0020: members' phones (follow along and shared sermon notes) are removed. Nothing else is touched. Only run this
-- to roll back a problem with 0020.
drop function if exists public.room_view(text, bigint);
drop function if exists public.pc_room_close();
drop function if exists public.pc_room_publish(jsonb, jsonb, boolean);
drop function if exists public.pc_room_open(integer);
drop table if exists public.member_rooms;
