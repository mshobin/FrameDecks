-- 0012 (FrameDecks 8.5): several meetings in one workspace, kept safe from older PCs.
--
-- The meetings (name, date, notes of each) are a list in the meeting record's body, "meetings". A PC before 8.5 does not
-- know that field: it cleans its plan to the fields it knows and sends the meeting record back without the list,
-- which would remove every meeting's date and notes (and every meeting with no Frames yet) for everyone. This trigger
-- keeps the list when a change to the meeting record arrives without one (or with an empty one); a change that has a
-- list is stored as it is. Nothing else changes: every other record, and every other field, is stored as sent.
-- Undo: supabase/rollback/0012_meetings_down.sql.

create or replace function public.keep_meeting_list()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'meeting' and new.body is not null and old.body is not null
     and jsonb_typeof(old.body -> 'meetings') = 'array' and jsonb_array_length(old.body -> 'meetings') > 0
     and (jsonb_typeof(new.body -> 'meetings') is distinct from 'array' or jsonb_array_length(new.body -> 'meetings') = 0) then
    new.body := new.body || jsonb_build_object('meetings', old.body -> 'meetings');
  end if;
  return new;
end;
$$;

drop trigger if exists entities_keep_meeting_list on public.entities;
create trigger entities_keep_meeting_list before update on public.entities
  for each row execute function public.keep_meeting_list();

-- The website asks this before offering more than one meeting (without 0012 it offers one, as before).
create or replace function public.meetings_supported()
returns boolean
language sql
stable
as $$ select true $$;

revoke execute on function public.meetings_supported() from public;
grant execute on function public.meetings_supported() to authenticated;
