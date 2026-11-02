-- Undo 0012: the meeting list is no longer protected from older PCs, and the website offers one meeting again.
drop trigger if exists entities_keep_meeting_list on public.entities;
drop function if exists public.keep_meeting_list();
drop function if exists public.meetings_supported();
