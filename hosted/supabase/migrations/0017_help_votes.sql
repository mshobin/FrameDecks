-- 0017 (26.11.4): "Was this helpful?" on the Help pages. Only the article and the vote are kept, with the time:
-- no person, no account, no address, no browser. Anyone may vote (the Help pages are public), only through
-- help_vote(), which checks the article's name and keeps the table from being flooded; nobody can read the votes
-- from the website. The owner reads them in the Supabase SQL editor:
--   select article, count(*) filter (where helpful) as yes, count(*) filter (where not helpful) as no
--   from public.help_votes group by article order by no desc;
-- Purely additive. Run once in the Supabase SQL editor, after 0016. Undo: rollback/0017_help_votes_down.sql.

create table public.help_votes (
  id bigint generated always as identity primary key,
  article text not null check (article ~ '^[a-z0-9][a-z0-9/#?=._-]{0,119}$'),
  helpful boolean not null,
  created_at timestamptz not null default now()
);
create index help_votes_recent on public.help_votes (created_at);
alter table public.help_votes enable row level security;
-- No client policies: votes go in through help_vote() and are read only in the SQL editor.

create or replace function public.help_vote(article text, helpful boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if article is null or article !~ '^[a-z0-9][a-z0-9/#?=._-]{0,119}$' or helpful is null then
    raise exception 'Not a Help article' using errcode = '22023';
  end if;
  -- a calm ceiling for the whole site: a few thousand votes an hour is far more than real readers give
  if (select count(*) from public.help_votes v where v.created_at > now() - interval '1 hour') >= 3000 then
    return false;
  end if;
  insert into public.help_votes (article, helpful) values (help_vote.article, help_vote.helpful);
  return true;
end;
$$;

revoke all on table public.help_votes from public, anon, authenticated;
revoke execute on function public.help_vote(text, boolean) from public;
grant execute on function public.help_vote(text, boolean) to anon, authenticated;
