# Reconciliation review - 30 September 2026

## Blocked: audit complete enough to reject a blind history repair, implementation not complete

No active migration files, Production schema, history rows or application data were changed. The proposed patch is non-executing evidence, not an approved migration set.

The full 50-record history export is retained. The proposal restores 31 exact local SQL files to their recorded remote versions and recovers 13 remote SQL files, leaving 6 already matching versions unchanged. All 50 remote SQL bodies are represented in the proposal. All 58 other existing files are byte-for-byte unchanged. This still leaves 7 duplicate prefix groups. Do not apply the patch as a finished baseline.

## Live comparison

Read-only catalog queries inspected public columns, constraints, policies, indexes, functions, triggers, grants, enum labels and publication membership. `schema-effect-comparison-2026-09-30.json` inventories all 52 unmatched files, with 310 parsed SQL statements across 50 files and parse errors in the remaining 2. Object presence and textual expression evidence are recorded without claiming historical application. Data mutations and procedural bodies remain explicitly unproved. No customer rows, secret values or credentials are included.

### Proved non-equivalence / rebuild blockers

- `20260901_marketing_intelligence.sql`: invalid table UNIQUE constraint containing COALESCE expressions. A unique expression index is a different statement; do not silently rewrite or run the original file.
- `20260812_ip_readiness_security_and_constraints.sql`: unsupported `ADD CONSTRAINT IF NOT EXISTS` syntax. A catalog guard requires a reviewed rewrite.
- `20260731_cap_table.sql`: live shares, amount_pence and valuation_cap_pence are bigint; local file specifies integer.
- `20260807_valuation.sql`: live Berkus amounts and nhs_price_per_patient_pence are integer; local file specifies bigint.
- `20260811_stage_progressions.sql`: live from_week/to_week are smallint; local file specifies integer.
- `20260731_slp_assignments.sql`: live slp_session_notes.session_id is nullable; local file specifies NOT NULL.

Other missing/superseded policies and indexes are listed per statement. They are not instructions to recreate old grants or policies. Current state can reflect subsequent security fixes; old policy names alone cannot establish the original migration was applied.

## Safe complete implementation still requires

1. An independent schema-only dump and isolated PostgreSQL/Supabase restore, including auth/storage dependencies, extensions, grants and publications.
2. A reviewed canonical Production baseline, with historical local SQL preserved outside the active migration directory rather than replayed.
3. Explicit decisions for the material type/nullability differences and invalid local SQL. Use Production as the initial baseline without pretending these files were applied exactly.
4. Seed/data effects checked separately. Current data does not prove historical execution, and a baseline must not replay old seed inserts into Production.
5. A fresh rebuild and schema comparison before presenting an executable migration PR. Merge remains a separate decision; no remote metadata repair or check rerun is included here.

The available catalog exports do not by themselves produce a complete restorable Supabase schema dump. Claiming a complete baseline or green Preview now would be wrong. The draft contains the proved proposal plus the unresolved differences so the next step can be chosen with evidence.
