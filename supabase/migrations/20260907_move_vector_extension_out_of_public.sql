-- Move the vector extension out of the public schema, per the Supabase
-- security linter (extension_in_public). Found during a readiness audit.
--
-- pg_net could NOT be moved in the same pass — Postgres rejects it
-- ("extension pg_net does not support SET SCHEMA"), which appears to be a
-- hard constraint from how Supabase provisions it (its functions already
-- live in their own `net` schema regardless of the extension's nominal
-- schema, so the public-schema listing for pg_net is largely cosmetic and
-- not user-relocatable).
--
-- vector's type is used by telemetry_logs.acoustic_embedding; Supabase's
-- default search_path includes `extensions`, so unqualified references
-- continue to resolve correctly after this move. Verified live: the
-- column's udt_name still reads 'vector' immediately after applying this.
create schema if not exists extensions;
alter extension vector set schema extensions;
