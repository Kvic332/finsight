-- Checks the Compare and Grow access rules. Run it against the database with the
-- migration applied. It stops with an error if a check fails, and rolls back at
-- the end, so the made-up providers below are never saved.
begin;

create function pg_temp.count_as(p_role text, p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute format('set local role %I', p_role);
  execute 'select count(*) from (' || p_sql || ') q' into n;
  reset role;
  return n;
end;
$$;

create function pg_temp.must_fail(p_role text, p_sql text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute format('set local role %I', p_role);
    execute p_sql;
  exception when others then
    reset role;
    return;
  end;
  reset role;
  raise exception 'should have failed: %', p_label;
end;
$$;

create function pg_temp.expect(p_actual bigint, p_expected bigint, p_label text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception '%: expected %, got %', p_label, p_expected, p_actual;
  end if;
end;
$$;

insert into public.providers (id, name, website_url, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Test Verified', 'https://a.test', 'published'),
  ('00000000-0000-0000-0000-00000000000b', 'Test No Licence', 'https://b.test', 'published'),
  ('00000000-0000-0000-0000-00000000000c', 'Test Draft', 'https://c.test', 'draft'),
  ('00000000-0000-0000-0000-00000000000d', 'Test Expired', 'https://d.test', 'published'),
  ('00000000-0000-0000-0000-00000000000e', 'Test Revoked', 'https://e.test', 'published'),
  ('00000000-0000-0000-0000-00000000000f', 'Test Wrong Regulator', 'https://f.test', 'published');

insert into public.products (id, provider_id, category, name, referral_url, status) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'loan', 'Loan', null, 'published'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'loan', 'Loan', null, 'published'),
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'loan', 'Loan', null, 'published'),
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'loan', 'Loan', null, 'published'),
  ('10000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e', 'loan', 'Loan', null, 'published'),
  ('10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000f', 'loan', 'Loan', null, 'published'),
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'loan', 'Unpublished loan', null, 'draft'),
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'loan', 'No rate yet', null, 'published');

insert into public.rates (product_id, category, rate_min_pct, rate_max_pct, rate_period, source_url, checked_at)
select id, 'loan', 4, 10, 'monthly', 'https://source.test', now()
from public.products where name <> 'No rate yet';

insert into public.verifications (provider_id, regulator, status, source_url, checked_at, expires_at, notes) values
  ('00000000-0000-0000-0000-00000000000a', 'FCCPC', 'verified', 'https://reg.test', now(), null, 'private note'),
  ('00000000-0000-0000-0000-00000000000c', 'FCCPC', 'verified', 'https://reg.test', now(), null, null),
  ('00000000-0000-0000-0000-00000000000d', 'FCCPC', 'verified', 'https://reg.test', now() - interval '2 days', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-00000000000e', 'FCCPC', 'verified', 'https://reg.test', now() - interval '2 days', null, null),
  ('00000000-0000-0000-0000-00000000000e', 'FCCPC', 'revoked', 'https://reg.test', now(), null, null),
  ('00000000-0000-0000-0000-00000000000f', 'SEC', 'verified', 'https://reg.test', now(), null, null);

-- Only the verified, published product with a rate is listed.
select pg_temp.expect(pg_temp.count_as('anon', 'select 1 from public.compare_listings'), 1, 'anon listings');
select pg_temp.expect(pg_temp.count_as('authenticated', 'select 1 from public.compare_listings'), 1, 'signed-in listings');
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.compare_listings where provider_name = 'Test Verified' and jsonb_array_length(badges) = 1$q$), 1, 'badge shown');

-- Monthly rates are annualised for sorting, without compounding.
select pg_temp.expect(pg_temp.count_as('anon', 'select 1 from public.compare_listings where annual_min_pct = 48 and annual_max_pct = 120'), 1, 'annualised rate');

-- A referral link is used and disclosed.
update public.products set referral_url = 'https://ref.test/x' where id = '10000000-0000-0000-0000-00000000000a';
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.compare_listings where is_referral and link_url = 'https://ref.test/x'$q$), 1, 'referral disclosed');

-- Unpublishing removes the listing straight away.
update public.providers set status = 'archived' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect(pg_temp.count_as('anon', 'select 1 from public.compare_listings'), 0, 'archived provider hidden');
update public.providers set status = 'published' where id = '00000000-0000-0000-0000-00000000000a';

-- The public can't see drafts, private columns or history.
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.providers where name = 'Test Draft'$q$), 0, 'draft provider');
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.products where name = 'Unpublished loan'$q$), 0, 'draft product');
select pg_temp.must_fail('anon', 'select notes from public.verifications', 'read notes');
select pg_temp.must_fail('anon', 'select checked_by from public.verifications', 'read checked_by');
select pg_temp.must_fail('anon', 'select updated_by from public.rates', 'read updated_by');
select pg_temp.must_fail('anon', 'select * from public.rate_history', 'read history');

-- The public can't write anything.
select pg_temp.must_fail('anon', $q$insert into public.providers (name, website_url) values ('x', 'https://x.test')$q$, 'anon insert');
select pg_temp.must_fail('anon', $q$update public.rates set rate_min_pct = 0$q$, 'anon update');
select pg_temp.must_fail('anon', $q$delete from public.verifications$q$, 'anon delete');
select pg_temp.must_fail('authenticated', $q$update public.providers set status = 'published'$q$, 'signed-in update');

-- Every rate write is recorded, and the record can't be changed.
select pg_temp.expect((select count(*) from public.rate_history where product_id = '10000000-0000-0000-0000-00000000000a'), 1, 'history on insert');
update public.rates set rate_min_pct = 5 where product_id = '10000000-0000-0000-0000-00000000000a';
select pg_temp.expect((select count(*) from public.rate_history where product_id = '10000000-0000-0000-0000-00000000000a'), 2, 'history on update');
select pg_temp.must_fail('service_role', 'delete from public.rate_history', 'delete history');
select pg_temp.must_fail('service_role', 'update public.verifications set status = $s$verified$s$', 'rewrite a licence check');

-- The admin function can still add a check and manage the catalogue.
set local role service_role;
insert into public.verifications (provider_id, regulator, status, source_url, checked_at)
values ('00000000-0000-0000-0000-00000000000b', 'FCCPC', 'verified', 'https://reg.test', now());
reset role;
select pg_temp.expect(pg_temp.count_as('anon', 'select 1 from public.compare_listings'), 2, 'listed once verified');

-- A later revocation hides it again, without editing the earlier check.
insert into public.verifications (provider_id, regulator, status, source_url, checked_at)
values ('00000000-0000-0000-0000-00000000000b', 'FCCPC', 'revoked', 'https://reg.test', now());
select pg_temp.expect(pg_temp.count_as('anon', 'select 1 from public.compare_listings'), 1, 'hidden once revoked');

-- Bad data is rejected.
select pg_temp.must_fail('postgres', $q$insert into public.providers (name, website_url) values ('x', 'javascript:alert(1)')$q$, 'unsafe website');
select pg_temp.must_fail('postgres', $q$update public.products set referral_url = 'http://x.test' where name = 'Loan'$q$, 'unsafe referral');
select pg_temp.must_fail('postgres', $q$update public.rates set rate_min_pct = 20, rate_max_pct = 10$q$, 'min above max');
select pg_temp.must_fail('postgres', $q$update public.rates set source_url = ''$q$, 'missing source');
select pg_temp.must_fail('postgres', $q$update public.rates set buy_rate = 1500$q$, 'FX rate on a loan');
select pg_temp.must_fail('postgres', $q$update public.rates set category = 'fx'$q$, 'category mismatch');
select pg_temp.must_fail('postgres', $q$update public.rates set checked_at = now() + interval '1 day'$q$, 'rate checked in the future');
select pg_temp.must_fail('postgres', $q$insert into public.verifications (provider_id, regulator, status, source_url, checked_at) values ('00000000-0000-0000-0000-00000000000a', 'FCCPC', 'verified', 'https://reg.test', now() + interval '1 day')$q$, 'licence checked in the future');
select pg_temp.must_fail('postgres', $q$insert into public.verifications (provider_id, regulator, status, source_url, checked_at) values ('00000000-0000-0000-0000-00000000000a', 'NAFDAC', 'verified', 'https://reg.test', now())$q$, 'unknown regulator');

-- FX products need a buy or sell rate and are checked against CBN.
insert into public.products (id, provider_id, category, name, currency, status) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'fx', 'USD', 'USD', 'published');
select pg_temp.must_fail('postgres', $q$insert into public.rates (product_id, category, source_url, checked_at) values ('40000000-0000-0000-0000-00000000000a', 'fx', 'https://s.test', now())$q$, 'FX without a rate');
select pg_temp.must_fail('postgres', $q$insert into public.rates (product_id, category, buy_rate, sell_rate, source_url, checked_at) values ('40000000-0000-0000-0000-00000000000a', 'fx', 1600, 1500, 'https://s.test', now())$q$, 'buy above sell');
insert into public.rates (product_id, category, buy_rate, sell_rate, source_url, checked_at)
values ('40000000-0000-0000-0000-00000000000a', 'fx', 1500, 1600, 'https://s.test', now());
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.compare_listings where category = 'fx'$q$), 0, 'FX needs a CBN licence');
insert into public.verifications (provider_id, regulator, status, source_url, checked_at)
values ('00000000-0000-0000-0000-00000000000a', 'CBN', 'verified', 'https://reg.test', now());
select pg_temp.expect(pg_temp.count_as('anon', $q$select 1 from public.compare_listings where category = 'fx'$q$), 1, 'FX listed with a CBN licence');

rollback;
