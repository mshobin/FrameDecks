-- Undo 0026: typed answers from members' phones are removed, with any prompt and its answers (only hashed phone ids,
-- never names). Members' phones (0020), polls (0022) and everything else are untouched. Only run this to roll back a
-- problem with 0026.
drop function if exists public.room_answer(text, text, text, uuid);
drop function if exists public.room_prompt(text, text);
drop function if exists public.room_open_prompt(public.member_rooms);
drop function if exists public.pc_room_answers_list();
drop function if exists public.pc_room_answers_close();
drop function if exists public.pc_room_answers_open(text);
drop table if exists public.room_answers;
drop table if exists public.room_answer_prompts;
