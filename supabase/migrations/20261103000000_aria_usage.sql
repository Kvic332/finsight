-- Daily ARIA message counts, used to cap what the Anthropic key can spend.
-- Holds the Firebase user id and a count only, never message content.
create table public.aria_usage (
  uid   text not null,
  day   date not null,
  count integer not null default 0,
  primary key (uid, day)
);

create index aria_usage_day_idx on public.aria_usage (day);

-- No policies on purpose: only the service role, used by the function, gets in.
alter table public.aria_usage enable row level security;

create function public.consume_aria_quota(
  p_uid text,
  p_user_limit integer,
  p_global_limit integer
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Africa/Lagos')::date;
  v_total bigint;
  v_updated integer;
begin
  -- Without this lock, simultaneous requests could all pass the global check.
  perform pg_advisory_xact_lock(hashtext('aria_usage:' || v_day::text));

  select coalesce(sum(count), 0) into v_total from public.aria_usage where day = v_day;
  if v_total >= p_global_limit then
    return 'global_limit';
  end if;

  insert into public.aria_usage as u (uid, day, count)
  values (p_uid, v_day, 1)
  on conflict (uid, day) do update set count = u.count + 1
  where u.count < p_user_limit
  returning u.count into v_updated;

  if v_updated is null then
    return 'user_limit';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.consume_aria_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_aria_quota(text, integer, integer) to service_role;
