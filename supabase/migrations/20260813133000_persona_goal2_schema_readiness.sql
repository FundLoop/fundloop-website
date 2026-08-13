-- Local persona readiness identity for the complete Goal 2 candidate schema.
-- This function is read-only and intentionally returns no row data or secrets.
CREATE FUNCTION public.persona_goal2_schema_readiness() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_feature text;
BEGIN
  FOREACH v_feature IN ARRAY ARRAY[
    'relation:user_onboarding_drafts',
    'relation:project_onboarding_drafts',
    'relation:profile_publication_consents',
    'relation:project_invitations',
    'relation:project_monthly_contribution_submissions',
    'relation:project_attribution_datasets',
    'relation:monthly_cycles',
    'relation:monthly_cycle_bookkeeping_credits',
    'relation:epoch_redistribution_pool_sources',
    'relation:monthly_cycle_report_artifacts',
    'relation:monthly_cycle_report_events',
    'function:lock_funded_epoch_allocation_v2(jsonb)',
    'function:record_funded_epoch_allocation_v2_once(jsonb)',
    'function:generate_monthly_cycle_reports(jsonb)',
    'function:publish_monthly_cycle_reports(jsonb)'
  ] LOOP
    IF (v_feature LIKE 'relation:%' AND pg_catalog.to_regclass('public.'||substring(v_feature FROM 10)) IS NULL)
      OR (v_feature LIKE 'function:%' AND pg_catalog.to_regprocedure('public.'||substring(v_feature FROM 10)) IS NULL)
    THEN v_missing:=array_append(v_missing,v_feature); END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_withdrawal_obligations' AND column_name='harvested_minor')
  THEN v_missing:=array_append(v_missing,'column:user_withdrawal_obligations.harvested_minor'); END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='epoch_allocation_manifests' AND column_name='selected_preview_hash')
  THEN v_missing:=array_append(v_missing,'column:epoch_allocation_manifests.selected_preview_hash'); END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='monthly_cycle_report_artifacts' AND column_name='artifact_hash')
  THEN v_missing:=array_append(v_missing,'column:monthly_cycle_report_artifacts.artifact_hash'); END IF;
  RETURN jsonb_build_object(
    'contractVersion','fundloop.persona-goal2-schema-readiness.v1',
    'migrationVersion','20260813133000',
    'featureCount',18,
    'missingFeatures',to_jsonb(v_missing),
    'ready',cardinality(v_missing)=0,
    'productionValueFlowEnabled',false
  );
END; $$;

REVOKE ALL ON FUNCTION public.persona_goal2_schema_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persona_goal2_schema_readiness() TO service_role;
