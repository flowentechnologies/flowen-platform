-- Campaign CRM: milestones, contacts (MPs/influencers/press), press links

CREATE TYPE campaign_contact_type AS ENUM ('mp', 'influencer', 'journalist', 'clinician', 'ngo');
CREATE TYPE campaign_outreach_status AS ENUM ('identified', 'contacted', 'responded', 'meeting_booked', 'supporting', 'declined');
CREATE TYPE campaign_milestone_status AS ENUM ('upcoming', 'in_progress', 'achieved', 'delayed');

CREATE TABLE campaign_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  target_date DATE,
  achieved_date DATE,
  status      campaign_milestone_status NOT NULL DEFAULT 'upcoming',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            campaign_contact_type NOT NULL,
  organisation    TEXT,
  constituency    TEXT,
  platform        TEXT,
  followers_count INT,
  email           TEXT,
  notes           TEXT,
  status          campaign_outreach_status NOT NULL DEFAULT 'identified',
  contacted_at    TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_press_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  publication    TEXT NOT NULL,
  url            TEXT,
  published_date DATE,
  sentiment      TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')) DEFAULT 'neutral',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: admin-only access via service role; no public access needed
ALTER TABLE campaign_milestones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_press_links ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so no policies needed for admin-only tables
-- Seed initial milestones
INSERT INTO campaign_milestones (title, description, category, target_date, status) VALUES
  ('1,000 waitlist signups',   'Early community validation milestone',          'growth',   '2026-09-01', 'in_progress'),
  ('Parliamentary petition live', 'Submit petition to Parliament for NHS SLP consideration', 'petition', '2026-10-01', 'upcoming'),
  ('10,000 petition signatures',  'Threshold for parliamentary debate consideration', 'petition', '2026-12-01', 'upcoming'),
  ('First NHS pilot agreement',   'LOI from one NHS trust for Flowen pilot programme',  'nhs',      '2027-03-01', 'upcoming'),
  ('100,000 petition signatures', 'Threshold for mandatory parliamentary response',     'petition', '2027-06-01', 'upcoming'),
  ('Founding cohort full (250)',   'All 250 founding member seats filled',               'growth',   '2026-11-01', 'upcoming'),
  ('First press feature',         'Major national publication feature on Flowen',        'press',    '2026-10-01', 'upcoming'),
  ('NHS SLP partnership',         'Formal partnership with NHS speech & language therapy board', 'nhs', '2027-09-01', 'upcoming');
