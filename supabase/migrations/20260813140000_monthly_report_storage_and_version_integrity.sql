-- Correct monthly report publication so a database row cannot claim publication
-- until the exact immutable Storage object has been uploaded and read back.

ALTER TABLE public.monthly_cycle_report_artifacts
  ADD COLUMN artifact_bytes text,
  ADD COLUMN artifact_path text,
  ADD COLUMN storage_verified_at timestamptz,
  ADD COLUMN storage_verified_hash text,
  ADD COLUMN supersedes_id bigint REFERENCES public.monthly_cycle_report_artifacts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN regeneration_key text,
  ADD COLUMN removed_artifact_path text,
  ADD COLUMN subject_evidence_hash text,
  ADD COLUMN tombstone_reason text;

UPDATE public.monthly_cycle_report_artifacts artifact
SET artifact_bytes=artifact.artifact::text,
    artifact_path=cycle.cycle_key||'/close-'||artifact.close_package_id||'/v'||artifact.version||'/'||artifact.audience::text||'/'||
      coalesce(artifact.subject_user_id::text,artifact.subject_project_id::text,'global')||'-'||artifact.artifact_hash||'.json'
FROM public.monthly_cycles cycle WHERE cycle.id=artifact.monthly_cycle_id;

ALTER TABLE public.monthly_cycle_report_artifacts
  ALTER COLUMN artifact_bytes SET NOT NULL,
  ADD CONSTRAINT monthly_report_artifact_path_state CHECK(state='tombstoned' OR artifact_path IS NOT NULL),
  ADD CONSTRAINT monthly_report_storage_hash CHECK(storage_verified_hash IS NULL OR storage_verified_hash=artifact_hash),
  ADD CONSTRAINT monthly_report_regeneration_key CHECK(regeneration_key IS NULL OR regeneration_key~'^[0-9a-f]{64}$'),
  ADD CONSTRAINT monthly_report_subject_evidence_hash CHECK(subject_evidence_hash IS NULL OR subject_evidence_hash~'^[0-9a-f]{64}$');

ALTER TABLE public.monthly_cycle_report_artifacts DROP CONSTRAINT monthly_report_artifact_subject;
ALTER TABLE public.monthly_cycle_report_artifacts ADD CONSTRAINT monthly_report_artifact_subject CHECK(
  state='tombstoned' OR
  (audience IN('public','operator','mcp') AND subject_user_id IS NULL AND subject_project_id IS NULL) OR
  (audience='user' AND subject_user_id IS NOT NULL AND subject_project_id IS NULL) OR
  (audience='founder' AND subject_user_id IS NULL AND subject_project_id IS NOT NULL));

ALTER TABLE public.monthly_cycle_reports
  ADD COLUMN report_version integer NOT NULL DEFAULT 1,
  ADD COLUMN report_artifact_id bigint REFERENCES public.monthly_cycle_report_artifacts(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
DROP INDEX public.idx_monthly_cycle_reports_public_once;
DROP INDEX public.idx_monthly_cycle_reports_user_once;
DROP INDEX public.idx_monthly_cycle_reports_project_once;
DROP INDEX public.idx_monthly_cycle_reports_mcp_once;
CREATE UNIQUE INDEX idx_monthly_cycle_reports_global_version ON public.monthly_cycle_reports(monthly_cycle_id,audience,report_version)
  WHERE audience IN('public','operator','mcp');
CREATE UNIQUE INDEX idx_monthly_cycle_reports_user_version ON public.monthly_cycle_reports(monthly_cycle_id,subject_user_id,report_version)
  WHERE audience='user' AND subject_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_monthly_cycle_reports_project_version ON public.monthly_cycle_reports(monthly_cycle_id,subject_project_id,report_version)
  WHERE audience='founder' AND subject_project_id IS NOT NULL;
CREATE UNIQUE INDEX idx_monthly_cycle_reports_artifact_once ON public.monthly_cycle_reports(report_artifact_id)
  WHERE report_artifact_id IS NOT NULL;
ALTER TABLE public.monthly_cycle_reports DROP CONSTRAINT monthly_cycle_reports_subject_check;
ALTER TABLE public.monthly_cycle_reports ADD CONSTRAINT monthly_cycle_reports_subject_check CHECK(
  coalesce((payload->>'tombstoned')::boolean,false) OR
  (audience IN('public','operator','mcp') AND subject_user_id IS NULL AND subject_project_id IS NULL) OR
  (audience='user' AND subject_user_id IS NOT NULL AND subject_project_id IS NULL) OR
  (audience='founder' AND subject_user_id IS NULL AND subject_project_id IS NOT NULL));

-- Earlier candidate code could claim publication without an object. Demote only
-- those candidate artifacts/reports; preserve the append-only historical event.
DELETE FROM public.monthly_cycle_reports report USING public.monthly_cycle_report_artifacts artifact
WHERE report.artifact_path LIKE 'artifacts/%' AND report.monthly_cycle_id=artifact.monthly_cycle_id
  AND report.audience=artifact.audience AND report.subject_user_id IS NOT DISTINCT FROM artifact.subject_user_id
  AND report.subject_project_id IS NOT DISTINCT FROM artifact.subject_project_id;
UPDATE public.monthly_cycle_report_artifacts SET state='generated',published_at=NULL
WHERE state='published' AND storage_verified_at IS NULL;

ALTER TABLE public.monthly_cycle_report_events DROP CONSTRAINT monthly_cycle_report_events_event_type_check;
ALTER TABLE public.monthly_cycle_report_events ADD CONSTRAINT monthly_cycle_report_events_event_type_check CHECK(event_type IN(
  'generated','published','superseded','tombstoned','regenerated','storage_verified','publication_failed','publication_invalidated','subject_tombstoned'));

CREATE FUNCTION public.monthly_cycle_report_candidates(p_close_package_id bigint)
RETURNS TABLE(audience public.monthly_cycle_report_audience,subject_user_id uuid,subject_project_id bigint,artifact jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH close_data AS (
  SELECT package.*,cycle.cycle_key FROM public.epoch_close_packages package
  JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id WHERE package.id=p_close_package_id
), common AS (
  SELECT close_data.*,jsonb_build_object('schemaVersion',2,'cycleKey',cycle_key,'closePackageId',id,'policyKey',policy_key,
    'manifestHash',manifest_hash,'resultHash',result_hash,'rootHash',root_hash,'status',status,'productionValueFlowEnabled',false,
    'explanation',jsonb_build_object('inputs','approved close package and immutable source manifests','attribution','eligible cohort and locked attribution evidence',
    'uniqueness','one immutable audience artifact per subject and version','feesFx','exact source-linked FX and fee dispositions',
    'allocation','full initial claims plus cap-limited redistribution top-ups','claimsExpiryRollover','protected claims and E-3 harvest/rollover',
    'exceptions','operator-visible close exceptions','reconciliation','artifact hashes bind to the close root')) common FROM close_data
)
SELECT 'public'::public.monthly_cycle_report_audience,NULL::uuid,NULL::bigint,c.common||jsonb_build_object('audience','public','totals',jsonb_build_object(
  'fundedMinor',c.funded_minor::text,'finalAllocationMinor',c.final_allocation_minor::text,'returnedResidueMinor',c.returned_residue_minor::text)) FROM common c
UNION ALL SELECT 'operator',NULL,NULL,c.common||jsonb_build_object('audience','operator','closeArtifacts',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('key',artifact_key,'hash',artifact_hash) ORDER BY artifact_key),'[]')
   FROM public.epoch_close_artifacts WHERE close_package_id=c.id)) FROM common c
UNION ALL SELECT 'mcp',NULL,NULL,c.common||jsonb_build_object('audience','mcp','workflow','monthly_reporting.read',
  'scopes',jsonb_build_array('public','authorized_user','authorized_founder','operator')) FROM common c
UNION ALL SELECT 'user',control.user_id,NULL,c.common||jsonb_build_object('audience','user','subjectUserId',control.user_id,
  'award',jsonb_build_object('initialClaimMinor',control.initial_claim_minor::text,'topUpMinor',control.redistribution_top_up_minor::text,
  'finalAwardMinor',control.final_award_minor::text,'expiryCycleId',obligation.source_expires_after_cycle_id))
  FROM common c JOIN public.epoch_provisional_award_controls control ON control.approval_id=c.approval_id
  LEFT JOIN public.user_withdrawal_obligations obligation ON obligation.source_award_control_id=control.id
UNION ALL SELECT 'founder',NULL,summary.project_id,c.common||jsonb_build_object('audience','founder','subjectProjectId',summary.project_id,
  'project',jsonb_build_object('fundedMinor',summary.funded_minor::text,'cohortCount',summary.cohort_count,'sourceCount',summary.source_count,
  'initialClaimExactUsd',summary.initial_claim_exact_usd::text,'scorePoolContributionExactUsd',summary.score_pool_contribution_exact_usd::text))
  FROM common c JOIN public.epoch_close_project_summaries summary ON summary.approval_id=c.approval_id;
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_cycle_reports(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_actor uuid:=(p_command->>'actorUserId')::uuid;
  v_close public.epoch_close_packages%ROWTYPE;v_candidate record;v_existing record;v_hash text;v_count integer:=0;v_version integer;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_generate.v2' OR v_environment NOT IN('local','dev','test','preview')
    OR v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=v_actor) THEN RAISE EXCEPTION 'monthly_report_generation_runtime_disabled';END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('monthly-report:'||(p_command->>'closePackageId'),0));
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash!~'^[0-9a-f]{64}$' OR v_close.status NOT IN('root_review_required','payout_readying')
  THEN RAISE EXCEPTION 'monthly_report_close_unavailable';END IF;
  SELECT max(version) INTO v_version FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id;
  IF v_version IS NOT NULL THEN
    FOR v_candidate IN SELECT * FROM public.monthly_cycle_report_candidates(v_close.id) LOOP
      v_hash:=encode(extensions.digest(pg_catalog.convert_to(v_candidate.artifact::text,'UTF8'),'sha256'),'hex');
      SELECT artifact_hash INTO v_existing FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_version
        AND audience=v_candidate.audience AND subject_user_id IS NOT DISTINCT FROM v_candidate.subject_user_id
        AND subject_project_id IS NOT DISTINCT FROM v_candidate.subject_project_id;
      IF NOT FOUND OR v_existing.artifact_hash<>v_hash THEN RAISE EXCEPTION 'monthly_report_generation_changed_requires_regenerate';END IF;
      v_count:=v_count+1;
    END LOOP;
    IF v_count<>(SELECT count(*) FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_version)
    THEN RAISE EXCEPTION 'monthly_report_generation_changed_requires_regenerate';END IF;
    RETURN jsonb_build_object('closePackageId',v_close.id,'version',v_version,'replayed',true,'artifactCount',v_count,'productionValueFlowEnabled',false);
  END IF;
  v_version:=1;v_count:=0;
  FOR v_candidate IN SELECT * FROM public.monthly_cycle_report_candidates(v_close.id) LOOP
    v_hash:=encode(extensions.digest(pg_catalog.convert_to(v_candidate.artifact::text,'UTF8'),'sha256'),'hex');
    INSERT INTO public.monthly_cycle_report_artifacts(close_package_id,monthly_cycle_id,audience,subject_user_id,subject_project_id,version,
      artifact,artifact_bytes,artifact_hash,artifact_path,retention_expires_at,generated_by_user_id)
    VALUES(v_close.id,v_close.monthly_cycle_id,v_candidate.audience,v_candidate.subject_user_id,v_candidate.subject_project_id,v_version,
      v_candidate.artifact,v_candidate.artifact::text,v_hash,(SELECT cycle_key FROM public.monthly_cycles WHERE id=v_close.monthly_cycle_id)||
      '/close-'||v_close.id||'/v1/'||v_candidate.audience::text||'/'||coalesce(v_candidate.subject_user_id::text,v_candidate.subject_project_id::text,'global')||'-'||v_hash||'.json',
      clock_timestamp()+interval '7 years',v_actor) RETURNING id INTO v_existing;
    INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash) VALUES(v_existing.id,'generated',v_actor,v_hash);v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('closePackageId',v_close.id,'version',1,'replayed',false,'artifactCount',v_count,'rootHash',v_close.root_hash,'productionValueFlowEnabled',false);
END;$$;

CREATE OR REPLACE FUNCTION public.publish_monthly_cycle_reports(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'monthly_report_storage_publication_requires_edge';
END;$$;

CREATE OR REPLACE FUNCTION public.apply_monthly_report_retention(p_actor_user_id uuid,p_as_of timestamptz,p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'monthly_report_retention_requires_storage_tombstone';
END;$$;

CREATE FUNCTION public.regenerate_monthly_cycle_reports(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_actor uuid:=(p_command->>'actorUserId')::uuid;v_close public.epoch_close_packages%ROWTYPE;
  v_candidate record;v_old public.monthly_cycle_report_artifacts%ROWTYPE;v_new_id bigint;v_hash text;v_current integer;v_next integer;v_changed boolean:=false;v_count integer:=0;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_regenerate.v2' OR v_environment NOT IN('local','dev','test','preview') OR v_actor IS NULL
    OR p_command->>'reason'!~'^[a-z][a-z0-9_-]{2,63}$' OR p_command->>'regenerationKey'!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'monthly_report_regeneration_invalid';END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('monthly-report:'||(p_command->>'closePackageId'),0));
  SELECT version INTO v_next FROM public.monthly_cycle_report_artifacts WHERE close_package_id=(p_command->>'closePackageId')::bigint
    AND regeneration_key=p_command->>'regenerationKey' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('closePackageId',(p_command->>'closePackageId')::bigint,'version',v_next,'replayed',true,'productionValueFlowEnabled',false);END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint;
  SELECT max(version) INTO v_current FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_current<>(p_command->>'expectedCurrentVersion')::integer THEN RAISE EXCEPTION 'monthly_report_regeneration_version_conflict';END IF;
  IF (SELECT count(*) FROM public.monthly_cycle_report_candidates(v_close.id))<>
    (SELECT count(*) FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_current) THEN v_changed:=true;END IF;
  FOR v_candidate IN SELECT * FROM public.monthly_cycle_report_candidates(v_close.id) LOOP
    v_hash:=encode(extensions.digest(pg_catalog.convert_to(v_candidate.artifact::text,'UTF8'),'sha256'),'hex');
    SELECT * INTO v_old FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_current
      AND audience=v_candidate.audience AND subject_user_id IS NOT DISTINCT FROM v_candidate.subject_user_id
      AND subject_project_id IS NOT DISTINCT FROM v_candidate.subject_project_id;
    IF NOT FOUND OR v_old.artifact_hash<>v_hash THEN v_changed:=true;END IF;
  END LOOP;
  IF NOT v_changed THEN RAISE EXCEPTION 'monthly_report_regeneration_unchanged';END IF;
  v_next:=v_current+1;
  FOR v_candidate IN SELECT * FROM public.monthly_cycle_report_candidates(v_close.id) LOOP
    v_hash:=encode(extensions.digest(pg_catalog.convert_to(v_candidate.artifact::text,'UTF8'),'sha256'),'hex');
    SELECT * INTO v_old FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_current
      AND audience=v_candidate.audience AND subject_user_id IS NOT DISTINCT FROM v_candidate.subject_user_id
      AND subject_project_id IS NOT DISTINCT FROM v_candidate.subject_project_id FOR UPDATE;
    INSERT INTO public.monthly_cycle_report_artifacts(close_package_id,monthly_cycle_id,audience,subject_user_id,subject_project_id,version,
      artifact,artifact_bytes,artifact_hash,artifact_path,retention_expires_at,generated_by_user_id,supersedes_id,regeneration_key)
    VALUES(v_close.id,v_close.monthly_cycle_id,v_candidate.audience,v_candidate.subject_user_id,v_candidate.subject_project_id,v_next,
      v_candidate.artifact,v_candidate.artifact::text,v_hash,(SELECT cycle_key FROM public.monthly_cycles WHERE id=v_close.monthly_cycle_id)||
      '/close-'||v_close.id||'/v'||v_next||'/'||v_candidate.audience::text||'/'||coalesce(v_candidate.subject_user_id::text,v_candidate.subject_project_id::text,'global')||'-'||v_hash||'.json',
      clock_timestamp()+interval '7 years',v_actor,CASE WHEN FOUND THEN v_old.id ELSE NULL END,p_command->>'regenerationKey') RETURNING id INTO v_new_id;
    IF v_old.id IS NOT NULL THEN
      UPDATE public.monthly_cycle_report_artifacts SET state='superseded',superseded_by_id=v_new_id WHERE id=v_old.id;
      INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
        VALUES(v_old.id,'superseded',v_actor,v_old.artifact_hash,jsonb_build_object('supersededById',v_new_id,'reason',p_command->>'reason'));
    END IF;
    INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
      VALUES(v_new_id,'regenerated',v_actor,v_hash,jsonb_build_object('supersedesId',v_old.id,'reason',p_command->>'reason','regenerationKey',p_command->>'regenerationKey'));
    v_count:=v_count+1;
  END LOOP;
  FOR v_old IN SELECT old.* FROM public.monthly_cycle_report_artifacts old WHERE old.close_package_id=v_close.id AND old.version=v_current
    AND NOT EXISTS(SELECT 1 FROM public.monthly_cycle_report_candidates(v_close.id) candidate WHERE candidate.audience=old.audience
      AND candidate.subject_user_id IS NOT DISTINCT FROM old.subject_user_id AND candidate.subject_project_id IS NOT DISTINCT FROM old.subject_project_id) FOR UPDATE LOOP
    UPDATE public.monthly_cycle_report_artifacts SET state='superseded' WHERE id=v_old.id;
    INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
      VALUES(v_old.id,'superseded',v_actor,v_old.artifact_hash,jsonb_build_object('reason',p_command->>'reason','removedFromCandidate',true));
  END LOOP;
  RETURN jsonb_build_object('closePackageId',v_close.id,'version',v_next,'replayed',false,'artifactCount',v_count,'productionValueFlowEnabled',false);
END;$$;

CREATE FUNCTION public.prepare_monthly_cycle_report_publication(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_close public.epoch_close_packages%ROWTYPE;v_version integer;v_count integer;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_publish.v2' OR lower(p_command->>'deploymentEnvironment') NOT IN('local','dev','test','preview')
  THEN RAISE EXCEPTION 'monthly_report_publication_runtime_disabled';END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash<>p_command->>'rootHash' THEN RAISE EXCEPTION 'monthly_report_publication_close_mismatch';END IF;
  SELECT max(version) INTO v_version FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id;
  SELECT count(*) INTO v_count FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_version AND state IN('generated','published')
    AND artifact_hash=encode(extensions.digest(pg_catalog.convert_to(artifact_bytes,'UTF8'),'sha256'),'hex');
  IF v_count=0 OR v_count<>(SELECT count(*) FROM public.monthly_cycle_report_candidates(v_close.id)) THEN RAISE EXCEPTION 'monthly_report_publication_incomplete';END IF;
  RETURN jsonb_build_object('closePackageId',v_close.id,'version',v_version,'artifacts',(SELECT jsonb_agg(jsonb_build_object(
    'artifactId',id,'cycleKey',(SELECT cycle_key FROM public.monthly_cycles WHERE id=monthly_cycle_id),'closePackageId',close_package_id,
    'audience',audience,'subjectUserId',subject_user_id,'subjectProjectId',subject_project_id,'version',version,
    'artifactBytes',artifact_bytes,'artifactHash',artifact_hash,'artifactPath',artifact_path) ORDER BY id)
    FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_version));
END;$$;

CREATE FUNCTION public.finalize_monthly_cycle_report_publication(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_close public.epoch_close_packages%ROWTYPE;v_version integer;v_row public.monthly_cycle_report_artifacts%ROWTYPE;v_now timestamptz:=clock_timestamp();v_evidence jsonb;v_count integer:=0;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_publish.v2' OR lower(p_command->>'deploymentEnvironment') NOT IN('local','dev','test','preview')
    OR jsonb_typeof(p_command->'artifacts')<>'array' OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=(p_command->>'actorUserId')::uuid)
  THEN RAISE EXCEPTION 'monthly_report_finalize_invalid';END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint FOR UPDATE;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash<>p_command->>'rootHash' THEN RAISE EXCEPTION 'monthly_report_publication_close_mismatch';END IF;
  SELECT max(version) INTO v_version FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id;
  FOR v_row IN SELECT * FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id AND version=v_version ORDER BY id FOR UPDATE LOOP
    SELECT value INTO v_evidence FROM jsonb_array_elements(p_command->'artifacts') WHERE value->>'artifactId'=v_row.id::text;
    IF v_evidence IS NULL OR v_evidence->>'artifactPath'<>v_row.artifact_path OR v_evidence->>'artifactHash'<>v_row.artifact_hash
    THEN RAISE EXCEPTION 'monthly_report_storage_evidence_mismatch';END IF;
    IF v_row.state='generated' THEN
      UPDATE public.monthly_cycle_report_artifacts SET state='published',published_at=v_now,storage_verified_at=v_now,storage_verified_hash=artifact_hash WHERE id=v_row.id;
      INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata) VALUES
        (v_row.id,'storage_verified',(p_command->>'actorUserId')::uuid,v_row.artifact_hash,jsonb_build_object('artifactPath',v_row.artifact_path)),
        (v_row.id,'published',(p_command->>'actorUserId')::uuid,v_row.artifact_hash,jsonb_build_object('artifactPath',v_row.artifact_path));
    END IF;
    INSERT INTO public.monthly_cycle_reports(monthly_cycle_id,audience,subject_user_id,subject_project_id,title,summary,artifact_bucket,
      artifact_path,artifact_mime_type,artifact_hash,payload,published_at,created_by_user_id,updated_by_user_id,report_version,report_artifact_id)
    VALUES(v_row.monthly_cycle_id,v_row.audience,v_row.subject_user_id,v_row.subject_project_id,(v_row.artifact->>'cycleKey')||' '||v_row.audience::text||' report',
      'Verified immutable report from approved close '||v_close.id,'monthly-cycle-reports',v_row.artifact_path,'application/json',v_row.artifact_hash,
      v_row.artifact,v_now,(p_command->>'actorUserId')::uuid,(p_command->>'actorUserId')::uuid,v_row.version,v_row.id)
    ON CONFLICT(report_artifact_id) WHERE report_artifact_id IS NOT NULL DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM public.monthly_cycle_reports WHERE report_artifact_id=v_row.id AND artifact_path=v_row.artifact_path AND artifact_hash=v_row.artifact_hash)
    THEN RAISE EXCEPTION 'monthly_report_database_publication_conflict';END IF;v_count:=v_count+1;
  END LOOP;
  IF v_count<>jsonb_array_length(p_command->'artifacts') THEN RAISE EXCEPTION 'monthly_report_storage_evidence_extra';END IF;
  UPDATE public.monthly_cycles SET reporting_published_at=coalesce(reporting_published_at,v_now) WHERE id=v_close.monthly_cycle_id;
  RETURN jsonb_build_object('closePackageId',v_close.id,'version',v_version,'publishedCount',v_count,'rootHash',v_close.root_hash,'productionValueFlowEnabled',false);
END;$$;

CREATE FUNCTION public.record_monthly_report_publication_failure(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_artifact_id bigint:=(p_command->>'artifactId')::bigint;v_hash text;
BEGIN
  SELECT artifact_hash INTO v_hash FROM public.monthly_cycle_report_artifacts WHERE id=v_artifact_id;
  IF v_hash IS NULL THEN SELECT artifact_hash,id INTO v_hash,v_artifact_id FROM public.monthly_cycle_report_artifacts
    WHERE close_package_id=(p_command->>'closePackageId')::bigint ORDER BY version DESC,id LIMIT 1;END IF;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'monthly_report_failure_artifact_missing';END IF;
  INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
  VALUES(v_artifact_id,'publication_failed',(p_command->>'actorUserId')::uuid,v_hash,jsonb_build_object('failureCode',p_command->>'failureCode'));
  RETURN jsonb_build_object('recorded',true,'productionValueFlowEnabled',false);
END;$$;

CREATE FUNCTION public.prepare_monthly_cycle_report_tombstone(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.monthly_cycle_report_artifacts%ROWTYPE;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_tombstone.v2' OR p_command->>'reason'!~'^[a-z][a-z0-9_-]{2,63}$'
    OR lower(p_command->>'deploymentEnvironment') NOT IN('local','dev','test','preview') THEN RAISE EXCEPTION 'monthly_report_tombstone_invalid';END IF;
  SELECT * INTO v_row FROM public.monthly_cycle_report_artifacts WHERE id=(p_command->>'artifactId')::bigint FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'monthly_report_tombstone_missing';END IF;
  RETURN jsonb_build_object('artifactId',v_row.id,'artifactPath',v_row.artifact_path,'artifactHash',v_row.artifact_hash,'state',v_row.state);
END;$$;

CREATE FUNCTION public.finalize_monthly_cycle_report_tombstone(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.monthly_cycle_report_artifacts%ROWTYPE;v_now timestamptz:=clock_timestamp();v_tombstone jsonb;
BEGIN
  SELECT * INTO v_row FROM public.monthly_cycle_report_artifacts WHERE id=(p_command->>'artifactId')::bigint FOR UPDATE;
  IF v_row.id IS NULL OR p_command->>'reason'!~'^[a-z][a-z0-9_-]{2,63}$' OR lower(p_command->>'deploymentEnvironment') NOT IN('local','dev','test','preview')
  THEN RAISE EXCEPTION 'monthly_report_tombstone_invalid';END IF;
  IF v_row.state='tombstoned' THEN RETURN jsonb_build_object('artifactId',v_row.id,'replayed',true,'productionValueFlowEnabled',false);END IF;
  v_tombstone:=jsonb_build_object('schemaVersion',2,'tombstoned',true,'originalHash',v_row.artifact_hash,'retainedUntil',v_row.retention_expires_at);
  UPDATE public.monthly_cycle_report_artifacts SET state='tombstoned',tombstoned_at=v_now,tombstone_reason=p_command->>'reason',
    subject_evidence_hash=encode(extensions.digest(pg_catalog.convert_to(coalesce(subject_user_id::text,subject_project_id::text,'global'),'UTF8'),'sha256'),'hex'),
    subject_user_id=NULL,subject_project_id=NULL,artifact=v_tombstone,artifact_bytes=v_tombstone::text,
    removed_artifact_path=artifact_path,artifact_path=NULL WHERE id=v_row.id;
  UPDATE public.monthly_cycle_reports SET subject_user_id=NULL,subject_project_id=NULL,artifact_path=NULL,
    payload=v_tombstone,summary='Subject data tombstoned; immutable hash evidence retained.',updated_at=v_now WHERE report_artifact_id=v_row.id;
  INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
    VALUES(v_row.id,'subject_tombstoned',(p_command->>'actorUserId')::uuid,v_row.artifact_hash,jsonb_build_object('reason',p_command->>'reason'));
  RETURN jsonb_build_object('artifactId',v_row.id,'replayed',false,'originalHash',v_row.artifact_hash,'productionValueFlowEnabled',false);
END;$$;

REVOKE ALL ON FUNCTION public.monthly_cycle_report_candidates(bigint),public.regenerate_monthly_cycle_reports(jsonb),
  public.prepare_monthly_cycle_report_publication(jsonb),public.finalize_monthly_cycle_report_publication(jsonb),
  public.record_monthly_report_publication_failure(jsonb),public.prepare_monthly_cycle_report_tombstone(jsonb),
  public.finalize_monthly_cycle_report_tombstone(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.monthly_cycle_report_candidates(bigint),public.regenerate_monthly_cycle_reports(jsonb),
  public.prepare_monthly_cycle_report_publication(jsonb),public.finalize_monthly_cycle_report_publication(jsonb),
  public.record_monthly_report_publication_failure(jsonb),public.prepare_monthly_cycle_report_tombstone(jsonb),
  public.finalize_monthly_cycle_report_tombstone(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.persona_goal2_schema_readiness() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_missing text[]:=ARRAY[]::text[];v_feature text;
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
    'function:prepare_monthly_cycle_report_tombstone(jsonb)','function:finalize_monthly_cycle_report_tombstone(jsonb)'
  ] LOOP
    IF (v_feature LIKE 'relation:%' AND pg_catalog.to_regclass('public.'||substring(v_feature FROM 10)) IS NULL)
      OR (v_feature LIKE 'function:%' AND pg_catalog.to_regprocedure('public.'||substring(v_feature FROM 10)) IS NULL)
    THEN v_missing:=array_append(v_missing,v_feature);END IF;
  END LOOP;
  FOREACH v_feature IN ARRAY ARRAY[
    'user_withdrawal_obligations.harvested_minor','epoch_allocation_manifests.selected_preview_hash',
    'monthly_cycle_report_artifacts.artifact_hash','monthly_cycle_report_artifacts.artifact_bytes',
    'monthly_cycle_report_artifacts.artifact_path','monthly_cycle_report_artifacts.storage_verified_at',
    'monthly_cycle_report_artifacts.storage_verified_hash','monthly_cycle_report_artifacts.regeneration_key',
    'monthly_cycle_report_artifacts.supersedes_id','monthly_cycle_report_artifacts.subject_evidence_hash',
    'monthly_cycle_reports.report_version','monthly_cycle_reports.report_artifact_id'
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=split_part(v_feature,'.',1) AND column_name=split_part(v_feature,'.',2))
    THEN v_missing:=array_append(v_missing,'column:'||v_feature);END IF;
  END LOOP;
  RETURN jsonb_build_object('contractVersion','fundloop.persona-goal2-schema-readiness.v2','migrationVersion','20260813140000',
    'featureCount',33,'missingFeatures',to_jsonb(v_missing),'ready',cardinality(v_missing)=0,'productionValueFlowEnabled',false);
END;$$;
