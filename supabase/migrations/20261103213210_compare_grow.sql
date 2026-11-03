-- Compare and Grow catalogue: providers, products, rates, rate history and
-- licence checks. Everything here is public information about providers. No
-- user data belongs in these tables.
--
-- The app reads compare_listings with the publishable key. Writes use the
-- service role only, through the admin function in Stage 5.
--
-- There is deliberately no column for sponsorship, boost or rank. Payment can't
-- affect ordering because ordering can only come from the rates.

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  logo_url    text check (logo_url ~ '^https://'),
  website_url text not null check (website_url ~ '^https://'),
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid not null references public.providers (id) on delete restrict,
  category       text not null check (category in ('loan', 'savings', 'fund', 'fx')),
  name           text not null check (length(trim(name)) > 0),
  -- Currency of the amounts, or for FX the currency being exchanged against naira.
  currency       text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  min_amount     numeric check (min_amount >= 0),
  max_amount     numeric check (max_amount >= 0),
  min_tenor_days integer check (min_tenor_days >= 0),
  max_tenor_days integer check (max_tenor_days >= 0),
  fees           text,
  key_terms      text[] not null default '{}',
  -- Set only when FinSight is paid for the click, so the app can disclose it.
  referral_url   text check (referral_url ~ '^https://'),
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (provider_id, category, name),
  unique (id, category),
  check (min_amount <= max_amount),
  check (min_tenor_days <= max_tenor_days)
);

-- The current rate for each product. Every rate has to name its source.
create table public.rates (
  product_id     uuid primary key,
  category       text not null,
  rate_min_pct   numeric check (rate_min_pct between 0 and 1000),
  rate_max_pct   numeric check (rate_max_pct between 0 and 1000),
  rate_period    text check (rate_period in ('annual', 'monthly', 'daily', 'per_term')),
  -- Simple, not compounded, so rates quoted differently can be sorted together.
  -- Stays null for per_term because that depends on the length of the term.
  annual_min_pct numeric generated always as (
    case rate_period
      when 'annual' then rate_min_pct
      when 'monthly' then rate_min_pct * 12
      when 'daily' then rate_min_pct * 365
    end
  ) stored,
  annual_max_pct numeric generated always as (
    case rate_period
      when 'annual' then coalesce(rate_max_pct, rate_min_pct)
      when 'monthly' then coalesce(rate_max_pct, rate_min_pct) * 12
      when 'daily' then coalesce(rate_max_pct, rate_min_pct) * 365
    end
  ) stored,
  buy_rate       numeric check (buy_rate > 0),
  sell_rate      numeric check (sell_rate > 0),
  source_url     text not null check (source_url ~ '^https://'),
  checked_at     timestamptz not null,
  updated_by     text,
  updated_at     timestamptz not null default now(),
  foreign key (product_id, category) references public.products (id, category) on delete restrict,
  check (rate_min_pct <= rate_max_pct),
  check (buy_rate <= sell_rate),
  check (checked_at <= updated_at),
  check (
    case when category = 'fx'
      then (buy_rate is not null or sell_rate is not null)
        and rate_min_pct is null and rate_max_pct is null and rate_period is null
      else rate_min_pct is not null and rate_period is not null
        and buy_rate is null and sell_rate is null
    end
  )
);

-- Written by a trigger so no rate change can skip it.
create table public.rate_history (
  id           bigint generated always as identity primary key,
  product_id   uuid not null references public.products (id) on delete restrict,
  rate_min_pct numeric,
  rate_max_pct numeric,
  rate_period  text,
  buy_rate     numeric,
  sell_rate    numeric,
  source_url   text not null,
  checked_at   timestamptz not null,
  changed_by   text,
  recorded_at  timestamptz not null default now()
);

create index rate_history_product_idx on public.rate_history (product_id, recorded_at desc);

-- Each row is one check of a regulator's register, and the latest one counts.
-- To correct a mistake, add a new check rather than editing an old one.
create table public.verifications (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid not null references public.providers (id) on delete restrict,
  regulator      text not null check (regulator in ('CBN', 'FCCPC', 'SEC')),
  licence_type   text,
  licence_number text,
  status         text not null check (status in ('verified', 'revoked', 'not_found')),
  source_url     text not null check (source_url ~ '^https://'),
  checked_at     timestamptz not null,
  expires_at     timestamptz,
  checked_by     text,
  notes          text,
  created_at     timestamptz not null default now(),
  check (checked_at <= created_at)
);

create index verifications_latest_idx on public.verifications (provider_id, regulator, checked_at desc);

create trigger providers_set_updated_at before update on public.providers
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger rates_set_updated_at before update on public.rates
  for each row execute function public.set_updated_at();

create function public.record_rate_history() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.rate_history
    (product_id, rate_min_pct, rate_max_pct, rate_period, buy_rate, sell_rate, source_url, checked_at, changed_by)
  values
    (new.product_id, new.rate_min_pct, new.rate_max_pct, new.rate_period, new.buy_rate, new.sell_rate, new.source_url, new.checked_at, new.updated_by);
  return null;
end;
$$;

create trigger rates_record_history after insert or update on public.rates
  for each row execute function public.record_rate_history();

-- The licences that count today. Expired or revoked ones drop out on their own.
create view public.provider_badges with (security_invoker = true) as
select provider_id, regulator, licence_type, licence_number, source_url, checked_at, expires_at
from (
  select distinct on (provider_id, regulator)
    provider_id, regulator, licence_type, licence_number, status, source_url, checked_at, expires_at
  from public.verifications
  order by provider_id, regulator, checked_at desc, created_at desc
) latest
where status = 'verified' and (expires_at is null or expires_at > now());

-- What the app shows. A product needs a sourced rate and a current licence from
-- the regulator for its category, so anything unverified stays hidden even if
-- someone publishes it by mistake.
create view public.compare_listings with (security_invoker = true) as
select
  pr.id as product_id,
  pr.category,
  pr.name as product_name,
  p.id as provider_id,
  p.name as provider_name,
  p.logo_url,
  coalesce(pr.referral_url, p.website_url) as link_url,
  pr.referral_url is not null as is_referral,
  pr.currency,
  pr.min_amount,
  pr.max_amount,
  pr.min_tenor_days,
  pr.max_tenor_days,
  pr.fees,
  pr.key_terms,
  r.rate_min_pct,
  r.rate_max_pct,
  r.rate_period,
  r.annual_min_pct,
  r.annual_max_pct,
  r.buy_rate,
  r.sell_rate,
  r.source_url as rate_source_url,
  r.checked_at as rate_checked_at,
  b.badges
from public.products pr
join public.providers p on p.id = pr.provider_id
join public.rates r on r.product_id = pr.id
cross join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'regulator', pb.regulator,
      'licence_type', pb.licence_type,
      'licence_number', pb.licence_number,
      'source_url', pb.source_url,
      'checked_at', pb.checked_at
    ) order by pb.regulator
  ) as badges
  from public.provider_badges pb
  where pb.provider_id = p.id
    and pb.regulator = any (
      case pr.category
        when 'loan' then array['FCCPC', 'CBN']
        when 'savings' then array['CBN']
        when 'fund' then array['SEC']
        when 'fx' then array['CBN']
      end
    )
) b
where pr.status = 'published' and p.status = 'published' and b.badges is not null;

alter table public.providers enable row level security;
alter table public.products enable row level security;
alter table public.rates enable row level security;
alter table public.rate_history enable row level security;
alter table public.verifications enable row level security;

create policy "Published providers are public" on public.providers
  for select to anon, authenticated
  using (status = 'published');

create policy "Published products are public" on public.products
  for select to anon, authenticated
  using (status = 'published' and exists (select 1 from public.providers p where p.id = provider_id));

create policy "Rates of published products are public" on public.rates
  for select to anon, authenticated
  using (exists (select 1 from public.products pr where pr.id = product_id));

create policy "Checks of published providers are public" on public.verifications
  for select to anon, authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id));

-- rate_history has no policy, so only the service role can read it.
revoke all on public.providers, public.products, public.rates, public.rate_history, public.verifications
  from public, anon, authenticated;
revoke all on public.provider_badges, public.compare_listings from public, anon, authenticated;

-- Listed column by column so internal fields such as notes and checked_by stay private.
grant select (id, name, logo_url, website_url, status) on public.providers to anon, authenticated;
grant select (id, provider_id, category, name, currency, min_amount, max_amount, min_tenor_days, max_tenor_days, fees, key_terms, referral_url, status)
  on public.products to anon, authenticated;
grant select (product_id, rate_min_pct, rate_max_pct, rate_period, annual_min_pct, annual_max_pct, buy_rate, sell_rate, source_url, checked_at)
  on public.rates to anon, authenticated;
grant select (provider_id, regulator, licence_type, licence_number, status, source_url, checked_at, expires_at, created_at)
  on public.verifications to anon, authenticated;
grant select on public.provider_badges, public.compare_listings to anon, authenticated;

-- History and licence checks are a record, so even the admin function can only add to them.
revoke update, delete, truncate on public.rate_history, public.verifications from service_role;
