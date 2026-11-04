-- Limits only need recent counts, so older rows are removed for everyone, every
-- night. This also covers deleted accounts and anonymous users, without giving
-- anyone a way to reset their own limit.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-aria-usage',
  '17 2 * * *',
  $$delete from public.aria_usage where day < (now() at time zone 'Africa/Lagos')::date - 30$$
);
