-- Undo 0025: the slides on members' phones (sharp pictures, looking back) are removed. Members' phones (0020) keep
-- working with the small picture of the slide on screen. Only run this to roll back a problem with 0025.
drop function if exists public.room_slide(text, integer);
drop function if exists public.room_slides(text);
drop function if exists public.room_by_code(text);
drop function if exists public.pc_room_slide(integer, text, text, text);
drop trigger if exists room_slides_forget on public.member_rooms;
drop function if exists public.room_slides_forget();
drop table if exists public.room_slides;
