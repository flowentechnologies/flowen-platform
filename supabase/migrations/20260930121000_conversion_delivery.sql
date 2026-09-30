-- Review-only additive migration. Apply only after reconciling migration history.
create table public.analytics_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_id text not null,
  anonymous_id text,
  client_id text not null,
  session_id text,
  captured_at timestamptz not null default now(),
  primary key (user_id, measurement_id)
);
alter table public.analytics_identities enable row level security;
revoke all on public.analytics_identities from public, anon, authenticated;
grant all on public.analytics_identities to service_role;

create table public.conversion_deliveries (
  invoice_id text not null,
  destination text not null check (destination in ('meta','google_ads','ga4')),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('sending','sent','failed')),
  claim_id uuid not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (invoice_id,destination)
);
alter table public.conversion_deliveries enable row level security;
revoke all on public.conversion_deliveries from public, anon, authenticated;
grant all on public.conversion_deliveries to service_role;

-- One atomic lease per destination. A timed-out request may retry after 90s.
-- Network acceptance + DB completion cannot be atomic: platform dedup keys remain essential.
create function public.claim_conversion_delivery(p_invoice_id text,p_destination text,p_user_id uuid,p_claim_id uuid)
returns text language plpgsql security invoker set search_path=public as $$
declare acquired uuid; current_state text;
begin
  insert into public.conversion_deliveries(invoice_id,destination,user_id,state,claim_id)
  values(p_invoice_id,p_destination,p_user_id,'sending',p_claim_id)
  on conflict(invoice_id,destination) do update set
    state='sending',claim_id=excluded.claim_id,claimed_at=now()
  where conversion_deliveries.state='failed' or
    (conversion_deliveries.state='sending' and conversion_deliveries.claimed_at < now()-interval '90 seconds')
  returning claim_id into acquired;
  if acquired is not null then return 'claimed'; end if;
  select state into current_state from public.conversion_deliveries where invoice_id=p_invoice_id and destination=p_destination;
  return coalesce(current_state,'busy');
end $$;
revoke all on function public.claim_conversion_delivery(text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_conversion_delivery(text,text,uuid,uuid) to service_role;
