CREATE TABLE IF NOT EXISTS tracking_providers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key     TEXT        UNIQUE NOT NULL,
  label            TEXT        NOT NULL,
  icon             TEXT        NOT NULL DEFAULT '📊',
  description      TEXT        NOT NULL DEFAULT '',
  enabled          BOOLEAN     NOT NULL DEFAULT false,
  consent_required BOOLEAN     NOT NULL DEFAULT true,
  pixel_id         TEXT,
  head_html        TEXT,
  body_html        TEXT,
  server_config    JSONB       NOT NULL DEFAULT '{}',
  sort_order       INT         NOT NULL DEFAULT 99,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tracking_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_tracking" ON tracking_providers
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

INSERT INTO tracking_providers (provider_key, label, icon, description, sort_order) VALUES
  ('gtm',      'Google Tag Manager',   '📦', 'One container to rule all tags. Manage every pixel from a single GTM workspace.', 1),
  ('ga4',      'Google Analytics 4',   '📈', 'Session, event, and conversion analytics via GA4.', 2),
  ('meta',     'Meta Pixel',           '🎯', 'Facebook and Instagram ad conversion tracking and custom audiences.', 3),
  ('tiktok',   'TikTok Pixel',         '🎵', 'TikTok for Business ad events and audience building.', 4),
  ('linkedin', 'LinkedIn Insight Tag', '💼', 'LinkedIn ad conversions and demographic retargeting.', 5),
  ('twitter',  'Twitter/X Pixel',      '𝕏',  'Twitter/X ad conversion events and remarketing lists.', 6),
  ('hotjar',   'Hotjar',               '🔥', 'Session recordings, heatmaps, and user feedback.', 7),
  ('clarity',  'Microsoft Clarity',    '🔍', 'Free heatmaps and session recordings from Microsoft.', 8),
  ('custom',   'Custom Script',        '⚙️', 'Paste arbitrary head or body HTML — any pixel, tag, or script.', 99)
ON CONFLICT (provider_key) DO NOTHING;
