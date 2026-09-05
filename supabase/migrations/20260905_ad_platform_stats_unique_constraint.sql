-- Both marketing sync routes (Meta, Google Ads) upsert with
-- onConflict: 'platform,stat_date,campaign_id,adset_id,ad_id', but no
-- unique constraint matching those columns has ever existed on this
-- table — every upsert has been silently failing (Postgres errors on
-- an onConflict target with no matching unique constraint/index), which
-- is the actual final reason ad_platform_stats stayed empty even after
-- fixing the Meta API request itself. Nullable columns (campaign_id
-- etc. can be null at account-level rows) are fine here: Postgres
-- treats each NULL as distinct, so this only dedupes rows where every
-- one of these columns is actually populated and identical, matching
-- the ad-level data these routes actually sync.
create unique index if not exists ad_platform_stats_unique_row
  on ad_platform_stats (platform, stat_date, campaign_id, adset_id, ad_id);
