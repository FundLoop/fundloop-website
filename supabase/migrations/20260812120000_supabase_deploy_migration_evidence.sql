CREATE TABLE IF NOT EXISTS public.supabase_deploy_migration_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_version text NOT NULL DEFAULT 'fundloop.migration-deploy-evidence/v1' CHECK (contract_version = 'fundloop.migration-deploy-evidence/v1'),
  candidate_git_sha text NOT NULL CHECK (candidate_git_sha ~ '^[0-9a-f]{40}$'),
  actions_run_id bigint NOT NULL CHECK (actions_run_id > 0),
  run_attempt integer NOT NULL CHECK (run_attempt > 0),
  deployment_environment text NOT NULL CHECK (deployment_environment IN ('dev', 'main')),
  project_ref text NOT NULL CHECK (project_ref ~ '^[a-z0-9]{20,}$'),
  migration_inventory jsonb NOT NULL CHECK (jsonb_typeof(migration_inventory) = 'array'),
  inventory_sha256 text NOT NULL CHECK (inventory_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (candidate_git_sha, actions_run_id, run_attempt, deployment_environment, project_ref)
);

CREATE OR REPLACE FUNCTION public.reject_supabase_deploy_migration_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supabase_deploy_migration_evidence_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS supabase_deploy_migration_evidence_append_only
  ON public.supabase_deploy_migration_evidence;
CREATE TRIGGER supabase_deploy_migration_evidence_append_only
BEFORE UPDATE OR DELETE ON public.supabase_deploy_migration_evidence
FOR EACH ROW EXECUTE FUNCTION public.reject_supabase_deploy_migration_evidence_mutation();

REVOKE ALL ON TABLE public.supabase_deploy_migration_evidence FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supabase_deploy_migration_evidence_mutation() FROM PUBLIC;
