-- Emails from the website's "Join the waitlist" form.
-- Visitors can only add a row. Nobody can read, change or delete rows with the
-- public key; read them in the Supabase dashboard.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) between 5 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text check (char_length(source) <= 100),
  created_at timestamptz not null default now()
);

-- One row per address, whatever the capitals. A repeat sign-up returns 409, which the site treats as success.
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist" on public.waitlist
  for insert to anon, authenticated
  with check (true);

revoke all on public.waitlist from anon, authenticated;
grant insert (email, source) on public.waitlist to anon, authenticated;
