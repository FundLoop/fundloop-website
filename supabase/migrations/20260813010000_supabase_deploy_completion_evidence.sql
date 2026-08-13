CREATE TABLE public.supabase_deploy_completion_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_version text NOT NULL DEFAULT 'fundloop.deploy-completion-evidence/v1'
    CHECK (contract_version = 'fundloop.deploy-completion-evidence/v1'),
  candidate_git_sha text NOT NULL CHECK (candidate_git_sha ~ '^[0-9a-f]{40}$'),
  actions_run_id bigint NOT NULL CHECK (actions_run_id > 0),
  run_attempt integer NOT NULL CHECK (run_attempt > 0),
  deployment_environment text NOT NULL CHECK (deployment_environment IN ('dev', 'main')),
  project_ref text NOT NULL CHECK (project_ref ~ '^[a-z0-9]{20,}$'),
  inventory_sha256 text NOT NULL CHECK (inventory_sha256 ~ '^[0-9a-f]{64}$'),
  schema_expected_sha256 text NOT NULL CHECK (schema_expected_sha256 ~ '^[0-9a-f]{64}$'),
  schema_observed_sha256 text NOT NULL CHECK (
    schema_observed_sha256 ~ '^[0-9a-f]{64}$'
    AND schema_observed_sha256 = schema_expected_sha256
  ),
  function_inventory_sha256 text NOT NULL CHECK (function_inventory_sha256 ~ '^[0-9a-f]{64}$'),
  hosted_smoke_evidence_sha256 text NOT NULL CHECK (hosted_smoke_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  deployment_manifest_sha256 text NOT NULL CHECK (deployment_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (candidate_git_sha, actions_run_id, run_attempt, deployment_environment, project_ref),
  FOREIGN KEY (candidate_git_sha, actions_run_id, run_attempt, deployment_environment, project_ref)
    REFERENCES public.supabase_deploy_migration_evidence (
      candidate_git_sha, actions_run_id, run_attempt, deployment_environment, project_ref
    )
);

CREATE OR REPLACE FUNCTION public.validate_supabase_deploy_completion_evidence_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.supabase_deploy_migration_evidence candidate
    WHERE candidate.candidate_git_sha = NEW.candidate_git_sha
      AND candidate.actions_run_id = NEW.actions_run_id
      AND candidate.run_attempt = NEW.run_attempt
      AND candidate.deployment_environment = NEW.deployment_environment
      AND candidate.project_ref = NEW.project_ref
      AND candidate.inventory_sha256 = NEW.inventory_sha256
      AND candidate.recorded_at <= NEW.completed_at
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supabase_deploy_completion_candidate_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER supabase_deploy_completion_evidence_validate
BEFORE INSERT ON public.supabase_deploy_completion_evidence
FOR EACH ROW EXECUTE FUNCTION public.validate_supabase_deploy_completion_evidence_insert();

CREATE OR REPLACE FUNCTION public.reject_supabase_deploy_completion_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'supabase_deploy_completion_evidence_is_append_only';
END;
$$;

CREATE TRIGGER supabase_deploy_completion_evidence_append_only
BEFORE UPDATE OR DELETE ON public.supabase_deploy_completion_evidence
FOR EACH ROW EXECUTE FUNCTION public.reject_supabase_deploy_completion_evidence_mutation();

REVOKE ALL ON TABLE public.supabase_deploy_completion_evidence FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_supabase_deploy_completion_evidence_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_supabase_deploy_completion_evidence_mutation() FROM PUBLIC;
