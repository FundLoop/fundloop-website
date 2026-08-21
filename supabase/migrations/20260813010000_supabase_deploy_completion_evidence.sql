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
  deployment_manifest jsonb NOT NULL CHECK (jsonb_typeof(deployment_manifest) = 'object'),
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
  IF NEW.deployment_manifest ->> 'contractVersion' IS DISTINCT FROM 'fundloop.environment-delivery-manifest/v1'
    OR NEW.deployment_manifest #>> '{observation,mode}' IS DISTINCT FROM 'deploy'
    OR NEW.deployment_manifest #>> '{observation,gitSha}' IS DISTINCT FROM NEW.candidate_git_sha
    OR NEW.deployment_manifest #>> '{observation,githubRunId}' IS DISTINCT FROM NEW.actions_run_id::text
    OR (NEW.deployment_manifest #>> '{observation,githubRunAttempt}')::integer IS DISTINCT FROM NEW.run_attempt
    OR NEW.deployment_manifest ->> 'environment' IS DISTINCT FROM NEW.deployment_environment
    OR NEW.deployment_manifest ->> 'projectRef' IS DISTINCT FROM NEW.project_ref
    OR NEW.deployment_manifest #>> '{migrations,inventorySha256}' IS DISTINCT FROM NEW.inventory_sha256
    OR NEW.deployment_manifest #>> '{schema,expectedSha256}' IS DISTINCT FROM NEW.schema_expected_sha256
    OR NEW.deployment_manifest #>> '{schema,observedSha256}' IS DISTINCT FROM NEW.schema_observed_sha256
    OR NEW.deployment_manifest #>> '{functions,inventorySha256}' IS DISTINCT FROM NEW.function_inventory_sha256
    OR NEW.deployment_manifest #>> '{prerequisites,hostedUnauthenticatedDenial,evidence,evidenceSha256}' IS DISTINCT FROM NEW.hosted_smoke_evidence_sha256
    OR NEW.deployment_manifest ->> 'manifestSha256' IS DISTINCT FROM NEW.deployment_manifest_sha256
    OR NEW.deployment_manifest #>> '{observation,observedAt}' IS NULL
    OR (NEW.deployment_manifest #>> '{observation,observedAt}')::timestamptz > NEW.completed_at
    OR NEW.deployment_manifest #>> '{schema,observedAt}' IS NULL
    OR (NEW.deployment_manifest #>> '{schema,observedAt}')::timestamptz > NEW.completed_at
    OR NEW.deployment_manifest #>> '{functions,observedAt}' IS NULL
    OR (NEW.deployment_manifest #>> '{functions,observedAt}')::timestamptz > NEW.completed_at
    OR NEW.deployment_manifest #>> '{prerequisites,hostedUnauthenticatedDenial,evidence,observedAt}' IS NULL
    OR (NEW.deployment_manifest #>> '{prerequisites,hostedUnauthenticatedDenial,evidence,observedAt}')::timestamptz > NEW.completed_at
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'supabase_deploy_completion_manifest_mismatch';
  END IF;
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
