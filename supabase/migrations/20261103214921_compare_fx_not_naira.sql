-- FX rates are quoted in naira, so an FX product must name another currency.
alter table public.products add constraint products_fx_not_naira check (category <> 'fx' or currency <> 'NGN');
