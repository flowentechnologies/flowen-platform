-- Both marketing-sync routes (meta and google-ads) have upserted against
-- onConflict: 'platform,stat_date,campaign_id,adset_id,ad_id' since they
-- were written, but the constraint that ON CONFLICT needs was never
-- actually created — every upsert call failed with "no unique or
-- exclusion constraint matching the ON CONFLICT specification" (confirmed
-- in production logs and cron_runs). Both routes always fetch at ad-level
-- (Meta: level='ad'; Google: adGroupAd.ad.id), so campaign_id/adset_id/
-- ad_id are consistently non-null in real rows from either source —
-- verified no existing duplicate groups before adding this.
alter table ad_platform_stats
  add constraint ad_platform_stats_unique_key
  unique (platform, stat_date, campaign_id, adset_id, ad_id);
