alter table public.runners
alter column user_id drop not null;

alter table public.runners
add column if not exists telegram_user_id bigint,
add column if not exists telegram_username text,
add column if not exists source text not null default 'site';

create index if not exists runners_telegram_user_id_idx
on public.runners (telegram_user_id);

drop policy if exists "Anyone can read runners" on public.runners;
create policy "Anyone can read runners"
on public.runners
for select
to anon, authenticated
using (true);
