-- ── Marketing Intelligence schema ─────────────────────────────────────────────
-- Adds the five tables required for the Marketing Intelligence admin section.
-- Existing tables (marketing_attribution, visitor_sessions, waitlist_signups,
-- profiles, practice_sessions, subscriptions) are the source of truth and are
-- NOT modified here.

-- ── 1. ad_platform_stats ──────────────────────────────────────────────────────
-- Daily snapshot of ad-platform performance, one row per platform/date/campaign.
-- Populated by the /api/admin/marketing/sync endpoint. Meta first; architecture
-- supports Google and TikTok via the same schema.

CREATE TABLE IF NOT EXISTS public.ad_platform_stats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT        NOT NULL,                     -- 'meta' | 'google' | 'tiktok'
  stat_date       DATE        NOT NULL,
  campaign_id     TEXT,
  campaign_name   TEXT,
  adset_id        TEXT,
  adset_name      TEXT,
  ad_id           TEXT,
  ad_name         TEXT,
  creative_id     TEXT,
  spend_pence     INTEGER     NOT NULL DEFAULT 0,           -- spend in pence (£ × 100)
  impressions     INTEGER     NOT NULL DEFAULT 0,
  reach           INTEGER     NOT NULL DEFAULT 0,
  clicks          INTEGER     NOT NULL DEFAULT 0,           -- total clicks
  link_clicks     INTEGER     NOT NULL DEFAULT 0,           -- landing page clicks
  ctr             NUMERIC(8,4),                             -- %
  cpc_pence       INTEGER,                                  -- cost per click in pence
  cpm_pence       INTEGER,                                  -- cost per 1000 impressions in pence
  frequency       NUMERIC(6,3),
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, stat_date, COALESCE(campaign_id,''), COALESCE(adset_id,''), COALESCE(ad_id,''))
);

ALTER TABLE public.ad_platform_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_ad_stats" ON public.ad_platform_stats
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_ad_stats_platform_date ON public.ad_platform_stats (platform, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_stats_campaign      ON public.ad_platform_stats (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_stats_ad            ON public.ad_platform_stats (ad_id);

-- ── 2. social_platform_stats ──────────────────────────────────────────────────
-- Daily aggregate social metrics per platform.
-- One row per platform per day. Manually entered or API-synced.

CREATE TABLE IF NOT EXISTS public.social_platform_stats (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform          TEXT        NOT NULL,  -- 'instagram'|'facebook'|'tiktok'|'linkedin'|'youtube'|'x'
  stat_date         DATE        NOT NULL,
  followers         INTEGER,
  follower_delta    INTEGER,               -- day-over-day change
  reach             INTEGER,
  impressions       INTEGER,
  views             INTEGER,
  likes             INTEGER,
  comments          INTEGER,
  shares            INTEGER,
  saves             INTEGER,
  engagement_rate   NUMERIC(6,4),         -- %
  website_clicks    INTEGER,
  profile_visits    INTEGER,
  watch_time_secs   BIGINT,
  attributed_waitlist INTEGER DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, stat_date)
);

ALTER TABLE public.social_platform_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_social_stats" ON public.social_platform_stats
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_social_stats_platform_date ON public.social_platform_stats (platform, stat_date DESC);

-- ── 3. social_posts ───────────────────────────────────────────────────────────
-- Per-post tracking across platforms.

CREATE TABLE IF NOT EXISTS public.social_posts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform                TEXT        NOT NULL,
  post_id                 TEXT        NOT NULL,
  content_type            TEXT,       -- 'reel'|'post'|'story'|'video'|'carousel'|'short'
  hook                    TEXT,
  cta                     TEXT,
  campaign                TEXT,
  creator_type            TEXT,       -- 'founder'|'ugc'
  published_at            TIMESTAMPTZ,
  views                   INTEGER,
  reach                   INTEGER,
  impressions             INTEGER,
  likes                   INTEGER,
  comments                INTEGER,
  shares                  INTEGER,
  saves                   INTEGER,
  watch_time_secs         BIGINT,
  website_clicks          INTEGER,
  attributed_waitlist     INTEGER     DEFAULT 0,
  attributed_revenue_pence INTEGER    DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, post_id)
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_social_posts" ON public.social_posts
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_social_posts_platform_date ON public.social_posts (platform, published_at DESC);

-- ── 4. marketing_recommendations ──────────────────────────────────────────────
-- AI-generated marketing recommendations. Never automatically acted upon —
-- every external action requires explicit admin approval.

CREATE TABLE IF NOT EXISTS public.marketing_recommendations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  section             TEXT        NOT NULL,  -- 'paid_media'|'attribution'|'social'|'creative'|'general'
  finding             TEXT        NOT NULL,
  evidence            TEXT        NOT NULL,
  recommended_action  TEXT        NOT NULL,
  confidence          TEXT        NOT NULL CHECK (confidence IN ('high','medium','low')),
  risk                TEXT        NOT NULL,
  expected_impact     TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','executed','dismissed')),
  data_snapshot       JSONB,                 -- raw data used to generate the recommendation
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  approved_by         UUID        REFERENCES auth.users(id),
  rejected_at         TIMESTAMPTZ,
  rejected_by         UUID        REFERENCES auth.users(id),
  executed_at         TIMESTAMPTZ,
  execution_status    TEXT,
  dismissed_at        TIMESTAMPTZ
);

ALTER TABLE public.marketing_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_recommendations" ON public.marketing_recommendations
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_mkt_recs_status   ON public.marketing_recommendations (status, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_recs_section  ON public.marketing_recommendations (section);

-- ── 5. recommendation_actions ─────────────────────────────────────────────────
-- Immutable audit log: every approved execution is recorded here.
-- Never update rows — insert only.

CREATE TABLE IF NOT EXISTS public.recommendation_actions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID        NOT NULL REFERENCES public.marketing_recommendations(id),
  action              TEXT        NOT NULL,
  previous_value      JSONB,
  new_value           JSONB,
  evidence            TEXT,
  approved_by         UUID        REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_status    TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (execution_status IN ('pending','success','failed','skipped')),
  executed_at         TIMESTAMPTZ,
  error_detail        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_rec_actions" ON public.recommendation_actions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));
-- Insert only via service role (no direct user insert policy — written server-side only)

CREATE INDEX IF NOT EXISTS idx_rec_actions_rec_id ON public.recommendation_actions (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_actions_date   ON public.recommendation_actions (approved_at DESC);
