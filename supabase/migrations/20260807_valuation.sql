-- valuation_config: single-row config table for all 7 valuation method inputs
create table if not exists valuation_config (
  id                           uuid primary key default gen_random_uuid(),
  -- Berkus Method (pence, max £500k each)
  berkus_sound_idea            bigint not null default 25000000,
  berkus_prototype             bigint not null default 30000000,
  berkus_management_team       bigint not null default 20000000,
  berkus_strategic_rel         bigint not null default 15000000,
  berkus_product_rollout       bigint not null default 10000000,
  -- Scorecard / Payne Method
  scorecard_median_pence       bigint not null default 150000000,
  scorecard_team               numeric(5,3) not null default 1.0,
  scorecard_market_size        numeric(5,3) not null default 1.0,
  scorecard_product_tech       numeric(5,3) not null default 1.0,
  scorecard_competition        numeric(5,3) not null default 1.0,
  scorecard_marketing          numeric(5,3) not null default 1.0,
  scorecard_investment_need    numeric(5,3) not null default 1.0,
  scorecard_other              numeric(5,3) not null default 1.0,
  -- ARR Multiple
  arr_multiple                 numeric(6,2) not null default 7.0,
  -- VC Return Method
  vc_exit_valuation_pence      bigint not null default 2000000000,
  vc_investment_pence          bigint not null default 75000000,
  vc_years_to_exit             integer not null default 5,
  vc_required_irr              numeric(6,2) not null default 40.0,
  -- Comparable Company
  comp_arr_multiple_low        numeric(6,2) not null default 5.0,
  comp_arr_multiple_high       numeric(6,2) not null default 12.0,
  comp_baseline_pence          bigint not null default 200000000,
  comp_traction_premium_pct    numeric(6,2) not null default 0,
  -- DCF (simplified 3-year)
  dcf_discount_rate            numeric(6,2) not null default 35.0,
  dcf_terminal_multiple        numeric(6,2) not null default 4.0,
  dcf_year1_revenue_pence      bigint not null default 0,
  dcf_year2_revenue_pence      bigint not null default 0,
  dcf_year3_revenue_pence      bigint not null default 0,
  -- NHS Contract Value
  nhs_price_per_patient_pence  bigint not null default 60000,
  nhs_patients_per_icb         integer not null default 500,
  nhs_icb_count                integer not null default 3,
  nhs_probability_pct          numeric(6,2) not null default 25.0,

  updated_at                   timestamptz not null default now()
);

alter table valuation_config enable row level security;
create policy "admin_only" on valuation_config using (true);

-- valuation_snapshots: historical point-in-time valuation records
create table if not exists valuation_snapshots (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  low_pence       bigint not null,
  mid_pence       bigint not null,
  high_pence      bigint not null,
  method_outputs  jsonb not null default '{}',
  mrr_pence       bigint,
  total_users     integer,
  round_context   text,
  note            text,
  created_at      timestamptz not null default now()
);

alter table valuation_snapshots enable row level security;
create policy "admin_only" on valuation_snapshots using (true);
