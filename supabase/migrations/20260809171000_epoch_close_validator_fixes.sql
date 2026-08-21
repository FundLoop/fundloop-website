ALTER TABLE public.epoch_provisional_award_source_fills
  DROP CONSTRAINT epoch_award_source_fill_amount,
  ADD CONSTRAINT epoch_award_source_fill_amount CHECK(canonical_minor>=0 AND exact_usd>0);

ALTER TABLE public.epoch_close_packages
  DROP CONSTRAINT epoch_close_package_state,
  ALTER COLUMN status SET DEFAULT 'root_review_required',
  ADD CONSTRAINT epoch_close_package_state CHECK(status IN ('root_review_required','payout_readying'));

CREATE TABLE public.epoch_close_root_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id bigint NOT NULL UNIQUE REFERENCES public.epoch_allocation_approvals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  close_package_id bigint NOT NULL UNIQUE REFERENCES public.epoch_close_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  root_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.epoch_close_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_close_root_approval_hash CHECK(root_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_close_root_approval_production_disabled CHECK(production_enabled=false)
);

CREATE TRIGGER epoch_close_root_approvals_append_only
BEFORE UPDATE OR DELETE ON public.epoch_close_root_approvals
FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_close_record_mutation();

CREATE OR REPLACE FUNCTION public.prevent_epoch_close_package_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.root_hash=repeat('0',64) AND NEW.root_hash ~ '^[0-9a-f]{64}$'
    AND NEW.root_hash<>repeat('0',64) AND OLD.stage_attempt_id IS NULL AND NEW.stage_attempt_id IS NULL
    AND OLD.status='root_review_required' AND NEW.status='root_review_required'
    AND (to_jsonb(NEW)-'root_hash')=(to_jsonb(OLD)-'root_hash')
  THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.root_hash=NEW.root_hash AND OLD.stage_attempt_id IS NULL AND NEW.stage_attempt_id IS NOT NULL
    AND OLD.status='root_review_required' AND NEW.status='payout_readying'
    AND (to_jsonb(NEW)-'stage_attempt_id'-'status')=(to_jsonb(OLD)-'stage_attempt_id'-'status')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'epoch_close_records_are_append_only';
END; $$;

CREATE OR REPLACE FUNCTION public.approve_epoch_allocation_close(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_run public.epoch_allocation_runs%ROWTYPE;
  v_manifest public.epoch_allocation_manifests%ROWTYPE;
  v_cycle public.monthly_cycles%ROWTYPE;
  v_state public.epoch_shadow_states%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_approval public.epoch_allocation_approvals%ROWTYPE;
  v_existing public.epoch_close_packages%ROWTYPE;
  v_disposition record;
  v_award_control_id bigint;
  v_ledger_id bigint;
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
  IF EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_sources source
    LEFT JOIN public.epoch_allocation_source_dispositions disposition
      ON disposition.manifest_source_id=source.id AND disposition.run_id=v_run.id
      AND disposition.disposition_kind IN('initial_retained','top_up','returned_residue')
    WHERE source.manifest_id=v_manifest.id GROUP BY source.id,source.exact_usd
    HAVING coalesce(sum(disposition.exact_usd),0)<>source.exact_usd
  ) THEN RAISE EXCEPTION 'epoch_close_exact_source_conservation_failed'; END IF;

  INSERT INTO public.epoch_allocation_approvals(run_id,manifest_hash,result_hash,rerun_result_hash,actor_user_id,deployment_environment)
  VALUES(v_run.id,v_manifest.manifest_hash,v_run.result_hash,p_command->>'rerunResultHash',(p_command->>'actorUserId')::uuid,v_environment)
  RETURNING * INTO v_approval;

  INSERT INTO public.epoch_provisional_award_controls(approval_id,run_award_id,monthly_cycle_id,user_id,retained_initial_minor,
    redistribution_top_up_minor,final_award_minor,minor_unit_cap,approved_result_hash)
  SELECT v_approval.id,award.id,v_cycle.id,award.user_id,award.retained_initial_minor,award.top_up_minor,award.final_minor,
    award.minor_unit_cap,v_run.result_hash FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id;

  FOR v_disposition IN
    SELECT disposition.*,source.project_id,source.source_lot_key
    FROM public.epoch_allocation_source_dispositions disposition
    JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
    WHERE disposition.run_id=v_run.id AND disposition.disposition_kind IN('initial_retained','top_up','returned_residue')
      AND disposition.exact_usd>0 ORDER BY disposition.stable_position,disposition.id
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
        jsonb_build_object('accountKey','epoch_returned_residue_control','side','debit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id)
      ) ELSE jsonb_build_array(
        jsonb_build_object('accountKey','epoch_provisional_award_control','side','debit','functionalUsdAmount',v_disposition.exact_usd::text,'userId',v_disposition.user_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id)
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

  INSERT INTO public.epoch_close_packages(approval_id,monthly_cycle_id,shadow_state_id,manifest_hash,result_hash,root_hash,status,user_count,
    funded_minor,final_allocation_minor,redistribution_pool_minor,top_up_minor,returned_residue_minor)
  VALUES(v_approval.id,v_cycle.id,v_state.id,v_manifest.manifest_hash,v_run.result_hash,repeat('0',64),'root_review_required',
    (SELECT count(*) FROM public.epoch_provisional_award_controls WHERE approval_id=v_approval.id),v_run.funded_minor,v_run.final_allocation_minor,
    v_run.score_pool_minor+v_run.overlap_pool_minor,v_run.top_up_minor,v_run.returned_residue_minor) RETURNING id INTO v_close_id;

  FOR v_artifact IN SELECT * FROM (VALUES
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
    ('carryover','operator',(SELECT coalesce(jsonb_agg(jsonb_build_object('sourceLotKey',source.source_lot_key,'exactUsd',source.exact_usd::text,
      'canonicalMinorCapacity',source.canonical_minor_capacity::text) ORDER BY source.source_order,source.id),'[]'::jsonb)
      FROM public.epoch_allocation_manifest_sources source JOIN public.epoch_valuation_source_lots lot ON lot.id=source.source_lot_id
      WHERE source.manifest_id=v_manifest.id AND lot.source_kind='carryover')),
    ('initial_claims','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,'projectClaims',award.project_claims,
      'retainedInitialMinor',award.retained_initial_minor::text) ORDER BY award.user_id),'[]'::jsonb) FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('redistribution_pool','public_aggregate',jsonb_build_object('scorePoolMinor',v_run.score_pool_minor::text,'overlapPoolMinor',v_run.overlap_pool_minor::text,
      'poolMinor',(v_run.score_pool_minor+v_run.overlap_pool_minor)::text,'topUpMinor',v_run.top_up_minor::text,'returnedResidueMinor',v_run.returned_residue_minor::text)),
    ('top_ups','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,'topUpMinor',award.top_up_minor::text) ORDER BY award.user_id),'[]'::jsonb)
      FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('returned_residue','operator',(SELECT coalesce(jsonb_agg(jsonb_build_object('sourceLotKey',source.source_lot_key,'projectId',fill.project_id,
      'canonicalMinor',fill.canonical_minor::text,'exactUsd',fill.exact_usd::text,'ledgerTransactionId',fill.ledger_transaction_id) ORDER BY fill.id),'[]'::jsonb)
      FROM public.epoch_provisional_award_source_fills fill JOIN public.epoch_allocation_manifest_sources source ON source.id=fill.manifest_source_id
      WHERE fill.approval_id=v_approval.id AND fill.fill_kind='returned_residue')),
    ('provisional_awards','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',control.user_id,'finalAwardMinor',control.final_award_minor::text,
      'payableStatus',control.payable_status,'ownershipStatus',control.ownership_status) ORDER BY control.user_id),'[]'::jsonb)
      FROM public.epoch_provisional_award_controls control WHERE control.approval_id=v_approval.id)),
    ('exceptions','operator',jsonb_build_object('returnedResidueMinor',v_run.returned_residue_minor::text,
      'returnedResidueExactUsd',(SELECT coalesce(sum(fill.exact_usd),0)::text FROM public.epoch_provisional_award_source_fills fill
        WHERE fill.approval_id=v_approval.id AND fill.fill_kind='returned_residue')))
  ) artifact_rows(artifact_key,audience,artifact)
  LOOP
    v_hash:=encode(extensions.digest(convert_to(v_artifact.artifact::text,'UTF8'),'sha256'),'hex');
    INSERT INTO public.epoch_close_artifacts(close_package_id,artifact_key,audience,artifact,artifact_hash)
    VALUES(v_close_id,v_artifact.artifact_key,v_artifact.audience,v_artifact.artifact,v_hash);
  END LOOP;
  SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object('artifactKey',artifact_key,'artifactHash',artifact_hash)
    ORDER BY artifact_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') INTO v_root_hash
  FROM public.epoch_close_artifacts WHERE close_package_id=v_close_id;
  UPDATE public.epoch_close_packages SET root_hash=v_root_hash WHERE id=v_close_id;
  RETURN jsonb_build_object('closePackageId',v_close_id,'approvalId',v_approval.id,'rootHash',v_root_hash,'status','root_review_required');
END; $$;

CREATE FUNCTION public.confirm_epoch_allocation_close_root(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_package public.epoch_close_packages%ROWTYPE;
  v_approval public.epoch_allocation_approvals%ROWTYPE;
  v_state public.epoch_shadow_states%ROWTYPE;
  v_existing public.epoch_close_root_approvals%ROWTYPE;
  v_attempt_id bigint;
  v_sequence bigint;
  v_now timestamptz:=clock_timestamp();
  v_environment text:=lower(p_command->>'deploymentEnvironment');
BEGIN
  IF p_command->>'contractVersion'<>'epoch_allocation_close_root.v1' OR NOT public.epoch_close_runtime_enabled(v_environment)
    OR nullif(p_command->>'actorUserId','') IS NULL OR nullif(p_command->>'rootHash','') IS NULL
  THEN RAISE EXCEPTION 'epoch_close_root_runtime_disabled'; END IF;
  SELECT package.* INTO v_package FROM public.epoch_close_packages package
  WHERE package.id=(p_command->>'closePackageId')::bigint FOR UPDATE;
  IF v_package.id IS NULL OR v_package.production_enabled OR v_package.root_hash<>p_command->>'rootHash'
  THEN RAISE EXCEPTION 'epoch_close_root_mismatch'; END IF;
  SELECT * INTO v_approval FROM public.epoch_allocation_approvals WHERE id=v_package.approval_id;
  IF v_approval.actor_user_id<>(p_command->>'actorUserId')::uuid OR v_approval.deployment_environment<>v_environment
  THEN RAISE EXCEPTION 'epoch_close_root_actor_mismatch'; END IF;
  SELECT * INTO v_existing FROM public.epoch_close_root_approvals WHERE close_package_id=v_package.id;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.root_hash<>v_package.root_hash OR v_existing.actor_user_id<>v_approval.actor_user_id
    THEN RAISE EXCEPTION 'epoch_close_root_approval_conflict'; END IF;
    RETURN jsonb_build_object('closePackageId',v_package.id,'approvalId',v_approval.id,'rootHash',v_package.root_hash,'status',v_package.status);
  END IF;
  SELECT * INTO v_state FROM public.epoch_shadow_states WHERE id=v_package.shadow_state_id FOR UPDATE;
  IF v_package.status<>'root_review_required' OR v_package.stage_attempt_id IS NOT NULL OR v_state.current_stage<>'reviewing'
    OR v_state.is_paused OR v_state.production_enabled THEN RAISE EXCEPTION 'epoch_close_root_not_reviewable'; END IF;
  INSERT INTO public.epoch_close_root_approvals(approval_id,close_package_id,root_hash,actor_user_id,deployment_environment)
  VALUES(v_approval.id,v_package.id,v_package.root_hash,v_approval.actor_user_id,v_environment);
  SELECT coalesce(max(attempt_sequence),0)+1 INTO v_sequence FROM public.epoch_stage_attempts WHERE shadow_state_id=v_state.id;
  INSERT INTO public.epoch_stage_attempts(shadow_state_id,target_stage,expected_stage,expected_state_version,attempt_sequence,idempotency_key,
    input_manifest_hash,trigger_type,actor_user_id,status,scheduled_for,completed_at,sanitized_metadata)
  VALUES(v_state.id,'payout_readying','reviewing',v_state.state_version,v_sequence,'epoch-close-root:'||v_package.id::text,v_package.root_hash,'manual',
    v_approval.actor_user_id,'succeeded',v_now,v_now,jsonb_build_object('closePackageId',v_package.id,'rootApproved',true,'noPayable',true,'noValueFlow',true))
  RETURNING id INTO v_attempt_id;
  INSERT INTO public.epoch_stage_gate_results(attempt_id,gate_key,gate_type,passed,evidence_hash) VALUES
    (v_attempt_id,'opt_out_window_closed','hard',true,encode(extensions.digest(convert_to(v_package.result_hash||':opt-out-closed','UTF8'),'sha256'),'hex')),
    (v_attempt_id,'approved_close_package_ready','hard',true,v_package.root_hash);
  INSERT INTO public.epoch_stage_artifacts(attempt_id,artifact_key,artifact_uri,artifact_hash)
  VALUES(v_attempt_id,'approved_close_package','artifact://epoch-close/'||v_package.id::text,v_package.root_hash);
  UPDATE public.epoch_shadow_states SET current_stage='payout_readying',state_version=state_version+1,stage_ready_at=NULL,updated_at=v_now
  WHERE id=v_state.id AND current_stage='reviewing' AND state_version=v_state.state_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'epoch_close_state_changed'; END IF;
  UPDATE public.epoch_close_packages SET stage_attempt_id=v_attempt_id,status='payout_readying' WHERE id=v_package.id;
  RETURN jsonb_build_object('closePackageId',v_package.id,'approvalId',v_approval.id,'rootHash',v_package.root_hash,'status','payout_readying');
END; $$;

CREATE OR REPLACE VIEW public.epoch_close_operator_view WITH(security_invoker=true) AS
SELECT cycle.cycle_key,package.id close_package_id,package.status,package.root_hash,package.manifest_hash,package.result_hash,
  package.user_count,package.funded_minor,package.final_allocation_minor,package.redistribution_pool_minor,package.top_up_minor,
  package.returned_residue_minor,approval.actor_user_id,approval.approved_at,
  count(artifact.id) artifact_count,bool_and(NOT package.production_enabled) provisional_only,root_approval.approved_at root_approved_at
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id
LEFT JOIN public.epoch_close_root_approvals root_approval ON root_approval.close_package_id=package.id
LEFT JOIN public.epoch_close_artifacts artifact ON artifact.close_package_id=package.id
GROUP BY cycle.cycle_key,package.id,approval.id,root_approval.id;

CREATE OR REPLACE VIEW public.epoch_close_public_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,package.status,
  CASE WHEN package.user_count>=3 THEN package.root_hash ELSE NULL END root_hash,
  CASE WHEN package.user_count>=3 THEN package.funded_minor ELSE NULL END::numeric(78,0) funded_minor,
  CASE WHEN package.user_count>=3 THEN package.final_allocation_minor ELSE NULL END::numeric(78,0) final_allocation_minor,
  CASE WHEN package.user_count>=3 THEN package.redistribution_pool_minor ELSE NULL END::numeric(78,0) redistribution_pool_minor,
  CASE WHEN package.user_count>=3 THEN package.top_up_minor ELSE NULL END::numeric(78,0) top_up_minor,
  CASE WHEN package.user_count>=3 THEN package.returned_residue_minor ELSE NULL END::numeric(78,0) returned_residue_minor,
  CASE WHEN package.user_count>=3 THEN package.user_count ELSE NULL END published_user_count,package.created_at
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
WHERE NOT package.production_enabled AND package.status='payout_readying';

CREATE OR REPLACE VIEW public.epoch_close_public_project_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,project.slug project_slug,
  CASE WHEN summary.cohort_count>=3 THEN package.root_hash ELSE NULL END root_hash,package.status,
  CASE WHEN summary.cohort_count>=3 THEN summary.funded_minor ELSE NULL END::numeric(78,0) funded_minor,
  CASE WHEN summary.cohort_count>=3 THEN summary.cohort_count ELSE NULL END published_cohort_count,
  CASE WHEN summary.cohort_count>=3 THEN summary.source_count ELSE NULL END source_count,package.created_at
FROM public.epoch_close_project_summaries summary
JOIN public.epoch_close_packages package ON package.approval_id=summary.approval_id
JOIN public.monthly_cycles cycle ON cycle.id=summary.monthly_cycle_id
JOIN public.projects project ON project.id=summary.project_id
WHERE NOT package.production_enabled AND package.status='payout_readying';

REVOKE ALL ON TABLE public.epoch_close_root_approvals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_close_root_approvals TO service_role;
REVOKE ALL ON FUNCTION public.confirm_epoch_allocation_close_root(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_epoch_allocation_close_root(jsonb) TO service_role;
