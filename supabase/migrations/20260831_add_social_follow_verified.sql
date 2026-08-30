-- Track when a user verified they followed Flowen on social media.
-- Used by the onboarding checklist to gate the 15% billing discount.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS social_follow_verified_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_social_follow
  ON profiles (social_follow_verified_at)
  WHERE social_follow_verified_at IS NOT NULL;
