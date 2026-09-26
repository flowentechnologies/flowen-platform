-- Resolves 3 of the 5 admin gaps found in this session's audit:
--   3. Sub-processor/DPA register was hardcoded in source (src/app/dpa/page.tsx),
--      requiring a code deploy to add a vendor — exactly how the OpenAI/
--      ElevenLabs/Agora disclosure gap went unnoticed. Now a real, admin-
--      editable table; the DPA page reads from it live.
--   4. No insurance tracking anywhere — not a single field in the whole app.
--   5. No safeguarding section — only a reference to "your org's safeguarding
--      policy" (i.e. the clinician's own employer's, never Flowen's own).
--
-- All three follow the established pattern for admin-only tables in this
-- codebase (xero_oauth_tokens, gmail_oauth_tokens, bookkeeping_drafts): RLS
-- enabled, no policies — service-role (adminDb) access only, since every
-- read/write goes through an assertAdmin()-gated route, never the client
-- directly.

-- ── Sub-processor register ───────────────────────────────────────────────────
create table if not exists public.sub_processors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text not null,
  data_categories text not null,
  location text not null,
  safeguard text not null,
  active boolean not null default true,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sub_processors enable row level security;

comment on table public.sub_processors is
  'The real, current list of sub-processors shown on /dpa and referenced in the privacy policy — admin-editable via /admin/sub-processors instead of hardcoded in page.tsx, so adding a new vendor (e.g. an AI provider) cannot silently go undisclosed again.';

-- Seed with the vendors confirmed in this session (matches the DPA page's
-- table as of the OpenAI/ElevenLabs/Agora disclosure fix).
insert into public.sub_processors (name, purpose, data_categories, location, safeguard) values
  ('Supabase Inc.', 'Database, auth, storage (including session recordings)', 'All platform data', 'UK-GBR', 'SCCs + UK Addendum'),
  ('Vercel Inc.', 'Hosting, edge functions', 'Request data, application logs', 'UK/EU', 'SCCs + UK Addendum'),
  ('Agora Inc.', 'Real-time voice relay for AI conversation practice', 'Live audio, streamed in real time - not stored by Agora', 'US/EU', 'SCCs + UK Addendum'),
  ('OpenAI, L.L.C.', 'AI language model for AI conversation practice', 'Speech transcribed from live audio, and text typed/spoken to the AI', 'US', 'SCCs + UK Addendum; OpenAI does not use API data to train its models'),
  ('ElevenLabs Inc.', 'AI voice synthesis; voice cloning where a user opts in', 'Calibration recording (if a voice clone is created) and text to be spoken by the AI', 'US/EU', 'SCCs + UK Addendum. Users may delete their voice clone, and its underlying recording, at any time'),
  ('Functional Software Inc. (Sentry)', 'Error monitoring (PHI masked)', 'Anonymised error logs', 'EU/US', 'SCCs + UK Addendum'),
  ('Stripe Inc.', 'Payment processing', 'Payment data, email for receipt', 'US/EU', 'Independent controller; UK-US Data Bridge')
on conflict do nothing;

-- ── Insurance register ────────────────────────────────────────────────────────
create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null,          -- e.g. 'Professional Indemnity', 'Clinical Negligence', 'Cyber', 'Public/Products Liability'
  provider text,
  policy_number text,
  entity text,                        -- which Flowen entity this covers
  coverage_amount_pence bigint,
  start_date date,
  end_date date,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.insurance_policies enable row level security;

comment on table public.insurance_policies is
  'Insurance register — deliberately starts empty. No policy has ever existed in this codebase; this gives one a real home instead of the absence being invisible. NHS/institutional procurement will ask for professional indemnity and clinical negligence cover as standard due diligence before contracting.';

-- ── Safeguarding concern log ──────────────────────────────────────────────────
create table if not exists public.safeguarding_concerns (
  id uuid primary key default gen_random_uuid(),
  raised_by text,                     -- name/role of whoever raised it
  patient_user_id uuid references public.profiles(id) on delete set null,
  category text not null default 'other',  -- disclosure | self_harm_risk | referral_needed | other
  description text not null,
  status text not null default 'open',     -- open | escalated | resolved | referred_external
  escalated_to text,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.safeguarding_concerns enable row level security;

comment on table public.safeguarding_concerns is
  'Safeguarding concern log — the record a real safeguarding policy needs to point to. Distinct from hazard_log (DCB0129 clinical-software safety hazards) and gdpr_requests (data-subject rights): this is about a person''s welfare, not a system defect or a data request.';

-- ── Compliance checklist entries ──────────────────────────────────────────────
-- Ties the two new registers into the existing NHS Compliance checklist
-- (/admin/compliance) rather than leaving them only reachable from their own
-- dedicated pages. framework has a check constraint enumerating the existing
-- 5 NHS-procurement frameworks (dcb0129/dtac/dspt/mhra/wcag) — extending it
-- rather than working around it, same as every other enum-widening migration
-- this session (bookkeeping_drafts.draft_type, etc.).
alter table public.compliance_items drop constraint if exists compliance_items_framework_check;
alter table public.compliance_items add constraint compliance_items_framework_check
  check (framework = any (array['dcb0129', 'dtac', 'dspt', 'mhra', 'wcag', 'insurance', 'safeguarding']));

insert into public.compliance_items (framework, item_code, status, notes) values
  ('insurance', 'professional-indemnity', 'not_started', 'No professional indemnity insurance on file yet. Standard NHS/institutional procurement requirement — see /admin/insurance.'),
  ('insurance', 'clinical-negligence', 'not_started', 'No clinical negligence insurance on file yet — see /admin/insurance.'),
  ('safeguarding', 'policy-published', 'complete', 'Flowen-authored safeguarding policy published — see /legal.'),
  ('safeguarding', 'concern-log-in-place', 'complete', 'Safeguarding concern log now available at /admin/safeguarding.')
on conflict do nothing;
