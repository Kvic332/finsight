-- Market exchange rates into naira, refreshed daily by the fx-rates function.
-- Anyone may read them; only the service role writes.
create table if not exists public.fx_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$' and currency <> 'NGN'),
  ngn_per_unit numeric not null check (ngn_per_unit > 0),
  source text not null,
  fetched_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to anon, authenticated;
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);

-- Every daily decision, including held ones, for checking later.
create table if not exists public.fx_rate_imports (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  ngn_per_unit numeric,
  status text not null check (status in ('applied', 'held')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.fx_rate_imports enable row level security;
revoke all on public.fx_rate_imports from anon, authenticated;

-- Daily at 06:30 Lagos time, after the source's midnight UTC update.
select cron.schedule(
  'fx-rates',
  '30 5 * * *',
  $job$
  select net.http_post(
    url := 'https://otahfeuhnivowowkeolt.supabase.co/functions/v1/fx-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sec_import_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
