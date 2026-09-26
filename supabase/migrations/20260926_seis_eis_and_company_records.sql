-- Two more admin-editable registers, requested directly by Howard:
--
--   company_records: general company identifiers (Corporation Tax UTR, VAT
--   number, PAYE reference, Companies House authentication code, etc.) per
--   Flowen group entity — there was nowhere to keep these; seeded here with
--   Flowen Group Ltd's Corporation Tax UTR (95994 00120, tax office 623),
--   received from HMRC 26 Sep 2026 — the letter that prompted this table.
--
--   seis_eis_status: replaces the static [FILL IN] placeholders scattered
--   through the SEIS Advance Assurance application letter (src/lib/ip-docs/
--   content.tsx) with a real, live-tracked status — advance assurance
--   stage, the financial/employment figures HMRC's application actually
--   needs, and whether the SEIS1 compliance statement has been filed once
--   shares are issued. Seeded with only what's actually confirmed true this
--   session; every figure that still needs real data is left null, not
--   guessed.
--
-- Both follow the established RLS-enabled-no-policies (service-role only)
-- pattern for admin-only tables in this codebase.

create table if not exists public.company_records (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('group', 'ip', 'labs', 'speech-technologies')),
  record_type text not null check (record_type in (
    'corporation_tax_utr', 'vat_number', 'paye_reference',
    'companies_house_auth_code', 'other'
  )),
  value text not null,
  issued_by text,
  issued_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.company_records enable row level security;

comment on table public.company_records is
  'General company identifiers (UTR, VAT number, PAYE reference, Companies House auth code) per Flowen group entity. Admin-editable at /admin/company-records.';

insert into public.company_records (entity, record_type, value, issued_by, issued_date, notes) values
  ('group', 'corporation_tax_utr', '9599400120', 'HMRC', '2026-09-26', 'Tax office 623. From the CT41G letter HMRC sends automatically after Companies House notifies them of incorporation. Action still needed: tell HMRC within 3 months of starting business activity whether the company is trading or dormant — Group is the deliberately non-trading holding company (protects SEIS/EIS qualifying status), so this should very likely be registered as dormant/not-yet-trading, not active.')
on conflict do nothing;

create table if not exists public.seis_eis_status (
  id uuid primary key default gen_random_uuid(),
  advance_assurance_status text not null default 'drafted'
    check (advance_assurance_status in ('drafted', 'submitted', 'granted', 'declined')),
  advance_assurance_submitted_at date,
  advance_assurance_reference text,
  consolidated_gross_assets_pence bigint,
  total_fte numeric,
  first_trading_date date,
  prior_eis_vct_investment boolean,
  prior_eis_vct_notes text,
  seis1_filed boolean not null default false,
  seis1_filed_at date,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.seis_eis_status enable row level security;

comment on table public.seis_eis_status is
  'Live-tracked SEIS Advance Assurance status for Flowen Group Ltd, replacing the [FILL IN] placeholders in the static application letter (src/lib/ip-docs/content.tsx). Admin-editable at /admin/seis-eis.';

insert into public.seis_eis_status (advance_assurance_status, notes) values
  ('drafted', 'Application letter drafted (src/lib/ip-docs/content.tsx) but not yet submitted to HMRC. Still needs: consolidated group gross assets, total FTE headcount, first commercial sale/trading date, confirmation of any prior EIS/VCT investment, and post-issue shareholding percentages before it can be submitted.')
on conflict do nothing;
