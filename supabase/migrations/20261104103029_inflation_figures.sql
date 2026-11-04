-- Official headline inflation, one row per month, so savings and fund rates can be
-- compared with it. The app reads the newest row with the publishable key.
create table public.inflation_figures (
  month        date primary key check (extract(day from month) = 1),
  headline_pct numeric not null check (headline_pct between 0 and 500),
  source_url   text not null check (source_url ~ '^https://'),
  checked_at   timestamptz not null,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  check (checked_at <= updated_at)
);

create trigger inflation_figures_set_updated_at before update on public.inflation_figures
  for each row execute function public.set_updated_at();

alter table public.inflation_figures enable row level security;

create policy "Inflation figures are public" on public.inflation_figures
  for select to anon, authenticated
  using (true);

revoke all on public.inflation_figures from public, anon, authenticated;
grant select (month, headline_pct, source_url, checked_at) on public.inflation_figures to anon, authenticated;
