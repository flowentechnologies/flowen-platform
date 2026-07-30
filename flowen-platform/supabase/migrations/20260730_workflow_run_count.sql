-- Atomic increment of workflow run count and last_run_at, called from the API
-- to avoid TOCTOU race conditions on concurrent triggers.
CREATE OR REPLACE FUNCTION increment_workflow_run_count(wf_id UUID, ran_at TIMESTAMPTZ)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE workflow_definitions
  SET
    run_count  = run_count + 1,
    last_run_at = ran_at,
    updated_at  = ran_at
  WHERE id = wf_id;
$$;

REVOKE ALL ON FUNCTION increment_workflow_run_count(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_workflow_run_count(UUID, TIMESTAMPTZ) TO service_role;
