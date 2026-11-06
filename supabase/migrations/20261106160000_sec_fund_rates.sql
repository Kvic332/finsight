-- Weekly money market fund yields from the SEC report, applied by the
-- sec-fund-rates function. Every decision is logged; unusual figures are held.
create table if not exists public.fund_rate_imports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  report_date date not null,
  source_url text not null,
  proposed_pct numeric,
  status text not null check (status in ('applied', 'held', 'unmatched')),
  reason text,
  created_at timestamptz not null default now()
);

-- Only the service role reads or writes this log.
alter table public.fund_rate_imports enable row level security;
revoke all on public.fund_rate_imports from anon, authenticated;

create extension if not exists pg_net;

-- The scheduled job's secret, kept encrypted in the vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sec_import_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sec_import_secret', 'Lets the scheduled job run sec-fund-rates');
  end if;
end $$;

-- Lets the function check a request's secret without being able to read it.
create or replace function public.check_sec_import_secret(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'sec_import_secret' and decrypted_secret = candidate
  );
$$;

revoke execute on function public.check_sec_import_secret(text) from public, anon, authenticated;
grant execute on function public.check_sec_import_secret(text) to service_role;

-- Daily at 08:15 Lagos time. The function does nothing until the SEC publishes a
-- newer report, so running daily simply picks it up within a day.
select cron.schedule(
  'sec-fund-rates',
  '15 7 * * *',
  $job$
  select net.http_post(
    url := 'https://otahfeuhnivowowkeolt.supabase.co/functions/v1/sec-fund-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sec_import_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
