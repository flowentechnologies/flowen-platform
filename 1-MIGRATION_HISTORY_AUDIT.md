# Production migration history audit

Captured 2026-09-30 from project `nfvvuzhahjaktujvlaqh` using one read-only query:

```sql
select jsonb_agg(to_jsonb(m) order by version) as migration_history
from supabase_migrations.schema_migrations m;
```

## Status: blocked draft, not a deployment fix

The active migration directory is unchanged. Do not merge this as a completed repair or run a push/reset/repair from it. No remote metadata write is included.

## Findings

- 50 remote history records, all with stored SQL. 44 versions are missing locally.
- 89 local files, 33 version prefixes, 13 duplicate-prefix groups.
- 37 remote records match local SQL after removing line comments, folding whitespace/case and ignoring terminal semicolons. This is textual comparison, not a proof of runtime equivalence.
- 13 remote records differ or have no exact match.
- 52 local files lack an exact stored-SQL match, including combined/guarded versions of remote changes.
- Read-only catalog check found 111 public tables and 1270 columns. All 65 CREATE TABLE targets mentioned by the unmatched local files exist now. Table presence does not prove full SQL coverage, constraints, policies, data changes or grants.

Production migration history: https://supabase.com/dashboard/project/nfvvuzhahjaktujvlaqh/database/migrations
Failed check: https://github.com/flowentechnologies/flowen-platform/runs/109864963826

## Safe next phase

1. Preserve the captured history and take an independent backup before any mutation.
2. Compare local-only SQL against full live schema, policies, grants, functions, triggers and data effects. Do not label absent history entries unapplied.
3. Rebuild an isolated database and compare its schema against Production. Nothing here runs SQL.
4. Agree a baseline or timestamp reconciliation strategy in a separate reviewed implementation PR. Keep stored remote SQL and all known repo effects accounted for.
5. Only after review and explicit approval, make any narrowly scoped history repair. Reruns remain separately gated.

Avoid empty placeholder migrations, bulk reverted marks, or adding missing files while leaving duplicate local prefixes. They hide or reproduce drift.

## Remote-to-local map

| Remote version | Name | Exact normalized SQL match |
| --- | --- | --- |
| 20260724 | flowen_production_init | 20260724_flowen_production_init.sql |
| 20260725 | enterprise_production | 20260725_enterprise_production.sql |
| 20260725000000 | flowen_production_blueprint | 20260725000000_flowen_production_blueprint.sql |
| 20260727000000 | init_flowen | 20260727000000_init_flowen.sql |
| 20260728 | security_policies | 20260728_security_policies.sql |
| 20260729 | rls_onboarding | 20260729_rls_onboarding.sql |
| 20260901115633 | slp_session_notes_patient | 20260901_slp_session_notes_patient.sql |
| 20260901122620 | 20260901_id_verified_default_true | No exact match |
| 20260901212422 | assets_bucket_allow_favicon_mime | No exact match |
| 20260902182951 | create_social_publish_queue | No exact match |
| 20260902183008 | social_publish_queue_rls | No exact match |
| 20260903185240 | extend_social_queue_pinterest_snapchat | 20260903_pinterest_snapchat_social.sql |
| 20260903231800 | create_pitch_deck_private_bucket | 20260904_pitch_deck_bucket.sql |
| 20260905100512 | gmail_inbox_crm_notifications | 20260905_gmail_inbox_crm_notifications.sql |
| 20260905112617 | inbox_gmail_category | 20260905_inbox_gmail_category.sql |
| 20260905150330 | inbox_crm_notifications_v2 | 20260905_inbox_crm_notifications_v2.sql |
| 20260905160223 | cross_system_consistency_checks | 20260905_cross_system_consistency_checks.sql |
| 20260905171451 | ad_platform_stats_unique_constraint | 20260905_ad_platform_stats_unique_constraint.sql |
| 20260907022249 | move_vector_extension_out_of_public_schema | 20260907_move_vector_extension_out_of_public.sql |
| 20260907114948 | slp_notifications | No exact match |
| 20260907115059 | fix_slp_notification_separator_encoding | No exact match |
| 20260907122740 | explee_hot_leads | 20260907_explee_hot_leads.sql |
| 20260907124234 | explee_outreach_sync | 20260907_explee_outreach_sync.sql |
| 20260907135004 | revoke_public_execute_on_slp_notification_triggers | 20260907_revoke_slp_notification_trigger_rpc.sql |
| 20260907135659 | ad_platform_stats_unique_key | 20260907_ad_platform_stats_unique_key.sql |
| 20260907204327 | crm_contacts_add_clinician_lead_category | No exact match |
| 20260907204332 | drop_unused_slp_beta_applications | No exact match |
| 20260908120923 | admin_action_items | 20260908_admin_action_items.sql |
| 20260908231628 | deck_invite_variant | 20260909_deck_invite_variant.sql |
| 20260911142253 | crm_stage_auto_managed | 20260911_crm_stage_auto_managed.sql |
| 20260913124756 | explee_contact_enrichment | 20260913_explee_contact_enrichment.sql |
| 20260913133509 | explee_prospecting | 20260913_explee_prospecting.sql |
| 20260913152620 | explee_dedup_lists | 20260913_explee_dedup_lists.sql |
| 20260913152647 | explee_searches_excluded_total | No exact match |
| 20260913193411 | deploy_log_changelog_items | 20260913_deploy_log_changelog_items.sql |
| 20260914123434 | cal_com_bookings | 20260914_cal_com_bookings.sql |
| 20260916134009 | xero_bookkeeping | 20260916_xero_bookkeeping.sql |
| 20260916183748 | r2_session_recordings | 20260916_r2_session_recordings.sql |
| 20260918004056 | enable_rls_missing_tables | No exact match |
| 20260918004403 | revoke_direct_execute_slp_trigger_functions | No exact match |
| 20260918004434 | revoke_public_execute_slp_trigger_functions | No exact match |
| 20260924232920 | xero_multi_entity | 20260925_xero_multi_entity.sql |
| 20260925022233 | dla_journal_draft_type | 20260925_dla_journal_draft_type.sql |
| 20260925185516 | share_capital_setoff_draft_type | 20260925_share_capital_setoff_draft_type.sql |
| 20260925190848 | audit_perf_fixes | 20260925_audit_perf_fixes.sql |
| 20260926004320 | session_recording_retention | 20260926_session_recording_retention.sql |
| 20260926150422 | governance_registers | 20260926_governance_registers.sql |
| 20260926182314 | seis_eis_and_company_records | 20260926_seis_eis_and_company_records.sql |
| 20260929202036 | consent_records_and_conversion_milestones | 20260929213000_consent_milestones.sql |
| 20260929203836 | consent_records_identity_check | No exact match |

## Local files needing coverage review

- `20260729_audit_logs_and_webhook_idempotency.sql`
- `20260729_fix_app_brand_type.sql`
- `20260729_gdpr_telemetry_opt_out_default.sql`
- `20260730_assets.sql`
- `20260730_campaign_crm.sql`
- `20260730_cron.sql`
- `20260730_data_room.sql`
- `20260730_hazard_log.sql`
- `20260730_integrations.sql`
- `20260730_staff.sql`
- `20260730_tickets.sql`
- `20260730_tracking.sql`
- `20260730_venture_compliance_pitch.sql`
- `20260730_workflow_run_count.sql`
- `20260730_workflows.sql`
- `20260731_alert_rules.sql`
- `20260731_audit_log.sql`
- `20260731_cap_table.sql`
- `20260731_feature_flags.sql`
- `20260731_grants.sql`
- `20260731_investor_updates.sql`
- `20260731_ip_register.sql`
- `20260731_nhs_pipeline.sql`
- `20260731_notification_log.sql`
- `20260731_notification_prefs.sql`
- `20260731_roadmap.sql`
- `20260731_runway_config.sql`
- `20260731_slp_assignments.sql`
- `20260731_slp_messages.sql`
- `20260731_treatment_plans.sql`
- `20260731_user_programme.sql`
- `20260731_waitlist_invitations.sql`
- `20260802_analytics_visitor_tracking.sql`
- `20260807_affiliate.sql`
- `20260807_ip_readiness.sql`
- `20260807_valuation.sql`
- `20260808_add_transcript_to_practice_sessions.sql`
- `20260811_stage_progressions.sql`
- `20260812_ip_readiness_security_and_constraints.sql`
- `20260820_deploy_log.sql`
- `20260821_daily_backups.sql`
- `20260821_fix_security_definer_execute_grants.sql`
- `20260821_security_perf_fixes.sql`
- `20260821_slp_messages_realtime.sql`
- `20260831_add_social_follow_verified.sql`
- `20260831_revoke_get_user_id_by_email_authenticated.sql`
- `20260901_marketing_intelligence.sql`
- `20260902_social_publish_queue.sql`
- `20260907_retire_slp_beta_applications.sql`
- `20260907_slp_notifications.sql`
- `20260929213100_consent_identity_check.sql`
- `20260929_vendor_dla_draft_type.sql`

## Known non-exact mappings

- `20260929203836`: direct consent identity ALTER TABLE; local consent identity migration uses a pg_constraint guard.
- `20260902182951` + `20260902183008`: split creation/RLS history; local social queue file combines these and omits remote table comment.
- `20260907204327` + `20260907204332`: separate CRM category and table retirement; local retirement file combines them.
- `20260907114948` + `20260907115059`: original notification function has a literal escaped separator, followed by a fix. Local notification file reflects a different combined state. Compare carefully.

Export only includes version, name and executable SQL (line comments removed). Author/rollback/idempotency metadata and unrelated project or account metadata are deliberately omitted.
