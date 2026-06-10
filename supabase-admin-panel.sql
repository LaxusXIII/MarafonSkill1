create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (email = auth.jwt() ->> 'email');

drop policy if exists "Admins can delete any runner" on public.runners;
create policy "Admins can delete any runner"
on public.runners
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

-- Replace this email with the Google account you use on the site.
-- insert into public.admin_users (email)
-- values ('your-email@example.com')
-- on conflict (email) do nothing;
