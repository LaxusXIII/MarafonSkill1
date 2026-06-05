create table if not exists public.runners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

drop policy if exists "Authenticated users can read runners" on public.runners;
create policy "Authenticated users can read runners"
on public.runners
for select
to authenticated
using (true);

drop policy if exists "Users can insert own runner" on public.runners;
create policy "Users can insert own runner"
on public.runners
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own runner" on public.runners;
create policy "Users can update own runner"
on public.runners
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own runners" on public.runners;
create policy "Users can delete own runners"
on public.runners
for delete
to authenticated
using (auth.uid() = user_id);
