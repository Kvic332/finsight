-- If two checks share a timestamp, the one that isn't "verified" wins, so a tie
-- can never keep a revoked licence on show.
create or replace view public.provider_badges with (security_invoker = true) as
select provider_id, regulator, licence_type, licence_number, source_url, checked_at, expires_at
from (
  select distinct on (provider_id, regulator)
    provider_id, regulator, licence_type, licence_number, status, source_url, checked_at, expires_at
  from public.verifications
  order by provider_id, regulator, checked_at desc, status = 'verified', created_at desc
) latest
where status = 'verified' and (expires_at is null or expires_at > now());
