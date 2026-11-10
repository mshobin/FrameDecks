-- Undo 0022: quick responses and polls from members' phones are removed, with any question and its answers (only
-- hashed phone ids, never names). Members' phones (0020) and everything else are untouched. Only run this to roll back
-- a problem with 0022.
drop function if exists public.room_respond(text, text, integer, uuid);
drop function if exists public.room_response(text, bigint, text);
drop function if exists public.room_open_response(public.member_rooms);
drop function if exists public.pc_room_response_results();
drop function if exists public.pc_room_response_close();
drop function if exists public.pc_room_response_open(text, text, jsonb, boolean);
drop function if exists public.room_response_counts(public.room_responses);
drop table if exists public.room_votes;
drop table if exists public.room_responses;
