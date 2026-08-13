-- Deterministic, audience-scoped monthly report generation and publication.

ALTER TYPE public.monthly_cycle_report_audience ADD VALUE IF NOT EXISTS 'mcp';

ALTER TABLE public.monthly_cycle_reports DROP CONSTRAINT monthly_cycle_reports_subject_check;
ALTER TABLE public.monthly_cycle_reports ADD CONSTRAINT monthly_cycle_reports_subject_check CHECK(
  (audience IN('public','operator','mcp') AND subject_user_id IS NULL AND subject_project_id IS NULL)
  OR (audience='user' AND subject_user_id IS NOT NULL AND subject_project_id IS NULL)
  OR (audience='founder' AND subject_user_id IS NULL AND subject_project_id IS NOT NULL));
CREATE UNIQUE INDEX idx_monthly_cycle_reports_mcp_once ON public.monthly_cycle_reports(monthly_cycle_id,audience)
WHERE audience='mcp';

CREATE TABLE public.monthly_cycle_report_artifacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  close_package_id bigint NOT NULL REFERENCES public.epoch_close_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  audience public.monthly_cycle_report_audience NOT NULL,
  subject_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  subject_project_id bigint REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  artifact jsonb NOT NULL,
  artifact_hash text NOT NULL,
  state text NOT NULL DEFAULT 'generated',
  retention_expires_at timestamptz NOT NULL,
  superseded_by_id bigint REFERENCES public.monthly_cycle_report_artifacts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  generated_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  tombstoned_at timestamptz,
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT monthly_report_artifact_subject CHECK(
    (audience IN('public','operator','mcp') AND subject_user_id IS NULL AND subject_project_id IS NULL)
    OR (audience='user' AND subject_user_id IS NOT NULL AND subject_project_id IS NULL)
    OR (audience='founder' AND subject_user_id IS NULL AND subject_project_id IS NOT NULL)),
  CONSTRAINT monthly_report_artifact_hash CHECK(artifact_hash~'^[0-9a-f]{64}$'),
  CONSTRAINT monthly_report_artifact_state CHECK(state IN('generated','published','superseded','tombstoned')),
  CONSTRAINT monthly_report_artifact_retention CHECK(retention_expires_at>generated_at),
  CONSTRAINT monthly_report_artifact_production_closed CHECK(production_enabled=false),
  UNIQUE(close_package_id,audience,subject_user_id,subject_project_id,version)
);
CREATE UNIQUE INDEX monthly_report_artifact_global_once ON public.monthly_cycle_report_artifacts(close_package_id,audience,version)
WHERE audience IN('public','operator','mcp');
CREATE UNIQUE INDEX monthly_report_artifact_user_once ON public.monthly_cycle_report_artifacts(close_package_id,subject_user_id,version)
WHERE audience='user';
CREATE UNIQUE INDEX monthly_report_artifact_project_once ON public.monthly_cycle_report_artifacts(close_package_id,subject_project_id,version)
WHERE audience='founder';

CREATE TABLE public.monthly_cycle_report_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artifact_id bigint NOT NULL REFERENCES public.monthly_cycle_report_artifacts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN('generated','published','superseded','tombstoned','regenerated')),
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL CHECK(evidence_hash~'^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION public.reject_monthly_report_event_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'monthly_report_events_are_append_only'; END; $$;
CREATE TRIGGER monthly_report_events_append_only BEFORE UPDATE OR DELETE ON public.monthly_cycle_report_events
FOR EACH ROW EXECUTE FUNCTION public.reject_monthly_report_event_mutation();

CREATE FUNCTION public.generate_monthly_cycle_reports(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_close public.epoch_close_packages%ROWTYPE;
  v_cycle public.monthly_cycles%ROWTYPE;v_actor uuid:=(p_command->>'actorUserId')::uuid;v_retention timestamptz;
  v_common jsonb;v_row record;v_artifact jsonb;v_hash text;v_id bigint;v_created integer:=0;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_generate.v1' OR v_environment NOT IN('local','dev','test','preview')
    OR v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=v_actor) THEN
    RAISE EXCEPTION 'monthly_report_generation_runtime_disabled';END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint FOR SHARE;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id=v_close.monthly_cycle_id;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash !~ '^[0-9a-f]{64}$'
    OR v_close.status NOT IN('root_review_required','payout_readying') THEN RAISE EXCEPTION 'monthly_report_close_unavailable';END IF;
  v_retention:=clock_timestamp()+interval '7 years';
  v_common:=jsonb_build_object('schemaVersion',1,'cycleKey',v_cycle.cycle_key,'closePackageId',v_close.id,
    'policyKey',v_close.policy_key,'manifestHash',v_close.manifest_hash,'resultHash',v_close.result_hash,'rootHash',v_close.root_hash,
    'status',v_close.status,'productionValueFlowEnabled',false,
    'explanation',jsonb_build_object('inputs','approved close package and immutable source manifests',
      'attribution','eligible cohort and locked attribution evidence','uniqueness','one audience artifact per subject and version',
      'feesFx','exact source-linked FX and fee dispositions','allocation','full initial claims plus cap-limited redistribution top-ups',
      'claimsExpiryRollover','withdrawal claims remain protected until expiry; unclaimed value follows the E-3 rule',
      'exceptions','close exceptions and reconciliation remain operator-visible','reconciliation','artifact hashes bind to the close root'));
  FOR v_row IN
    SELECT 'public'::public.monthly_cycle_report_audience audience,NULL::uuid user_id,NULL::bigint project_id,
      v_common||jsonb_build_object('audience','public','totals',jsonb_build_object('fundedMinor',v_close.funded_minor::text,
        'finalAllocationMinor',v_close.final_allocation_minor::text,'returnedResidueMinor',v_close.returned_residue_minor::text)) artifact
    UNION ALL SELECT 'operator',NULL,NULL,v_common||jsonb_build_object('audience','operator','closeArtifacts',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('key',artifact_key,'hash',artifact_hash) ORDER BY artifact_key),'[]')
       FROM public.epoch_close_artifacts WHERE close_package_id=v_close.id))
    UNION ALL SELECT 'mcp',NULL,NULL,v_common||jsonb_build_object('audience','mcp','workflow','monthly_reporting.read',
      'scopes',jsonb_build_array('public','authorized_user','authorized_founder','operator'))
    UNION ALL SELECT 'user',control.user_id,NULL,v_common||jsonb_build_object('audience','user','subjectUserId',control.user_id,
      'award',jsonb_build_object('initialClaimMinor',control.initial_claim_minor::text,'topUpMinor',control.redistribution_top_up_minor::text,
        'finalAwardMinor',control.final_award_minor::text,'expiryCycleId',obligation.source_expires_after_cycle_id))
      FROM public.epoch_provisional_award_controls control
      LEFT JOIN public.user_withdrawal_obligations obligation ON obligation.source_award_control_id=control.id
      WHERE control.approval_id=v_close.approval_id
    UNION ALL SELECT 'founder',NULL,summary.project_id,v_common||jsonb_build_object('audience','founder','subjectProjectId',summary.project_id,
      'project',jsonb_build_object('fundedMinor',summary.funded_minor::text,'cohortCount',summary.cohort_count,
        'sourceCount',summary.source_count,'initialClaimExactUsd',summary.initial_claim_exact_usd::text,
        'scorePoolContributionExactUsd',summary.score_pool_contribution_exact_usd::text))
      FROM public.epoch_close_project_summaries summary WHERE summary.approval_id=v_close.approval_id
  LOOP
    v_artifact:=v_row.artifact;v_hash:=encode(extensions.digest(pg_catalog.convert_to(v_artifact::text,'UTF8'),'sha256'),'hex');
    INSERT INTO public.monthly_cycle_report_artifacts(close_package_id,monthly_cycle_id,audience,subject_user_id,subject_project_id,
      artifact,artifact_hash,retention_expires_at,generated_by_user_id)
    VALUES(v_close.id,v_close.monthly_cycle_id,v_row.audience,v_row.user_id,v_row.project_id,v_artifact,v_hash,v_retention,v_actor)
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
      INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash)
      VALUES(v_id,'generated',v_actor,v_hash);v_created:=v_created+1;
    END IF;v_id:=NULL;
  END LOOP;
  RETURN jsonb_build_object('closePackageId',v_close.id,'createdCount',v_created,'artifactCount',
    (SELECT count(*) FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=1),
    'rootHash',v_close.root_hash,'productionValueFlowEnabled',false);
END; $$;

CREATE FUNCTION public.publish_monthly_cycle_reports(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_close public.epoch_close_packages%ROWTYPE;
  v_actor uuid:=(p_command->>'actorUserId')::uuid;v_expected integer;v_actual integer;v_row record;v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_publish.v1' OR v_environment NOT IN('local','dev','test','preview')
    OR v_actor IS NULL THEN RAISE EXCEPTION 'monthly_report_publication_runtime_disabled';END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint FOR UPDATE;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash<>p_command->>'rootHash' THEN
    RAISE EXCEPTION 'monthly_report_publication_close_mismatch';END IF;
  SELECT 3+(SELECT count(*) FROM public.epoch_provisional_award_controls WHERE approval_id=v_close.approval_id)
    +(SELECT count(*) FROM public.epoch_close_project_summaries WHERE approval_id=v_close.approval_id) INTO v_expected;
  SELECT count(*) INTO v_actual FROM public.monthly_cycle_report_artifacts artifact
  WHERE artifact.close_package_id=v_close.id AND artifact.version=1 AND artifact.state IN('generated','published')
    AND artifact.artifact_hash=encode(extensions.digest(pg_catalog.convert_to(artifact.artifact::text,'UTF8'),'sha256'),'hex')
    AND artifact.production_enabled=false;
  IF v_actual<>v_expected THEN RAISE EXCEPTION 'monthly_report_publication_incomplete';END IF;
  FOR v_row IN SELECT * FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=1 ORDER BY id FOR UPDATE LOOP
    INSERT INTO public.monthly_cycle_reports(monthly_cycle_id,audience,subject_user_id,subject_project_id,title,summary,
      artifact_path,artifact_mime_type,artifact_hash,payload,published_at,created_by_user_id,updated_by_user_id)
    VALUES(v_row.monthly_cycle_id,v_row.audience,v_row.subject_user_id,v_row.subject_project_id,
      (v_row.artifact->>'cycleKey')||' '||v_row.audience::text||' report','Generated from approved close '||v_close.id,
      'artifacts/'||v_close.id||'/'||v_row.audience::text||'/'||coalesce(v_row.subject_user_id::text,v_row.subject_project_id::text,'global')||'.json',
      'application/json',v_row.artifact_hash,v_row.artifact,v_now,v_actor,v_actor) ON CONFLICT DO NOTHING;
    IF v_row.state='generated' THEN
      UPDATE public.monthly_cycle_report_artifacts SET state='published',published_at=v_now WHERE id=v_row.id;
      INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash)
      VALUES(v_row.id,'published',v_actor,v_row.artifact_hash);
    END IF;
  END LOOP;
  UPDATE public.monthly_cycles SET reporting_published_at=coalesce(reporting_published_at,v_now) WHERE id=v_close.monthly_cycle_id;
  RETURN jsonb_build_object('closePackageId',v_close.id,'publishedCount',v_actual,'rootHash',v_close.root_hash,
    'productionValueFlowEnabled',false);
END; $$;

CREATE FUNCTION public.apply_monthly_report_retention(p_actor_user_id uuid,p_as_of timestamptz,p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row record;v_count integer:=0;
BEGIN
  IF p_actor_user_id IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'monthly_report_retention_invalid';END IF;
  FOR v_row IN SELECT * FROM public.monthly_cycle_report_artifacts WHERE state IN('generated','published','superseded')
    AND retention_expires_at<=p_as_of ORDER BY retention_expires_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit LOOP
    UPDATE public.monthly_cycle_report_artifacts SET state='tombstoned',tombstoned_at=p_as_of,
      artifact=jsonb_build_object('schemaVersion',1,'tombstoned',true,'originalHash',v_row.artifact_hash) WHERE id=v_row.id;
    INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
    VALUES(v_row.id,'tombstoned',p_actor_user_id,v_row.artifact_hash,jsonb_build_object('asOf',p_as_of));v_count:=v_count+1;
  END LOOP;RETURN v_count;
END; $$;

ALTER TABLE public.monthly_cycle_report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_cycle_report_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.monthly_cycle_report_artifacts,public.monthly_cycle_report_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.monthly_cycle_report_artifacts,public.monthly_cycle_report_events TO service_role;
REVOKE ALL ON FUNCTION public.generate_monthly_cycle_reports(jsonb),public.publish_monthly_cycle_reports(jsonb),
  public.apply_monthly_report_retention(uuid,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.generate_monthly_cycle_reports(jsonb),public.publish_monthly_cycle_reports(jsonb),
  public.apply_monthly_report_retention(uuid,timestamptz,integer) TO service_role;
