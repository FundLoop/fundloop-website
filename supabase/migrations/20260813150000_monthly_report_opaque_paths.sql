-- Keep report object locators deterministic without persisting subject IDs.
-- The token is bound to the immutable artifact identity rather than a user or
-- project identifier, so it cannot be decoded into subject data.

ALTER TABLE public.monthly_cycle_report_artifacts
  ADD COLUMN path_token text,
  ADD COLUMN removed_artifact_path_evidence_hash text;

CREATE FUNCTION public.monthly_cycle_report_path_token(p_artifact_id bigint) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT encode(extensions.digest(pg_catalog.convert_to(
    'fundloop:monthly-report-object-path:v1:artifact:'||p_artifact_id::text,'UTF8'),'sha256'),'hex');
$$;

CREATE FUNCTION public.monthly_cycle_report_object_path(
  p_cycle_key text,p_close_package_id bigint,p_version integer,
  p_audience public.monthly_cycle_report_audience,p_path_token text,p_artifact_hash text
) RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_cycle_key!~'^\d{4}-(0[1-9]|1[0-2])$' OR p_close_package_id<=0 OR p_version<=0
    OR p_path_token!~'^[0-9a-f]{64}$' OR p_artifact_hash!~'^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'monthly_report_opaque_path_invalid';END IF;
  RETURN p_cycle_key||'/close-'||p_close_package_id||'/v'||p_version||'/'||p_audience::text||'/'||
    p_path_token||'-'||p_artifact_hash||'.json';
END;$$;

UPDATE public.monthly_cycle_report_artifacts
SET path_token=public.monthly_cycle_report_path_token(id);

-- A database migration cannot safely move or delete a private Storage object.
-- Stop an upgraded deployment before changing any locator whose object was
-- already verified; an operator-owned Storage migration must move/delete it.
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.monthly_cycle_report_artifacts artifact
    JOIN public.monthly_cycles cycle ON cycle.id=artifact.monthly_cycle_id
    WHERE (artifact.storage_verified_at IS NOT NULL OR artifact.state='published')
      AND artifact.artifact_path IS DISTINCT FROM public.monthly_cycle_report_object_path(
        cycle.cycle_key,artifact.close_package_id,artifact.version,artifact.audience,artifact.path_token,artifact.artifact_hash))
  THEN RAISE EXCEPTION 'monthly_report_legacy_subject_path_requires_storage_migration';END IF;
END;$$;

-- Preserve a one-way proof of any removed legacy locator before redacting it.
UPDATE public.monthly_cycle_report_artifacts artifact
SET removed_artifact_path_evidence_hash=encode(extensions.digest(pg_catalog.convert_to(artifact.removed_artifact_path,'UTF8'),'sha256'),'hex')
WHERE artifact.removed_artifact_path IS NOT NULL;

UPDATE public.monthly_cycle_report_artifacts artifact
SET artifact_path=CASE WHEN artifact.state='tombstoned' THEN NULL ELSE public.monthly_cycle_report_object_path(
      cycle.cycle_key,artifact.close_package_id,artifact.version,artifact.audience,artifact.path_token,artifact.artifact_hash) END,
    removed_artifact_path=CASE WHEN artifact.removed_artifact_path IS NULL THEN NULL ELSE public.monthly_cycle_report_object_path(
      cycle.cycle_key,artifact.close_package_id,artifact.version,artifact.audience,artifact.path_token,artifact.artifact_hash) END
FROM public.monthly_cycles cycle WHERE cycle.id=artifact.monthly_cycle_id;

CREATE FUNCTION public.enforce_monthly_cycle_report_opaque_path() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_cycle_key text;v_expected text;
BEGIN
  NEW.path_token:=public.monthly_cycle_report_path_token(NEW.id);
  SELECT cycle_key INTO STRICT v_cycle_key FROM public.monthly_cycles WHERE id=NEW.monthly_cycle_id;
  v_expected:=public.monthly_cycle_report_object_path(v_cycle_key,NEW.close_package_id,NEW.version,NEW.audience,NEW.path_token,NEW.artifact_hash);
  IF NEW.state='tombstoned' THEN
    IF NEW.removed_artifact_path IS NOT NULL AND NEW.removed_artifact_path_evidence_hash IS NULL THEN
      NEW.removed_artifact_path_evidence_hash:=encode(extensions.digest(pg_catalog.convert_to(NEW.removed_artifact_path,'UTF8'),'sha256'),'hex');
    END IF;
    NEW.removed_artifact_path:=CASE WHEN NEW.removed_artifact_path IS NULL THEN NULL ELSE v_expected END;
    NEW.artifact_path:=NULL;
  ELSE
    NEW.artifact_path:=v_expected;
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER monthly_cycle_report_artifacts_opaque_path
BEFORE INSERT OR UPDATE ON public.monthly_cycle_report_artifacts
FOR EACH ROW EXECUTE FUNCTION public.enforce_monthly_cycle_report_opaque_path();

ALTER TABLE public.monthly_cycle_report_artifacts
  ALTER COLUMN path_token SET NOT NULL,
  ALTER COLUMN path_token SET DEFAULT repeat('0',64),
  ADD CONSTRAINT monthly_report_path_token_hash CHECK(path_token~'^[0-9a-f]{64}$'),
  ADD CONSTRAINT monthly_report_removed_path_evidence_hash CHECK(
    removed_artifact_path_evidence_hash IS NULL OR removed_artifact_path_evidence_hash~'^[0-9a-f]{64}$');

-- Runtime event rows remain append-only. This narrowly scoped migration-time
-- redaction preserves the original event evidence hash and records a second
-- evidence event containing only the old metadata hash and opaque path token.
ALTER TABLE public.monthly_cycle_report_events DROP CONSTRAINT monthly_cycle_report_events_event_type_check;
ALTER TABLE public.monthly_cycle_report_events ADD CONSTRAINT monthly_cycle_report_events_event_type_check CHECK(event_type IN(
  'generated','published','superseded','tombstoned','regenerated','storage_verified','publication_failed','publication_invalidated',
  'subject_tombstoned','path_metadata_redacted'));

CREATE TEMP TABLE monthly_report_path_redactions ON COMMIT DROP AS
SELECT event.id event_id,event.artifact_id,event.actor_user_id,event.evidence_hash,
  encode(extensions.digest(pg_catalog.convert_to(event.metadata::text,'UTF8'),'sha256'),'hex') original_metadata_hash,
  artifact.path_token
FROM public.monthly_cycle_report_events event
JOIN public.monthly_cycle_report_artifacts artifact ON artifact.id=event.artifact_id
WHERE event.metadata ? 'artifactPath'
  AND event.metadata->>'artifactPath' NOT LIKE '%'||artifact.path_token||'%';

ALTER TABLE public.monthly_cycle_report_events DISABLE TRIGGER monthly_cycle_report_events_append_only;
UPDATE public.monthly_cycle_report_events event
SET metadata=(event.metadata-'artifactPath')||jsonb_build_object('pathToken',redaction.path_token,'pathRedacted',true)
FROM monthly_report_path_redactions redaction WHERE redaction.event_id=event.id;
ALTER TABLE public.monthly_cycle_report_events ENABLE TRIGGER monthly_cycle_report_events_append_only;

INSERT INTO public.monthly_cycle_report_events(artifact_id,event_type,actor_user_id,evidence_hash,metadata)
SELECT artifact_id,'path_metadata_redacted',actor_user_id,evidence_hash,
  jsonb_build_object('redactedEventId',event_id,'originalMetadataHash',original_metadata_hash,'pathToken',path_token)
FROM monthly_report_path_redactions;

CREATE OR REPLACE FUNCTION public.prepare_monthly_cycle_report_publication(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_close public.epoch_close_packages%ROWTYPE;v_version integer;v_count integer;
BEGIN
  IF p_command->>'contractVersion'<>'monthly_cycle_reports_publish.v2' OR lower(p_command->>'deploymentEnvironment') NOT IN('local','dev','test','preview')
  THEN RAISE EXCEPTION 'monthly_report_publication_runtime_disabled';END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=(p_command->>'closePackageId')::bigint;
  IF v_close.id IS NULL OR v_close.production_enabled OR v_close.root_hash<>p_command->>'rootHash' THEN RAISE EXCEPTION 'monthly_report_publication_close_mismatch';END IF;
  SELECT max(version) INTO v_version FROM public.monthly_cycle_report_artifacts WHERE close_package_id=v_close.id;
  SELECT count(*) INTO v_count FROM public.monthly_cycle_report_artifacts artifact
  JOIN public.monthly_cycles cycle ON cycle.id=artifact.monthly_cycle_id
  WHERE artifact.close_package_id=v_close.id AND artifact.version=v_version AND artifact.state IN('generated','published')
    AND artifact.artifact_hash=encode(extensions.digest(pg_catalog.convert_to(artifact.artifact_bytes,'UTF8'),'sha256'),'hex')
    AND artifact.artifact_path=public.monthly_cycle_report_object_path(cycle.cycle_key,artifact.close_package_id,artifact.version,
      artifact.audience,artifact.path_token,artifact.artifact_hash);
  IF v_count=0 OR v_count<>(SELECT count(*) FROM public.monthly_cycle_report_candidates(v_close.id))
  THEN RAISE EXCEPTION 'monthly_report_publication_incomplete';END IF;
  RETURN jsonb_build_object('closePackageId',v_close.id,'version',v_version,'artifacts',(SELECT jsonb_agg(jsonb_build_object(
    'artifactId',artifact.id,'cycleKey',cycle.cycle_key,'closePackageId',artifact.close_package_id,
    'audience',artifact.audience,'version',artifact.version,'pathToken',artifact.path_token,
    'artifactBytes',artifact.artifact_bytes,'artifactHash',artifact.artifact_hash,'artifactPath',artifact.artifact_path) ORDER BY artifact.id)
    FROM public.monthly_cycle_report_artifacts artifact JOIN public.monthly_cycles cycle ON cycle.id=artifact.monthly_cycle_id
    WHERE artifact.close_package_id=v_close.id AND artifact.version=v_version));
END;$$;

REVOKE ALL ON FUNCTION public.monthly_cycle_report_path_token(bigint),
  public.monthly_cycle_report_object_path(text,bigint,integer,public.monthly_cycle_report_audience,text,text),
  public.prepare_monthly_cycle_report_publication(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.monthly_cycle_report_path_token(bigint),
  public.monthly_cycle_report_object_path(text,bigint,integer,public.monthly_cycle_report_audience,text,text),
  public.prepare_monthly_cycle_report_publication(jsonb) TO service_role;

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
  RETURN jsonb_build_object('contractVersion','fundloop.persona-goal2-schema-readiness.v2','migrationVersion','20260813150000',
    'featureCount',35,'missingFeatures',to_jsonb(v_missing),'ready',cardinality(v_missing)=0,'productionValueFlowEnabled',false);
END;$$;
