create table if not exists public.runners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  telegram_user_id bigint,
  telegram_username text,
  source text not null default 'site',
  first_name text not null,
  last_name text not null,
  age integer not null check (age between 12 and 100),
  gender text not null,
  country text not null,
  distance text not null,
  email text not null,
  bmi numeric(4, 1) not null,
  bmi_category text not null,
  created_at timestamptz not null default now()
);

alter table public.runners enable row level security;

alter table public.runners
alter column user_id drop not null;

alter table public.runners
add column if not exists telegram_user_id bigint,
add column if not exists telegram_username text,
add column if not exists source text not null default 'site';

create index if not exists runners_created_at_idx
on public.runners (created_at desc);

create index if not exists runners_telegram_user_id_idx
on public.runners (telegram_user_id);

drop policy if exists "Authenticated users can read runners" on public.runners;
drop policy if exists "Anyone can read runners" on public.runners;
create policy "Anyone can read runners"
on public.runners
for select
to anon, authenticated
using (true);

drop policy if exists "Users can insert own runner" on public.runners;
create policy "Users can insert own runner"
on public.runners
for insert
to authenticated
with check (
  auth.uid() = user_id
  and source = 'site'
);

drop policy if exists "Android app can insert android runners" on public.runners;
create policy "Android app can insert android runners"
on public.runners
for insert
to anon
with check (
  user_id is null
  and telegram_user_id is null
  and source = 'android'
);

drop policy if exists "Users can update own runner" on public.runners;
create policy "Users can update own runner"
on public.runners
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and source = 'site');

drop policy if exists "Users can delete own runners" on public.runners;
create policy "Users can delete own runners"
on public.runners
for delete
to authenticated
using (auth.uid() = user_id);
