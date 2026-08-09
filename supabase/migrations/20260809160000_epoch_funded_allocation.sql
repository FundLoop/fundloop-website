CREATE TABLE public.epoch_allocation_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  allocation_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_allocation_runtime_production_closed CHECK (
    deployment_environment <> 'production' OR (allocation_enabled = false AND production_value_flow_enabled = false)
  ),
  CONSTRAINT epoch_allocation_runtime_no_value_flow CHECK (production_value_flow_enabled = false)
);

INSERT INTO public.epoch_allocation_runtime_controls(deployment_environment,allocation_enabled) VALUES
  ('local',true),('development',true),('dev',true),('preview',true),('test',true),('production',false)
ON CONFLICT(deployment_environment) DO NOTHING;

CREATE TABLE public.epoch_allocation_manifests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version integer NOT NULL,
  policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1',
  status text NOT NULL DEFAULT 'locked',
  minor_unit_scale smallint NOT NULL DEFAULT 2,
  funded_exact_usd numeric(38,18) NOT NULL,
  funded_minor numeric(78,0) NOT NULL,
  manifest jsonb NOT NULL,
  manifest_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.epoch_allocation_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  locked_at timestamptz NOT NULL DEFAULT now(),
  calculated_at timestamptz,
  UNIQUE(monthly_cycle_id,version),
  UNIQUE(manifest_hash),
  CONSTRAINT epoch_allocation_manifest_policy CHECK(policy_key='settled_cubid_redistribution_v1'),
  CONSTRAINT epoch_allocation_manifest_status CHECK(status IN ('locked','calculated','returned')),
  CONSTRAINT epoch_allocation_manifest_scale CHECK(minor_unit_scale BETWEEN 0 AND 18),
  CONSTRAINT epoch_allocation_manifest_amounts CHECK(funded_exact_usd>0 AND funded_minor>=0),
  CONSTRAINT epoch_allocation_manifest_shape CHECK(jsonb_typeof(manifest)='object' AND manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_allocation_manifest_calculated CHECK((status='locked' AND calculated_at IS NULL) OR (status<>'locked' AND calculated_at IS NOT NULL)),
  CONSTRAINT epoch_allocation_manifest_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_allocation_manifest_cycle_status_idx ON public.epoch_allocation_manifests(monthly_cycle_id,status,version DESC);
CREATE INDEX epoch_allocation_manifest_actor_idx ON public.epoch_allocation_manifests(actor_user_id,locked_at DESC);

CREATE TABLE public.epoch_allocation_manifest_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manifest_id bigint NOT NULL REFERENCES public.epoch_allocation_manifests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_lot_id bigint NOT NULL REFERENCES public.epoch_valuation_source_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_lot_key text NOT NULL,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_position integer NOT NULL,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_amount numeric(78,0) NOT NULL,
  fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  exact_usd numeric(38,18) NOT NULL,
  canonical_minor_capacity numeric(78,0) NOT NULL,
  source_order bigint NOT NULL,
  evidence_hash text NOT NULL,
  UNIQUE(manifest_id,source_lot_id),
  UNIQUE(manifest_id,source_lot_key),
  UNIQUE(source_lot_id),
  CONSTRAINT epoch_allocation_source_position CHECK(source_position>=0 AND source_order>=0),
  CONSTRAINT epoch_allocation_source_pair FOREIGN KEY(financial_asset_id,custody_account_id)
    REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT epoch_allocation_source_amounts CHECK(native_atomic_amount>0 AND exact_usd>0 AND canonical_minor_capacity>=0),
  CONSTRAINT epoch_allocation_source_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_allocation_source_manifest_order_idx ON public.epoch_allocation_manifest_sources(manifest_id,source_order,id);
CREATE INDEX epoch_allocation_source_project_idx ON public.epoch_allocation_manifest_sources(project_id,manifest_id,id);
CREATE INDEX epoch_allocation_source_asset_custody_idx ON public.epoch_allocation_manifest_sources(financial_asset_id,custody_account_id,manifest_id);

CREATE TABLE public.epoch_allocation_manifest_cohort (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manifest_id bigint NOT NULL REFERENCES public.epoch_allocation_manifests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_pseudonym text NOT NULL,
  locked_cubid_score numeric(38,18) NOT NULL,
  locked_max_cubid_score numeric(38,18) NOT NULL,
  cubid_evidence_hash text NOT NULL,
  UNIQUE(manifest_id,project_id,user_id),
  UNIQUE(manifest_id,project_id,project_pseudonym),
  CONSTRAINT epoch_allocation_cohort_score CHECK(
    locked_max_cubid_score>0 AND locked_cubid_score>=0 AND locked_cubid_score<=locked_max_cubid_score
  ),
  CONSTRAINT epoch_allocation_cohort_pseudonym CHECK(project_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_allocation_cohort_hash CHECK(cubid_evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_allocation_cohort_manifest_project_idx ON public.epoch_allocation_manifest_cohort(manifest_id,project_id,id);
CREATE INDEX epoch_allocation_cohort_user_idx ON public.epoch_allocation_manifest_cohort(user_id,manifest_id,id);

CREATE TABLE public.epoch_allocation_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manifest_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_manifests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  policy_key text NOT NULL,
  result_hash text NOT NULL UNIQUE,
  artifact jsonb NOT NULL,
  funded_minor numeric(78,0) NOT NULL,
  retained_initial_minor numeric(78,0) NOT NULL,
  score_pool_minor numeric(78,0) NOT NULL,
  overlap_pool_minor numeric(78,0) NOT NULL,
  top_up_minor numeric(78,0) NOT NULL,
  returned_residue_minor numeric(78,0) NOT NULL,
  final_allocation_minor numeric(78,0) NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.epoch_allocation_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_allocation_run_policy CHECK(policy_key='settled_cubid_redistribution_v1'),
  CONSTRAINT epoch_allocation_run_hash CHECK(result_hash ~ '^[0-9a-f]{64}$' AND jsonb_typeof(artifact)='object'),
  CONSTRAINT epoch_allocation_run_amounts CHECK(
    funded_minor>=0 AND retained_initial_minor>=0 AND score_pool_minor>=0 AND overlap_pool_minor>=0
    AND top_up_minor>=0 AND returned_residue_minor>=0 AND final_allocation_minor>=0
    AND final_allocation_minor+returned_residue_minor=funded_minor
    AND top_up_minor+returned_residue_minor=score_pool_minor+overlap_pool_minor
  ),
  CONSTRAINT epoch_allocation_run_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_allocation_run_actor_idx ON public.epoch_allocation_runs(actor_user_id,created_at DESC);

CREATE TABLE public.epoch_allocation_user_awards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.epoch_allocation_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  aggregate_initial_exact_usd numeric(38,18) NOT NULL,
  baseline_exact_usd numeric(38,18) NOT NULL,
  exact_cap_usd numeric(38,18) NOT NULL,
  minor_unit_cap numeric(78,0) NOT NULL,
  retained_initial_minor numeric(78,0) NOT NULL,
  top_up_minor numeric(78,0) NOT NULL,
  final_minor numeric(78,0) NOT NULL,
  project_claims jsonb NOT NULL,
  UNIQUE(run_id,user_id),
  CONSTRAINT epoch_allocation_award_amounts CHECK(
    aggregate_initial_exact_usd>=0 AND baseline_exact_usd>=0 AND exact_cap_usd=3*baseline_exact_usd
    AND minor_unit_cap>=0 AND retained_initial_minor>=0 AND top_up_minor>=0
    AND final_minor=retained_initial_minor+top_up_minor AND final_minor<=minor_unit_cap
  ),
  CONSTRAINT epoch_allocation_award_claims CHECK(jsonb_typeof(project_claims)='array')
);
CREATE INDEX epoch_allocation_award_user_idx ON public.epoch_allocation_user_awards(user_id,run_id);

CREATE TABLE public.epoch_allocation_source_dispositions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.epoch_allocation_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  manifest_source_id bigint NOT NULL REFERENCES public.epoch_allocation_manifest_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  disposition_kind text NOT NULL,
  canonical_minor numeric(78,0) NOT NULL,
  exact_usd numeric(38,18) NOT NULL,
  stable_position integer NOT NULL,
  CONSTRAINT epoch_allocation_disposition_kind CHECK(disposition_kind IN ('initial_retained','score_pool','overlap_pool','top_up','returned_residue')),
  CONSTRAINT epoch_allocation_disposition_amount CHECK(canonical_minor>=0 AND exact_usd>=0 AND stable_position>=0),
  CONSTRAINT epoch_allocation_disposition_user_shape CHECK(
    (disposition_kind IN ('initial_retained','top_up') AND user_id IS NOT NULL)
    OR (disposition_kind IN ('score_pool','overlap_pool','returned_residue') AND user_id IS NULL)
  )
);
CREATE INDEX epoch_allocation_disposition_run_idx ON public.epoch_allocation_source_dispositions(run_id,stable_position,id);
CREATE INDEX epoch_allocation_disposition_source_idx ON public.epoch_allocation_source_dispositions(manifest_source_id,run_id,id);
CREATE INDEX epoch_allocation_disposition_user_idx ON public.epoch_allocation_source_dispositions(user_id,run_id,id) WHERE user_id IS NOT NULL;

CREATE FUNCTION public.prevent_epoch_allocation_record_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'epoch_allocation_records_are_append_only'; END; $$;
CREATE TRIGGER epoch_allocation_sources_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_manifest_sources FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_allocation_record_mutation();
CREATE TRIGGER epoch_allocation_cohort_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_manifest_cohort FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_allocation_record_mutation();
CREATE TRIGGER epoch_allocation_runs_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_runs FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_allocation_record_mutation();
CREATE TRIGGER epoch_allocation_awards_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_user_awards FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_allocation_record_mutation();
CREATE TRIGGER epoch_allocation_dispositions_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_source_dispositions FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_allocation_record_mutation();

CREATE FUNCTION public.epoch_allocation_runtime_enabled(p_environment text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.epoch_allocation_runtime_controls control
    WHERE control.deployment_environment=lower(p_environment) AND control.allocation_enabled AND NOT control.production_value_flow_enabled
  );
$$;

CREATE FUNCTION public.lock_funded_epoch_allocation(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_cycle public.monthly_cycles%ROWTYPE;
  v_existing public.epoch_allocation_manifests%ROWTYPE;
  v_manifest_id bigint;
  v_version integer;
  v_scale smallint:=2;
  v_sources jsonb;
  v_cohort jsonb;
  v_manifest jsonb;
  v_hash text;
  v_funded numeric(38,18);
  v_funded_minor numeric(78,0);
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_lock.v1'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_allocation_runtime_disabled';
  END IF;
  IF nullif(p_command->>'actorUserId','') IS NULL THEN RAISE EXCEPTION 'epoch_allocation_actor_required'; END IF;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key=p_command->>'cycleKey' FOR UPDATE;
  IF v_cycle.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_cycle_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('epoch-allocation-lock:'||v_cycle.id::text,0));
  SELECT * INTO v_existing FROM public.epoch_allocation_manifests WHERE monthly_cycle_id=v_cycle.id ORDER BY version DESC LIMIT 1;
  IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('manifestId',v_existing.id,'manifestHash',v_existing.manifest_hash,'manifest',v_existing.manifest); END IF;

  IF EXISTS(
    SELECT 1 FROM public.epoch_valuation_source_lots lot
    JOIN public.epoch_project_packages package ON package.id=lot.package_id
    WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND (package.canonical_cycle_id<>v_cycle.id OR package.status NOT IN ('approved','silent_approved')
        OR package.funding_status<>'settled' OR package.compliance_status<>'passed' OR package.cubid_status<>'eligible')
  ) THEN RAISE EXCEPTION 'epoch_allocation_package_not_approved'; END IF;

  IF EXISTS(
    SELECT 1 FROM public.epoch_valuation_source_lots lot
    WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND NOT EXISTS(
        SELECT 1 FROM public.ledger_postings posting
        JOIN public.ledger_accounts account ON account.id=posting.account_id
        WHERE posting.transaction_id=lot.fee_ledger_transaction_id AND posting.project_id=lot.project_id
          AND account.account_key='epoch_review_distributable_control' AND posting.side='credit'
          AND posting.functional_usd_amount=lot.distributable_exact_usd
      )
  ) THEN RAISE EXCEPTION 'epoch_allocation_ledger_backing_missing'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sourceLotId',lot.id::text,'sourceLotKey',lot.source_lot_key,'projectId',lot.project_id,'projectKey',project.slug,
    'exactUsd',lot.distributable_exact_usd::text,'minorUnitScale',lot.canonical_minor_unit_scale,
    'sourceOrder',lot.deterministic_source_order::text,'railKey',lot.rail_key,'assetKey',asset.asset_key,
    'custodyKey',custody.custody_key,'nativeAtomicAmount',lot.native_atomic_amount::text,
    'fxSnapshotId',lot.fx_snapshot_id::text,'evidenceHash',lot.evidence_hash
  ) ORDER BY lot.deterministic_source_order,lot.source_lot_key),'[]'::jsonb),coalesce(sum(lot.distributable_exact_usd),0)
  INTO v_sources,v_funded
  FROM public.epoch_valuation_source_lots lot
  JOIN public.epoch_project_packages package ON package.id=lot.package_id
  JOIN public.projects project ON project.id=lot.project_id
  JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
  JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id
  WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
    AND package.canonical_cycle_id=v_cycle.id AND package.status IN ('approved','silent_approved')
    AND package.funding_status='settled' AND package.compliance_status='passed' AND package.cubid_status='eligible';
  IF jsonb_array_length(v_sources)=0 OR v_funded<=0 THEN RAISE EXCEPTION 'epoch_allocation_sources_missing'; END IF;

  IF EXISTS(
    SELECT 1 FROM public.epoch_valuation_source_lots lot
    JOIN public.epoch_project_packages package ON package.id=lot.package_id
    JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
    WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
    GROUP BY lot.project_id,cohort.user_id HAVING count(DISTINCT (cohort.locked_cubid_score::text||':'||cohort.locked_max_cubid_score::text||':'||cohort.evidence_hash))<>1
  ) THEN RAISE EXCEPTION 'epoch_allocation_cohort_conflict'; END IF;

  SELECT coalesce(jsonb_agg(row_value ORDER BY (row_value->>'projectId')::bigint,row_value->>'userId'),'[]'::jsonb) INTO v_cohort
  FROM (
    SELECT DISTINCT jsonb_build_object('projectId',lot.project_id,'projectKey',project.slug,'userId',cohort.user_id::text,
      'projectPseudonym',cohort.project_pseudonym,'lockedScore',cohort.locked_cubid_score::text,
      'lockedMaximumScore',cohort.locked_max_cubid_score::text,'cubidEvidenceHash',cohort.evidence_hash) row_value
    FROM public.epoch_valuation_source_lots lot
    JOIN public.epoch_project_packages package ON package.id=lot.package_id
    JOIN public.projects project ON project.id=lot.project_id
    JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
    WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND package.canonical_cycle_id=v_cycle.id AND package.status IN ('approved','silent_approved')
  ) locked_cohort;
  IF jsonb_array_length(v_cohort)=0 THEN RAISE EXCEPTION 'epoch_allocation_cohort_missing'; END IF;

  v_funded_minor:=floor(v_funded*power(10,v_scale));
  v_manifest:=jsonb_build_object('policy','settled_cubid_redistribution_v1','cycleKey',v_cycle.cycle_key,
    'minorUnitScale',v_scale,'fundedExactUsd',v_funded::text,'fundedMinor',v_funded_minor::text,
    'sources',v_sources,'cohort',v_cohort);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  v_version:=1;
  INSERT INTO public.epoch_allocation_manifests(monthly_cycle_id,version,minor_unit_scale,funded_exact_usd,funded_minor,manifest,manifest_hash,
    actor_user_id,deployment_environment)
  VALUES(v_cycle.id,v_version,v_scale,v_funded,v_funded_minor,v_manifest,v_hash,(p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment'))
  RETURNING id INTO v_manifest_id;

  WITH candidates AS (
    SELECT lot.*,floor(lot.distributable_exact_usd*power(10,v_scale))::numeric base_minor,
      (lot.distributable_exact_usd*power(10,v_scale)-floor(lot.distributable_exact_usd*power(10,v_scale))) fractional,
      row_number() OVER(ORDER BY lot.distributable_exact_usd*power(10,v_scale)-floor(lot.distributable_exact_usd*power(10,v_scale)) DESC,
        lot.deterministic_source_order,lot.source_lot_key) residual_rank,
      v_funded_minor-sum(floor(lot.distributable_exact_usd*power(10,v_scale))) OVER() residual_count
    FROM public.epoch_valuation_source_lots lot JOIN public.epoch_project_packages package ON package.id=lot.package_id
    WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND package.canonical_cycle_id=v_cycle.id AND package.status IN ('approved','silent_approved')
  )
  INSERT INTO public.epoch_allocation_manifest_sources(manifest_id,source_lot_id,source_lot_key,project_id,source_position,rail_key,
    financial_asset_id,custody_account_id,native_atomic_amount,fx_snapshot_id,exact_usd,canonical_minor_capacity,source_order,evidence_hash)
  SELECT v_manifest_id,id,source_lot_key,project_id,source_position,rail_key,financial_asset_id,custody_account_id,native_atomic_amount,
    fx_snapshot_id,distributable_exact_usd,base_minor+CASE WHEN residual_rank<=residual_count THEN 1 ELSE 0 END,deterministic_source_order,evidence_hash
  FROM candidates ORDER BY deterministic_source_order,source_lot_key;

  INSERT INTO public.epoch_allocation_manifest_cohort(manifest_id,project_id,user_id,project_pseudonym,locked_cubid_score,locked_max_cubid_score,cubid_evidence_hash)
  SELECT DISTINCT v_manifest_id,lot.project_id,cohort.user_id,cohort.project_pseudonym,cohort.locked_cubid_score,cohort.locked_max_cubid_score,cohort.evidence_hash
  FROM public.epoch_valuation_source_lots lot JOIN public.epoch_project_packages package ON package.id=lot.package_id
  JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
  WHERE lot.monthly_cycle_id=v_cycle.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
    AND package.canonical_cycle_id=v_cycle.id AND package.status IN ('approved','silent_approved');

  UPDATE public.epoch_valuation_source_lots SET state='reserved',reserved_exact_usd=distributable_exact_usd
  WHERE id IN(SELECT source_lot_id FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id);
  INSERT INTO public.epoch_source_lot_events(source_lot_id,event_type,exact_usd_amount,actor_user_id,evidence_hash)
  SELECT source_lot_id,'reserved',exact_usd,(p_command->>'actorUserId')::uuid,
    encode(extensions.digest(convert_to(v_hash||':'||source_lot_key||':reserved','UTF8'),'sha256'),'hex')
  FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id;
  RETURN jsonb_build_object('manifestId',v_manifest_id,'manifestHash',v_hash,'manifest',v_manifest);
END; $$;

CREATE FUNCTION public.record_funded_epoch_allocation(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_manifest public.epoch_allocation_manifests%ROWTYPE;
  v_run_id bigint;
  v_artifact jsonb:=p_command->'artifact';
  v_result_hash text:=p_command->>'resultHash';
  v_existing public.epoch_allocation_runs%ROWTYPE;
  v_user jsonb;
  v_row jsonb;
  v_position integer:=0;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_result.v1'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  SELECT * INTO v_manifest FROM public.epoch_allocation_manifests WHERE id=(p_command->>'manifestId')::bigint FOR UPDATE;
  IF v_manifest.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_manifest_not_locked'; END IF;
  SELECT * INTO v_existing FROM public.epoch_allocation_runs WHERE manifest_id=v_manifest.id;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.result_hash<>v_result_hash THEN RAISE EXCEPTION 'epoch_allocation_result_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  IF v_manifest.status<>'locked' THEN RAISE EXCEPTION 'epoch_allocation_manifest_not_locked'; END IF;
  IF v_artifact->>'policy'<>'settled_cubid_redistribution_v1' OR v_artifact->>'manifestHash'<>v_manifest.manifest_hash
    OR v_artifact->>'resultHash'<>v_result_hash OR v_result_hash !~ '^[0-9a-f]{64}$'
    OR (v_artifact->'totals'->>'fundedMinor')::numeric<>v_manifest.funded_minor
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_artifact->'invariantChecks') check_row WHERE NOT (check_row->>'ok')::boolean)
  THEN RAISE EXCEPTION 'epoch_allocation_artifact_invalid'; END IF;

  INSERT INTO public.epoch_allocation_runs(manifest_id,policy_key,result_hash,artifact,funded_minor,retained_initial_minor,
    score_pool_minor,overlap_pool_minor,top_up_minor,returned_residue_minor,final_allocation_minor,actor_user_id,deployment_environment)
  VALUES(v_manifest.id,v_artifact->>'policy',v_result_hash,v_artifact,(v_artifact->'totals'->>'fundedMinor')::numeric,
    (v_artifact->'totals'->>'retainedInitialMinor')::numeric,(v_artifact->'totals'->>'scorePoolMinor')::numeric,
    (v_artifact->'totals'->>'overlapPoolMinor')::numeric,(v_artifact->'totals'->>'topUpMinor')::numeric,
    (v_artifact->'totals'->>'returnedResidueMinor')::numeric,(v_artifact->'totals'->>'finalAllocationMinor')::numeric,
    (p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment')) RETURNING id INTO v_run_id;

  FOR v_user IN SELECT value FROM jsonb_array_elements(v_artifact->'users') LOOP
    INSERT INTO public.epoch_allocation_user_awards(run_id,user_id,aggregate_initial_exact_usd,baseline_exact_usd,exact_cap_usd,
      minor_unit_cap,retained_initial_minor,top_up_minor,final_minor,project_claims)
    VALUES(v_run_id,(v_user->>'userId')::uuid,(v_user->>'aggregateInitialExactUsd')::numeric,(v_user->>'baselineExactUsd')::numeric,
      (v_user->>'exactCapUsd')::numeric,(v_user->>'minorUnitCap')::numeric,(v_user->>'retainedInitialMinor')::numeric,
      (v_user->>'topUpMinor')::numeric,(v_user->>'finalMinor')::numeric,v_user->'projectClaims');
  END LOOP;
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_artifact->'sourceDispositions') LOOP
    v_position:=v_position+1;
    INSERT INTO public.epoch_allocation_source_dispositions(run_id,manifest_source_id,user_id,disposition_kind,canonical_minor,exact_usd,stable_position)
    SELECT v_run_id,source.id,nullif(v_row->>'userId','')::uuid,v_row->>'kind',(v_row->>'canonicalMinor')::numeric,
      (v_row->>'exactUsd')::numeric,v_position FROM public.epoch_allocation_manifest_sources source
    WHERE source.manifest_id=v_manifest.id AND source.source_lot_id=(v_row->>'sourceLotId')::bigint;
    IF NOT FOUND THEN RAISE EXCEPTION 'epoch_allocation_source_unknown'; END IF;
  END LOOP;

  IF EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_sources source
    LEFT JOIN public.epoch_allocation_source_dispositions disposition ON disposition.manifest_source_id=source.id AND disposition.run_id=v_run_id
      AND disposition.disposition_kind IN ('initial_retained','top_up','returned_residue')
    WHERE source.manifest_id=v_manifest.id GROUP BY source.id,source.canonical_minor_capacity
    HAVING coalesce(sum(disposition.canonical_minor),0)<>source.canonical_minor_capacity
  ) THEN RAISE EXCEPTION 'epoch_allocation_source_conservation_failed'; END IF;
  IF (SELECT coalesce(sum(final_minor),0) FROM public.epoch_allocation_user_awards WHERE run_id=v_run_id)
    <>(v_artifact->'totals'->>'finalAllocationMinor')::numeric THEN RAISE EXCEPTION 'epoch_allocation_award_conservation_failed'; END IF;
  UPDATE public.epoch_allocation_manifests SET status='calculated',calculated_at=clock_timestamp() WHERE id=v_manifest.id;
  RETURN v_run_id;
END; $$;

CREATE VIEW public.epoch_allocation_operator_view WITH(security_invoker=true) AS
SELECT cycle.cycle_key,manifest.id manifest_id,manifest.version,manifest.status,manifest.manifest_hash,manifest.funded_exact_usd,
  manifest.funded_minor,run.id run_id,run.result_hash,run.retained_initial_minor,run.score_pool_minor,run.overlap_pool_minor,
  run.top_up_minor,run.returned_residue_minor,run.final_allocation_minor,count(award.id) user_count,
  bool_and(NOT manifest.production_enabled AND (run.id IS NULL OR NOT run.production_enabled)) provisional_only,
  manifest.locked_at,manifest.calculated_at
FROM public.epoch_allocation_manifests manifest JOIN public.monthly_cycles cycle ON cycle.id=manifest.monthly_cycle_id
LEFT JOIN public.epoch_allocation_runs run ON run.manifest_id=manifest.id
LEFT JOIN public.epoch_allocation_user_awards award ON award.run_id=run.id
GROUP BY cycle.cycle_key,manifest.id,run.id;

ALTER TABLE public.epoch_allocation_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_manifest_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_manifest_cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_user_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_source_dispositions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epoch_allocation_runtime_controls,public.epoch_allocation_manifests,public.epoch_allocation_manifest_sources,
  public.epoch_allocation_manifest_cohort,public.epoch_allocation_runs,public.epoch_allocation_user_awards,
  public.epoch_allocation_source_dispositions,public.epoch_allocation_operator_view FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_allocation_runtime_controls,public.epoch_allocation_manifests,public.epoch_allocation_manifest_sources,
  public.epoch_allocation_manifest_cohort,public.epoch_allocation_runs,public.epoch_allocation_user_awards,
  public.epoch_allocation_source_dispositions,public.epoch_allocation_operator_view TO service_role;
REVOKE ALL ON FUNCTION public.epoch_allocation_runtime_enabled(text),public.lock_funded_epoch_allocation(jsonb),
  public.record_funded_epoch_allocation(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.epoch_allocation_runtime_enabled(text),public.lock_funded_epoch_allocation(jsonb),
  public.record_funded_epoch_allocation(jsonb) TO service_role;
