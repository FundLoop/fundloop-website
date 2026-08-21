CREATE TABLE public.epoch_close_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  close_posting_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_close_runtime_production_closed CHECK (
    deployment_environment <> 'production' OR (close_posting_enabled = false AND production_value_flow_enabled = false)
  ),
  CONSTRAINT epoch_close_runtime_no_value_flow CHECK (production_value_flow_enabled = false)
);

INSERT INTO public.epoch_close_runtime_controls(deployment_environment,close_posting_enabled) VALUES
  ('local',true),('development',true),('dev',true),('preview',true),('test',true),('production',false)
ON CONFLICT(deployment_environment) DO NOTHING;

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions) VALUES
  ('epoch_provisional_award_control','debit','provisional_conditional_non_payable_award','["user"]'::jsonb),
  ('epoch_allocated_source_control','credit','provisional_funded_source_allocation','["project"]'::jsonb),
  ('epoch_returned_residue_control','debit','provisional_source_linked_carryover','["project"]'::jsonb)
ON CONFLICT(account_key) DO NOTHING;

CREATE TABLE public.epoch_allocation_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  manifest_hash text NOT NULL,
  result_hash text NOT NULL,
  rerun_result_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.epoch_close_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_allocation_approval_hashes CHECK (
    manifest_hash ~ '^[0-9a-f]{64}$' AND result_hash ~ '^[0-9a-f]{64}$'
    AND rerun_result_hash = result_hash
  ),
  CONSTRAINT epoch_allocation_approval_production_disabled CHECK(production_enabled=false)
);

CREATE TABLE public.epoch_provisional_award_controls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id bigint NOT NULL REFERENCES public.epoch_allocation_approvals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  run_award_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_user_awards(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  retained_initial_minor numeric(78,0) NOT NULL,
  redistribution_top_up_minor numeric(78,0) NOT NULL,
  final_award_minor numeric(78,0) NOT NULL,
  minor_unit_cap numeric(78,0) NOT NULL,
  status text NOT NULL DEFAULT 'conditional',
  payable_status text NOT NULL DEFAULT 'not_payable',
  ownership_status text NOT NULL DEFAULT 'not_user_owned',
  asset_eligibility_status text NOT NULL DEFAULT 'review_pending',
  approved_result_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(approval_id,user_id),
  CONSTRAINT epoch_provisional_award_amounts CHECK (
    retained_initial_minor>=0 AND redistribution_top_up_minor>=0
    AND final_award_minor=retained_initial_minor+redistribution_top_up_minor
    AND final_award_minor<=minor_unit_cap
  ),
  CONSTRAINT epoch_provisional_award_boundary CHECK (
    status='conditional' AND payable_status='not_payable' AND ownership_status='not_user_owned'
    AND asset_eligibility_status='review_pending'
  ),
  CONSTRAINT epoch_provisional_award_hash CHECK(approved_result_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_provisional_award_user_idx ON public.epoch_provisional_award_controls(user_id,monthly_cycle_id DESC,id);

CREATE TABLE public.epoch_provisional_award_source_fills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  award_control_id bigint REFERENCES public.epoch_provisional_award_controls(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  approval_id bigint NOT NULL REFERENCES public.epoch_allocation_approvals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  manifest_source_id bigint NOT NULL REFERENCES public.epoch_allocation_manifest_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  disposition_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_source_dispositions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fill_kind text NOT NULL,
  canonical_minor numeric(78,0) NOT NULL,
  exact_usd numeric(38,18) NOT NULL,
  ledger_transaction_id bigint NOT NULL UNIQUE REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_award_source_fill_kind CHECK(fill_kind IN ('initial_retained','top_up','returned_residue')),
  CONSTRAINT epoch_award_source_fill_shape CHECK(
    (fill_kind IN ('initial_retained','top_up') AND award_control_id IS NOT NULL AND user_id IS NOT NULL)
    OR (fill_kind='returned_residue' AND award_control_id IS NULL AND user_id IS NULL)
  ),
  CONSTRAINT epoch_award_source_fill_amount CHECK(canonical_minor>0 AND exact_usd>=0)
);
CREATE INDEX epoch_award_source_fill_approval_idx ON public.epoch_provisional_award_source_fills(approval_id,id);
CREATE INDEX epoch_award_source_fill_project_idx ON public.epoch_provisional_award_source_fills(project_id,approval_id,id);

CREATE TABLE public.epoch_close_project_summaries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id bigint NOT NULL REFERENCES public.epoch_allocation_approvals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  funded_minor numeric(78,0) NOT NULL,
  cohort_count integer NOT NULL,
  theoretical_share_exact_usd numeric(38,18) NOT NULL,
  initial_claim_exact_usd numeric(38,18) NOT NULL,
  score_pool_contribution_exact_usd numeric(38,18) NOT NULL,
  source_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(approval_id,project_id),
  CONSTRAINT epoch_close_project_summary_amounts CHECK(
    funded_minor>=0 AND cohort_count>=0 AND theoretical_share_exact_usd>=0
    AND initial_claim_exact_usd>=0 AND score_pool_contribution_exact_usd>=0 AND source_count>=0
  )
);
CREATE INDEX epoch_close_project_summary_project_idx ON public.epoch_close_project_summaries(project_id,monthly_cycle_id DESC,id);

CREATE TABLE public.epoch_close_packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_approvals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL UNIQUE REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  shadow_state_id bigint NOT NULL REFERENCES public.epoch_shadow_states(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  stage_attempt_id bigint REFERENCES public.epoch_stage_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  package_version integer NOT NULL DEFAULT 1,
  manifest_hash text NOT NULL,
  result_hash text NOT NULL,
  root_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'payout_readying',
  user_count integer NOT NULL,
  funded_minor numeric(78,0) NOT NULL,
  final_allocation_minor numeric(78,0) NOT NULL,
  redistribution_pool_minor numeric(78,0) NOT NULL,
  top_up_minor numeric(78,0) NOT NULL,
  returned_residue_minor numeric(78,0) NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_close_package_hashes CHECK(
    manifest_hash ~ '^[0-9a-f]{64}$' AND result_hash ~ '^[0-9a-f]{64}$' AND root_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT epoch_close_package_state CHECK(status='payout_readying'),
  CONSTRAINT epoch_close_package_amounts CHECK(
    user_count>=0 AND funded_minor>=0 AND final_allocation_minor>=0 AND redistribution_pool_minor>=0
    AND top_up_minor>=0 AND returned_residue_minor>=0
    AND final_allocation_minor+returned_residue_minor=funded_minor
    AND top_up_minor+returned_residue_minor=redistribution_pool_minor
  ),
  CONSTRAINT epoch_close_package_production_disabled CHECK(production_enabled=false)
);

CREATE TABLE public.epoch_close_artifacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  close_package_id bigint NOT NULL REFERENCES public.epoch_close_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  artifact_key text NOT NULL,
  audience text NOT NULL,
  artifact jsonb NOT NULL,
  artifact_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(close_package_id,artifact_key),
  CONSTRAINT epoch_close_artifact_key CHECK(artifact_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_close_artifact_audience CHECK(audience IN ('operator','user_private','project_aggregate','public_aggregate')),
  CONSTRAINT epoch_close_artifact_shape CHECK(jsonb_typeof(artifact) IN ('object','array') AND artifact_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_close_artifact_package_idx ON public.epoch_close_artifacts(close_package_id,artifact_key);

CREATE FUNCTION public.prevent_epoch_close_record_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'epoch_close_records_are_append_only'; END; $$;

CREATE TRIGGER epoch_approvals_append_only BEFORE UPDATE OR DELETE ON public.epoch_allocation_approvals FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();
CREATE TRIGGER epoch_award_controls_append_only BEFORE UPDATE OR DELETE ON public.epoch_provisional_award_controls FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();
CREATE TRIGGER epoch_award_source_fills_append_only BEFORE UPDATE OR DELETE ON public.epoch_provisional_award_source_fills FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();
CREATE TRIGGER epoch_close_project_summaries_append_only BEFORE UPDATE OR DELETE ON public.epoch_close_project_summaries FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();
CREATE FUNCTION public.prevent_epoch_close_package_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.root_hash=repeat('0',64) AND OLD.stage_attempt_id IS NULL
    AND NEW.root_hash ~ '^[0-9a-f]{64}$' AND NEW.root_hash<>repeat('0',64) AND NEW.stage_attempt_id IS NOT NULL
    AND (to_jsonb(NEW)-'root_hash'-'stage_attempt_id')=(to_jsonb(OLD)-'root_hash'-'stage_attempt_id')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'epoch_close_records_are_append_only';
END; $$;
CREATE TRIGGER epoch_close_packages_append_only BEFORE UPDATE OR DELETE ON public.epoch_close_packages FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_package_mutation();
CREATE TRIGGER epoch_close_artifacts_append_only BEFORE UPDATE OR DELETE ON public.epoch_close_artifacts FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();

INSERT INTO public.epoch_stage_gate_requirements(expected_stage,target_stage,gate_key,gate_type,override_allowed)
VALUES('reviewing','payout_readying','approved_close_package_ready','hard',false)
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.epoch_close_runtime_enabled(p_environment text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.epoch_close_runtime_controls control
    WHERE control.deployment_environment=lower(p_environment) AND control.close_posting_enabled AND NOT control.production_value_flow_enabled
  );
$$;

CREATE FUNCTION public.approve_epoch_allocation_close(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_run public.epoch_allocation_runs%ROWTYPE;
  v_manifest public.epoch_allocation_manifests%ROWTYPE;
  v_cycle public.monthly_cycles%ROWTYPE;
  v_state public.epoch_shadow_states%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_approval public.epoch_allocation_approvals%ROWTYPE;
  v_existing public.epoch_close_packages%ROWTYPE;
  v_award public.epoch_allocation_user_awards%ROWTYPE;
  v_disposition record;
  v_award_control_id bigint;
  v_ledger_id bigint;
  v_attempt_id bigint;
  v_sequence bigint;
  v_close_id bigint;
  v_artifact record;
  v_hash text;
  v_root_hash text;
  v_now timestamptz:=clock_timestamp();
  v_environment text:=lower(p_command->>'deploymentEnvironment');
BEGIN
  IF p_command->>'contractVersion'<>'epoch_allocation_close.v1' OR NOT public.epoch_close_runtime_enabled(v_environment)
    OR nullif(p_command->>'actorUserId','') IS NULL THEN RAISE EXCEPTION 'epoch_close_runtime_disabled'; END IF;
  SELECT * INTO v_run FROM public.epoch_allocation_runs WHERE id=(p_command->>'runId')::bigint FOR UPDATE;
  IF v_run.id IS NULL OR v_run.production_enabled THEN RAISE EXCEPTION 'epoch_close_run_unavailable'; END IF;
  SELECT * INTO v_manifest FROM public.epoch_allocation_manifests WHERE id=v_run.manifest_id FOR UPDATE;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id=v_manifest.monthly_cycle_id;
  IF v_manifest.status<>'calculated' OR v_manifest.manifest_hash<>p_command->>'manifestHash'
    OR v_run.result_hash<>p_command->>'resultHash' OR v_run.result_hash<>p_command->>'rerunResultHash'
  THEN RAISE EXCEPTION 'epoch_close_approved_result_mismatch'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-close:'||v_run.id::text,0));
  SELECT package.* INTO v_existing FROM public.epoch_close_packages package
  JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id WHERE approval.run_id=v_run.id;
  IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('closePackageId',v_existing.id,'rootHash',v_existing.root_hash,'status',v_existing.status); END IF;

  SELECT state.* INTO v_state FROM public.epoch_shadow_states state
  JOIN public.accounting_periods period ON period.id=state.accounting_period_id
  WHERE state.monthly_cycle_id=v_cycle.id FOR UPDATE OF state;
  SELECT period.* INTO v_period FROM public.accounting_periods period WHERE period.id=v_state.accounting_period_id;
  IF v_state.id IS NULL OR v_state.current_stage<>'reviewing' OR v_state.is_paused OR v_state.production_enabled
    OR v_period.status<>'open' OR v_period.production_enabled THEN RAISE EXCEPTION 'epoch_close_state_not_reviewing'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.epoch_project_packages package
    JOIN public.epoch_allocation_manifest_sources source ON source.project_id=package.project_id AND source.manifest_id=v_manifest.id
    WHERE package.canonical_cycle_id=v_cycle.id AND (package.status NOT IN('approved','silent_approved')
      OR (package.status='silent_approved' AND (package.reconciliation_deadline_at IS NULL OR package.reconciliation_deadline_at>v_now)))
  ) THEN RAISE EXCEPTION 'epoch_close_opt_out_window_open'; END IF;

  INSERT INTO public.epoch_allocation_approvals(run_id,manifest_hash,result_hash,rerun_result_hash,actor_user_id,deployment_environment)
  VALUES(v_run.id,v_manifest.manifest_hash,v_run.result_hash,p_command->>'rerunResultHash',(p_command->>'actorUserId')::uuid,v_environment)
  RETURNING * INTO v_approval;

  INSERT INTO public.epoch_provisional_award_controls(approval_id,run_award_id,monthly_cycle_id,user_id,retained_initial_minor,
    redistribution_top_up_minor,final_award_minor,minor_unit_cap,approved_result_hash)
  SELECT v_approval.id,award.id,v_cycle.id,award.user_id,award.retained_initial_minor,award.top_up_minor,award.final_minor,
    award.minor_unit_cap,v_run.result_hash FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id;

  FOR v_disposition IN
    SELECT disposition.*,source.project_id,source.source_lot_key,project.slug project_slug
    FROM public.epoch_allocation_source_dispositions disposition
    JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
    JOIN public.projects project ON project.id=source.project_id
    WHERE disposition.run_id=v_run.id AND disposition.disposition_kind IN('initial_retained','top_up','returned_residue')
      AND disposition.canonical_minor>0 ORDER BY disposition.stable_position,disposition.id
  LOOP
    v_award_control_id:=NULL;
    IF v_disposition.user_id IS NOT NULL THEN
      SELECT id INTO v_award_control_id FROM public.epoch_provisional_award_controls
      WHERE approval_id=v_approval.id AND user_id=v_disposition.user_id;
    END IF;
    v_hash:=encode(extensions.digest(convert_to(v_run.result_hash||':'||v_disposition.id::text||':'||v_disposition.disposition_kind,'UTF8'),'sha256'),'hex');
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
      'idempotencyKey','epoch-close:'||v_run.id::text||':disposition:'||v_disposition.id::text,
      'periodKey',v_period.period_key,'transactionType',CASE WHEN v_disposition.disposition_kind='returned_residue' THEN 'epoch_returned_residue' ELSE 'epoch_provisional_award' END,
      'evidenceHash',v_hash,'actorType','operator','actorUserId',p_command->>'actorUserId','effectiveAt',v_period.starts_at,
      'postings',CASE WHEN v_disposition.disposition_kind='returned_residue' THEN jsonb_build_array(
        jsonb_build_object('accountKey','epoch_returned_residue_control','side','debit','functionalUsdAmount',(v_disposition.canonical_minor/100)::text,'projectId',v_disposition.project_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',(v_disposition.canonical_minor/100)::text,'projectId',v_disposition.project_id)
      ) ELSE jsonb_build_array(
        jsonb_build_object('accountKey','epoch_provisional_award_control','side','debit','functionalUsdAmount',(v_disposition.canonical_minor/100)::text,'userId',v_disposition.user_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',(v_disposition.canonical_minor/100)::text,'projectId',v_disposition.project_id)
      ) END));
    INSERT INTO public.epoch_provisional_award_source_fills(award_control_id,approval_id,manifest_source_id,disposition_id,project_id,user_id,
      fill_kind,canonical_minor,exact_usd,ledger_transaction_id)
    VALUES(v_award_control_id,v_approval.id,v_disposition.manifest_source_id,v_disposition.id,v_disposition.project_id,v_disposition.user_id,
      v_disposition.disposition_kind,v_disposition.canonical_minor,v_disposition.exact_usd,v_ledger_id);
  END LOOP;

  INSERT INTO public.epoch_close_project_summaries(approval_id,monthly_cycle_id,project_id,funded_minor,cohort_count,
    theoretical_share_exact_usd,initial_claim_exact_usd,score_pool_contribution_exact_usd,source_count)
  SELECT v_approval.id,v_cycle.id,project.id,
    coalesce((SELECT sum(source.canonical_minor_capacity) FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id),0),
    (SELECT count(*) FROM public.epoch_allocation_manifest_cohort cohort WHERE cohort.manifest_id=v_manifest.id AND cohort.project_id=project.id),
    coalesce((SELECT sum((claim->>'theoreticalShareExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    coalesce((SELECT sum((claim->>'initialClaimExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    coalesce((SELECT sum((claim->>'scorePoolContributionExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    (SELECT count(*) FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id)
  FROM public.projects project WHERE EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id);

  INSERT INTO public.epoch_close_packages(approval_id,monthly_cycle_id,shadow_state_id,manifest_hash,result_hash,root_hash,user_count,
    funded_minor,final_allocation_minor,redistribution_pool_minor,top_up_minor,returned_residue_minor)
  VALUES(v_approval.id,v_cycle.id,v_state.id,v_manifest.manifest_hash,v_run.result_hash,repeat('0',64),
    (SELECT count(*) FROM public.epoch_provisional_award_controls WHERE approval_id=v_approval.id),v_run.funded_minor,v_run.final_allocation_minor,
    v_run.score_pool_minor+v_run.overlap_pool_minor,v_run.top_up_minor,v_run.returned_residue_minor) RETURNING id INTO v_close_id;

  FOR v_artifact IN SELECT * FROM (VALUES
    ('allocation_result','operator',v_run.artifact),
    ('trial_balance','operator',(SELECT coalesce(jsonb_agg(row_to_json(balance)::jsonb ORDER BY balance.ledger_transaction_id,balance.account_id),'[]'::jsonb)
      FROM public.shadow_ledger_trial_balance balance JOIN public.ledger_transactions transaction ON transaction.id=balance.ledger_transaction_id
      WHERE transaction.idempotency_key LIKE 'epoch-close:'||v_run.id::text||':%')),
    ('custody','operator',(SELECT coalesce(jsonb_agg(jsonb_build_object('sourceLotKey',source.source_lot_key,'railKey',source.rail_key,
      'assetId',source.financial_asset_id,'custodyAccountId',source.custody_account_id,'nativeAtomicAmount',source.native_atomic_amount::text,
      'fxSnapshotId',source.fx_snapshot_id,'exactUsd',source.exact_usd::text) ORDER BY source.source_order,source.id),'[]'::jsonb)
      FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id)),
    ('project_funds','project_aggregate',(SELECT coalesce(jsonb_agg(to_jsonb(summary)-'id'-'approval_id'-'created_at' ORDER BY summary.project_id),'[]'::jsonb)
      FROM public.epoch_close_project_summaries summary WHERE summary.approval_id=v_approval.id)),
    ('fees','operator',(SELECT coalesce(jsonb_agg(jsonb_build_object('sourceLotKey',lot.source_lot_key,'grossExactUsd',lot.gross_exact_usd::text,
      'projectFeeExactUsd',lot.project_fee_exact_usd::text,'baseFeeExactUsd',lot.base_fee_exact_usd::text,'distributableExactUsd',lot.distributable_exact_usd::text)
      ORDER BY lot.deterministic_source_order,lot.id),'[]'::jsonb) FROM public.epoch_valuation_source_lots lot
      JOIN public.epoch_allocation_manifest_sources source ON source.source_lot_id=lot.id WHERE source.manifest_id=v_manifest.id)),
    ('fx','operator',(SELECT coalesce(jsonb_agg(jsonb_build_object('snapshotId',fx.id,'assetId',fx.financial_asset_id,'method',fx.method,
      'rateUsdPerUnit',fx.rate_usd_per_unit::text,'evidenceHash',fx.evidence_hash) ORDER BY fx.id),'[]'::jsonb)
      FROM public.epoch_fx_snapshots fx WHERE fx.id IN(SELECT source.fx_snapshot_id FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id))),
    ('carryover','operator',(SELECT coalesce(jsonb_agg(to_jsonb(fill)-'id'-'approval_id'-'award_control_id'-'ledger_transaction_id'-'created_at' ORDER BY fill.id),'[]'::jsonb)
      FROM public.epoch_provisional_award_source_fills fill WHERE fill.approval_id=v_approval.id AND fill.fill_kind='returned_residue')),
    ('initial_claims','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,'projectClaims',award.project_claims,
      'retainedInitialMinor',award.retained_initial_minor::text) ORDER BY award.user_id),'[]'::jsonb) FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('redistribution_pool','public_aggregate',jsonb_build_object('scorePoolMinor',v_run.score_pool_minor::text,'overlapPoolMinor',v_run.overlap_pool_minor::text,
      'poolMinor',(v_run.score_pool_minor+v_run.overlap_pool_minor)::text,'topUpMinor',v_run.top_up_minor::text,'returnedResidueMinor',v_run.returned_residue_minor::text)),
    ('top_ups','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,'topUpMinor',award.top_up_minor::text) ORDER BY award.user_id),'[]'::jsonb)
      FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('provisional_awards','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',control.user_id,'finalAwardMinor',control.final_award_minor::text,
      'payableStatus',control.payable_status,'ownershipStatus',control.ownership_status) ORDER BY control.user_id),'[]'::jsonb)
      FROM public.epoch_provisional_award_controls control WHERE control.approval_id=v_approval.id)),
    ('exceptions','operator',jsonb_build_object('returnedResidueMinor',v_run.returned_residue_minor::text,'hasReturnedResidue',v_run.returned_residue_minor>0))
  ) artifact_rows(artifact_key,audience,artifact)
  LOOP
    v_hash:=encode(extensions.digest(convert_to(v_artifact.artifact::text,'UTF8'),'sha256'),'hex');
    INSERT INTO public.epoch_close_artifacts(close_package_id,artifact_key,audience,artifact,artifact_hash)
    VALUES(v_close_id,v_artifact.artifact_key,v_artifact.audience,v_artifact.artifact,v_hash);
  END LOOP;
  SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object('artifactKey',artifact_key,'artifactHash',artifact_hash)
    ORDER BY artifact_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') INTO v_root_hash
  FROM public.epoch_close_artifacts WHERE close_package_id=v_close_id;

  SELECT coalesce(max(attempt_sequence),0)+1 INTO v_sequence FROM public.epoch_stage_attempts WHERE shadow_state_id=v_state.id;
  INSERT INTO public.epoch_stage_attempts(shadow_state_id,target_stage,expected_stage,expected_state_version,attempt_sequence,idempotency_key,
    input_manifest_hash,trigger_type,actor_user_id,status,scheduled_for,completed_at,sanitized_metadata)
  VALUES(v_state.id,'payout_readying','reviewing',v_state.state_version,v_sequence,'epoch-close:'||v_run.id::text,v_root_hash,'manual',
    (p_command->>'actorUserId')::uuid,'succeeded',v_now,v_now,jsonb_build_object('closePackageId',v_close_id,'noPayable',true,'noValueFlow',true))
  RETURNING id INTO v_attempt_id;
  INSERT INTO public.epoch_stage_gate_results(attempt_id,gate_key,gate_type,passed,evidence_hash) VALUES
    (v_attempt_id,'opt_out_window_closed','hard',true,encode(extensions.digest(convert_to(v_run.result_hash||':opt-out-closed','UTF8'),'sha256'),'hex')),
    (v_attempt_id,'approved_close_package_ready','hard',true,v_root_hash);
  INSERT INTO public.epoch_stage_artifacts(attempt_id,artifact_key,artifact_uri,artifact_hash)
  VALUES(v_attempt_id,'approved_close_package','artifact://epoch-close/'||v_close_id::text,v_root_hash);
  UPDATE public.epoch_shadow_states SET current_stage='payout_readying',state_version=state_version+1,stage_ready_at=NULL,updated_at=v_now
  WHERE id=v_state.id AND current_stage='reviewing' AND state_version=v_state.state_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'epoch_close_state_changed'; END IF;
  UPDATE public.epoch_close_packages SET stage_attempt_id=v_attempt_id,root_hash=v_root_hash WHERE id=v_close_id;
  RETURN jsonb_build_object('closePackageId',v_close_id,'approvalId',v_approval.id,'rootHash',v_root_hash,'status','payout_readying');
END; $$;

CREATE VIEW public.epoch_close_operator_view WITH(security_invoker=true) AS
SELECT cycle.cycle_key,package.id close_package_id,package.status,package.root_hash,package.manifest_hash,package.result_hash,
  package.user_count,package.funded_minor,package.final_allocation_minor,package.redistribution_pool_minor,package.top_up_minor,
  package.returned_residue_minor,approval.actor_user_id,approval.approved_at,count(artifact.id) artifact_count,
  bool_and(NOT package.production_enabled) provisional_only
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id
LEFT JOIN public.epoch_close_artifacts artifact ON artifact.close_package_id=package.id
GROUP BY cycle.cycle_key,package.id,approval.id;

CREATE VIEW public.epoch_close_public_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,package.status,package.root_hash,package.funded_minor,package.final_allocation_minor,
  package.redistribution_pool_minor,package.top_up_minor,package.returned_residue_minor,
  CASE WHEN package.user_count>=3 THEN package.user_count ELSE NULL END published_user_count,
  package.created_at
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
WHERE NOT package.production_enabled;

CREATE VIEW public.epoch_close_public_project_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,project.slug project_slug,package.root_hash,package.status,summary.funded_minor,
  CASE WHEN summary.cohort_count>=3 THEN summary.cohort_count ELSE NULL END published_cohort_count,
  summary.source_count,package.created_at
FROM public.epoch_close_project_summaries summary
JOIN public.epoch_close_packages package ON package.approval_id=summary.approval_id
JOIN public.monthly_cycles cycle ON cycle.id=summary.monthly_cycle_id
JOIN public.projects project ON project.id=summary.project_id
WHERE NOT package.production_enabled;

CREATE FUNCTION public.read_epoch_close_scope(p_actor_user_id uuid,p_scope text,p_cycle_key text,p_project_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle_id bigint; v_result jsonb;
BEGIN
  SELECT id INTO v_cycle_id FROM public.monthly_cycles WHERE cycle_key=p_cycle_key;
  IF p_scope='user' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('cycleKey',p_cycle_key,'rootHash',package.root_hash,'status',package.status,
      'retainedInitialMinor',control.retained_initial_minor::text,'topUpMinor',control.redistribution_top_up_minor::text,
      'finalAwardMinor',control.final_award_minor::text,'minorUnitCap',control.minor_unit_cap::text,
      'payableStatus',control.payable_status,'ownershipStatus',control.ownership_status,'assetEligibilityStatus',control.asset_eligibility_status)),'[]'::jsonb)
    INTO v_result FROM public.epoch_provisional_award_controls control
    JOIN public.epoch_allocation_approvals approval ON approval.id=control.approval_id
    JOIN public.epoch_close_packages package ON package.approval_id=approval.id
    WHERE control.monthly_cycle_id=v_cycle_id AND control.user_id=p_actor_user_id;
  ELSIF p_scope='project' THEN
    IF p_project_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.participants participant
      WHERE participant.project_id=p_project_id AND participant.user_id=p_actor_user_id AND participant.is_admin)
    THEN RAISE EXCEPTION 'epoch_close_project_forbidden'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('cycleKey',p_cycle_key,'projectId',summary.project_id,'rootHash',package.root_hash,
      'status',package.status,'fundedMinor',summary.funded_minor::text,'cohortCount',summary.cohort_count,
      'theoreticalShareExactUsd',summary.theoretical_share_exact_usd::text,'initialClaimExactUsd',summary.initial_claim_exact_usd::text,
      'scorePoolContributionExactUsd',summary.score_pool_contribution_exact_usd::text,'sourceCount',summary.source_count)),'[]'::jsonb)
    INTO v_result FROM public.epoch_close_project_summaries summary
    JOIN public.epoch_allocation_approvals approval ON approval.id=summary.approval_id
    JOIN public.epoch_close_packages package ON package.approval_id=approval.id
    WHERE summary.monthly_cycle_id=v_cycle_id AND summary.project_id=p_project_id;
  ELSE RAISE EXCEPTION 'epoch_close_scope_invalid'; END IF;
  RETURN coalesce(v_result,'[]'::jsonb);
END; $$;

ALTER TABLE public.epoch_close_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_provisional_award_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_provisional_award_source_fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_close_project_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_close_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_close_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epoch_close_runtime_controls,public.epoch_allocation_approvals,public.epoch_provisional_award_controls,
  public.epoch_provisional_award_source_fills,public.epoch_close_project_summaries,public.epoch_close_packages,public.epoch_close_artifacts,
  public.epoch_close_operator_view FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_close_runtime_controls,public.epoch_allocation_approvals,public.epoch_provisional_award_controls,
  public.epoch_provisional_award_source_fills,public.epoch_close_project_summaries,public.epoch_close_packages,public.epoch_close_artifacts,
  public.epoch_close_operator_view TO service_role;
REVOKE ALL ON TABLE public.epoch_close_public_view,public.epoch_close_public_project_view FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_close_public_view,public.epoch_close_public_project_view TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.epoch_close_runtime_enabled(text),public.approve_epoch_allocation_close(jsonb),
  public.read_epoch_close_scope(uuid,text,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.epoch_close_runtime_enabled(text),public.approve_epoch_allocation_close(jsonb),
  public.read_epoch_close_scope(uuid,text,text,bigint) TO service_role;
