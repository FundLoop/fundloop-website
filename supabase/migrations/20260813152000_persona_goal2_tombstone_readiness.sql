-- Advance the local Goal 2 readiness identity only after the tombstone-aware
-- report artifact invariant exists. This prevents a stale schema from passing
-- persona readiness while published-report erasure would still fail.

CREATE OR REPLACE FUNCTION public.persona_goal2_schema_readiness() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_missing text[]:=ARRAY[]::text[];
  v_feature text;
  v_constraint_definition text;
BEGIN
  FOREACH v_feature IN ARRAY ARRAY[
    'relation:user_onboarding_drafts','relation:project_onboarding_drafts','relation:profile_publication_consents',
    'relation:project_invitations','relation:project_monthly_contribution_submissions','relation:project_attribution_datasets',
    'relation:monthly_cycles','relation:monthly_cycle_bookkeeping_credits','relation:epoch_redistribution_pool_sources',
    'relation:monthly_cycle_report_artifacts','relation:monthly_cycle_report_events',
    'function:lock_funded_epoch_allocation_v2(jsonb)','function:record_funded_epoch_allocation_v2_once(jsonb)',
    'function:generate_monthly_cycle_reports(jsonb)','function:publish_monthly_cycle_reports(jsonb)',
    'function:regenerate_monthly_cycle_reports(jsonb)','function:prepare_monthly_cycle_report_publication(jsonb)',
    'function:finalize_monthly_cycle_report_publication(jsonb)','function:record_monthly_report_publication_failure(jsonb)',
    'function:prepare_monthly_cycle_report_tombstone(jsonb)','function:finalize_monthly_cycle_report_tombstone(jsonb)',
    'function:monthly_cycle_report_path_token(bigint)'
  ] LOOP
    IF (v_feature LIKE 'relation:%' AND pg_catalog.to_regclass('public.'||substring(v_feature FROM 10)) IS NULL)
      OR (v_feature LIKE 'function:%' AND pg_catalog.to_regprocedure('public.'||substring(v_feature FROM 10)) IS NULL)
    THEN v_missing:=array_append(v_missing,v_feature);END IF;
  END LOOP;

  FOREACH v_feature IN ARRAY ARRAY[
    'user_withdrawal_obligations.harvested_minor','epoch_allocation_manifests.selected_preview_hash',
    'monthly_cycle_report_artifacts.artifact_hash','monthly_cycle_report_artifacts.artifact_bytes',
    'monthly_cycle_report_artifacts.artifact_path','monthly_cycle_report_artifacts.path_token',
    'monthly_cycle_report_artifacts.storage_verified_at','monthly_cycle_report_artifacts.storage_verified_hash',
    'monthly_cycle_report_artifacts.regeneration_key','monthly_cycle_report_artifacts.supersedes_id',
    'monthly_cycle_report_artifacts.subject_evidence_hash','monthly_cycle_reports.report_version','monthly_cycle_reports.report_artifact_id'
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=split_part(v_feature,'.',1) AND column_name=split_part(v_feature,'.',2))
    THEN v_missing:=array_append(v_missing,'column:'||v_feature);END IF;
  END LOOP;

  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_constraint_definition
  FROM pg_catalog.pg_constraint constraint_row
  JOIN pg_catalog.pg_class table_row ON table_row.oid=constraint_row.conrelid
  JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid=table_row.relnamespace
  WHERE schema_row.nspname='public'
    AND table_row.relname='monthly_cycle_reports'
    AND constraint_row.conname='monthly_cycle_reports_artifact_pair_check';

  IF v_constraint_definition IS NULL
    OR position('tombstoned' IN v_constraint_definition)=0
    OR position('report_artifact_id' IN v_constraint_definition)=0
    OR position('artifact_hash' IN v_constraint_definition)=0
  THEN
    v_missing:=array_append(v_missing,'constraint:monthly_cycle_reports_artifact_pair_check');
  END IF;

  RETURN jsonb_build_object(
    'contractVersion','fundloop.persona-goal2-schema-readiness.v3',
    'migrationVersion','20260813152000',
    'featureCount',36,
    'missingFeatures',to_jsonb(v_missing),
    'ready',cardinality(v_missing)=0,
    'productionValueFlowEnabled',false
  );
END;$$;

REVOKE ALL ON FUNCTION public.persona_goal2_schema_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persona_goal2_schema_readiness() TO service_role;
