# Schema consolidation implementation, 30 September 2026

Status: executable patch prepared and tested in isolated PostgreSQL17.6. NOT applied to this branch's active migrations. NOT merged. No Production schema/data/history changes.

## Apply after review

From this branch checkout, inspect IMPLEMENTATION.patch, then run `git apply --check IMPLEMENTATION.patch`, `git apply IMPLEMENTATION.patch`, and `python3 scripts/verify-migration-baseline.py`. Commit the resulting changes into this PR for review before merging. The web upload process may prefix the evidence filenames; use the actual downloaded patch filename. No command here contacts Production.

## Design

- Archive all89 original local SQL files unchanged, including the52 unproved files. Keep all50 exact remote statement arrays as recovered SQL.
- Replace the active history with50 documented, non-replaying version markers, one for every recorded remote ID. They preserve version alignment, not historical SQL identity. This is an explicit squash/consolidation decision.
- Add one schema baseline after the50 remote IDs. Fresh Supabase databases build the captured public schema and custom auth triggers/storage policies. Matching existing schema is a no-op. Definition/RLS drift raises an exception rather than altering anything.
- No migration repair, remote history edits, manual rerun, reset, or Production push has been executed. Later ordinary deployment of the approved baseline would add its new history record, even if its schema path is a no-op. That later deployment needs its own gate.

## Verification

The schema-only Production dump captured public/auth/storage,426,910 bytes. It restored with zero SQL errors in PostgreSQL17.6 using real pgvector0.8.2 and pgcrypto1.3.840 public object blocks round-tripped with no semantic differences. Fresh schema baseline rebuild, repeat execution, matching-existing no-op and deliberate column-drift rejection passed. Fresh/restored definition fingerprint: `0cb654fe658b9376cddfa9eaae689042`.

Managed auth/storage definitions were used as fixtures. This was not a full Supabase services startup or a hosted Preview test. The branch's original red Preview check is NOT yet resolved because the patch has not been applied to active migrations.

## Remaining limits and deployment gates

1. Schema-only work deliberately exports no table rows. Seven historical INSERT/data effects remain unproved. Fresh environments may need separate reviewed seeds, storage bucket rows and service configuration. Do not call this a full application/data clone.
2. Fingerprint covers public definitions, indexes, constraints, functions, triggers, enums, RLS and storage policies; it does not gate ACL drift. Dump restore preserved captured ACLs. A live predeployment comparison must include grants/default privileges and extension versions, not rely on the fingerprint alone.
3. Supabase-managed auth/storage versions must match the captured fixtures before hosted execution; this isolation used exported fixtures, not vendor containers.
4. Recheck Production drift immediately before deployment. A dump is a point-in-time baseline. Confirm50 remote versions still match, ACLs and custom managed-schema objects still match, then obtain merge/deployment approval.
5. The earlier proved-reconciliation.patch is superseded as a candidate by this consolidation. Do not apply both patches.

## Provenance and access cleanup

Production project nfvvuzhahjaktujvlaqh, PostgreSQL17.6. Only schema was read. A project-scoped24-hour PAT and five-minute CLI login role were used. Both login roles were deleted, PAT was revoked and checked absent, temporary vault entries and secret scratch were removed. No Production password reset.

Sources: https://supabase.com/docs/reference/api/v1-create-login-role , https://supabase.com/docs/reference/api/v1-delete-login-roles , https://supabase.com/docs/reference/cli/supabase-db-dump
