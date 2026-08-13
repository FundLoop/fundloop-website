\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_actor uuid := '290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_april bigint;
  v_march bigint;
  v_june bigint;
  v_july bigint;
  v_close public.epoch_close_packages%ROWTYPE;
  v_preview jsonb;
  v_locked jsonb;
  v_replay jsonb;
  v_before numeric;
  v_harvest numeric;
  v_carry numeric;
  v_failed boolean := false;
BEGIN
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES
    ('2026-03',2026,3,'2026-03-01','2026-03-31','completed'),
    ('2026-04',2026,4,'2026-04-01','2026-04-30','completed'),
    ('2026-05',2026,5,'2026-05-01','2026-05-31','completed'),
    ('2026-06',2026,6,'2026-06-01','2026-06-30','completed')
  ON CONFLICT(cycle_key) DO UPDATE SET period_start=excluded.period_start,period_end=excluded.period_end,status=excluded.status;
  SELECT id INTO STRICT v_march FROM public.monthly_cycles WHERE cycle_key='2026-03';
  SELECT id INTO STRICT v_april FROM public.monthly_cycles WHERE cycle_key='2026-04';
  SELECT id INTO STRICT v_june FROM public.monthly_cycles WHERE cycle_key='2026-06';
  SELECT id INTO STRICT v_july FROM public.monthly_cycles WHERE cycle_key='2026-07';

  SELECT package.* INTO STRICT v_close FROM public.epoch_close_packages package
  JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id
  WHERE package.monthly_cycle_id=v_july AND approval.actor_user_id=v_actor
  ORDER BY package.id DESC LIMIT 1;
  PERFORM public.confirm_epoch_allocation_close_root(jsonb_build_object(
    'contractVersion','epoch_allocation_close_root.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'closePackageId',v_close.id,'rootHash',v_close.root_hash));
  PERFORM public.prepare_epoch_withdrawal_obligations(v_close.id,v_actor,'local');

  -- Shift only the fixture claim-window coordinate to E-3. Immutable source
  -- fill, close root, project, rail, asset, custody, FX and evidence hashes stay
  -- linked exactly to the integrated source rows.
  UPDATE public.user_withdrawal_obligations obligation SET monthly_cycle_id=v_march,source_expires_after_cycle_id=v_june
  WHERE obligation.source_award_control_id IN (
    SELECT control.id FROM public.epoch_provisional_award_controls control WHERE control.approval_id=v_close.approval_id);
  UPDATE public.payout_inventory_lots lot SET monthly_cycle_id=v_march,expires_after_cycle_id=v_june
  WHERE lot.obligation_id IN (SELECT id FROM public.user_withdrawal_obligations WHERE monthly_cycle_id=v_march);

  -- Re-coordinate the fixture's current funded source from its certified July
  -- close into E without changing any financial provenance field.
  INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,origin_source_lot_id,project_id,monthly_cycle_id,
    source_position,source_kind,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,
    fee_ledger_transaction_id,native_atomic_amount,source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,
    project_fee_bps,project_fee_exact_usd,base_fee_bps,base_fee_exact_usd,distributable_exact_usd,canonical_minor_unit_scale,
    deterministic_source_order,project_fee_assessed_once,classification_status,state,expires_after_cycle_id,reserved_exact_usd,
    evidence_hash,deployment_environment,production_enabled)
  SELECT 'lifecycle:2026-06:'||lot.id,lot.package_id,lot.id,lot.project_id,v_june,lot.source_position,lot.source_kind,
    lot.rail_key,lot.financial_asset_id,lot.custody_account_id,lot.fx_snapshot_id,lot.fee_policy_id,lot.fee_ledger_transaction_id,
    lot.native_atomic_amount,lot.source_preliminary_exact_usd,lot.gross_exact_usd,lot.fx_difference_exact_usd,
    lot.project_fee_bps,lot.project_fee_exact_usd,lot.base_fee_bps,lot.base_fee_exact_usd,lot.distributable_exact_usd,
    lot.canonical_minor_unit_scale,lot.deterministic_source_order,lot.project_fee_assessed_once,lot.classification_status,
    'ready_for_lock',v_june,0,lot.evidence_hash,lot.deployment_environment,false
  FROM public.epoch_valuation_source_lots lot
  WHERE lot.id IN (SELECT source_lot_id FROM public.epoch_allocation_manifest_sources source
    JOIN public.epoch_allocation_manifests manifest ON manifest.id=source.manifest_id WHERE manifest.monthly_cycle_id=v_july);
  UPDATE public.epoch_project_packages package
  SET canonical_cycle_id=v_june,funding_status='settled'
  WHERE package.id IN (SELECT lot.package_id FROM public.epoch_valuation_source_lots lot WHERE lot.monthly_cycle_id=v_june);

  -- Carry-out from the integrated close is the explicit carry-in lane for E.
  UPDATE public.epoch_redistribution_pool_sources
  SET target_monthly_cycle_id=v_june,origin_monthly_cycle_id=v_march
  WHERE origin_kind='carryforward_residue';

  IF (SELECT count(*) FROM public.monthly_cycles WHERE cycle_key IN('2026-03','2026-04','2026-05','2026-06'))<>4
    OR NOT EXISTS(SELECT 1 FROM public.payout_inventory_lots lot JOIN public.epoch_provisional_award_source_fills fill ON fill.id=lot.source_fill_id
      WHERE lot.monthly_cycle_id=v_march)
  THEN RAISE EXCEPTION 'four_epoch_fixture_or_exact_provenance_missing'; END IF;

  SELECT coalesce(sum(balance.available_minor),0) INTO v_before FROM public.user_withdrawal_obligation_balances balance
  JOIN public.user_withdrawal_obligations obligation ON obligation.id=balance.id WHERE obligation.monthly_cycle_id=v_march;
  v_preview:=public.epoch_allocation_v2_preview_input('2026-06',1.50,'local');
  SELECT coalesce(sum((source.value->>'canonicalMinorCapacity')::numeric)
    FILTER(WHERE source.value->>'originKind'='harvested_unclaimed'),0),
    coalesce(sum((source.value->>'canonicalMinorCapacity')::numeric)
    FILTER(WHERE source.value->>'originKind'='carryforward_residue'),0)
  INTO v_harvest,v_carry FROM jsonb_array_elements(v_preview->'redistributionSources') source(value);
  IF v_preview->>'originCycleKey'<>'2026-03'
    OR jsonb_array_length(v_preview->'projectSources')=0 OR v_harvest<=0 OR v_carry<=0
    OR v_harvest<>v_before
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_preview->'redistributionSources') source(value)
      WHERE source.value->>'originCycleKey'<>'2026-03')
  THEN RAISE EXCEPTION 'e_minus_3_selection_or_current_harvest_carry_conservation_failed origin=% projects=% harvest=% carry=% before=% sources=%',
    v_preview->>'originCycleKey',jsonb_array_length(v_preview->'projectSources'),v_harvest,v_carry,v_before,v_preview->'redistributionSources'; END IF;

  v_locked:=public.lock_funded_epoch_allocation_v2(jsonb_build_object(
    'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local','actorUserId',v_actor,
    'cycleKey','2026-06','capMultiple','1.50','selectedPreviewHash',v_preview->>'inputHash'));
  v_replay:=public.lock_funded_epoch_allocation_v2(jsonb_build_object(
    'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local','actorUserId',v_actor,
    'cycleKey','2026-06','capMultiple','1.50','selectedPreviewHash',v_preview->>'inputHash'));
  IF v_locked->>'manifestHash'<>v_replay->>'manifestHash'
    OR (SELECT harvested_unclaimed_minor FROM public.epoch_allocation_manifests WHERE id=(v_locked->>'manifestId')::bigint)<>v_harvest
    OR (SELECT carry_in_minor FROM public.epoch_allocation_manifests WHERE id=(v_locked->>'manifestId')::bigint)<>v_carry
    OR EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_balances balance
      JOIN public.user_withdrawal_obligations obligation ON obligation.id=balance.id
      WHERE obligation.monthly_cycle_id=v_march AND balance.available_minor<>0)
  THEN RAISE EXCEPTION 'harvest_lock_replay_or_balance_conservation_failed'; END IF;

  BEGIN
    PERFORM public.lock_funded_epoch_allocation_v2(jsonb_build_object(
      'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local','actorUserId',v_actor,
      'cycleKey','2026-06','capMultiple','1.51','selectedPreviewHash',v_preview->>'inputHash'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_allocation_v2_selection_conflict%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed_duplicate_lock_was_accepted'; END IF;

  IF NOT EXISTS(SELECT 1 FROM public.epoch_allocation_runs run WHERE run.policy_key='settled_cubid_redistribution_v2'
      AND run.score_pool_minor>0 AND run.retained_initial_minor>0 AND run.top_up_minor>0
      AND run.final_allocation_minor=run.retained_initial_minor+run.top_up_minor)
    OR v_close.root_hash !~ '^[0-9a-f]{64}$'
    OR EXISTS(SELECT 1 FROM public.monthly_cycle_report_artifacts artifact WHERE artifact.close_package_id=v_close.id AND
      CASE WHEN artifact.state='tombstoned' THEN artifact.artifact->>'originalHash'<>artifact.artifact_hash
      ELSE artifact.artifact_hash<>encode(extensions.digest(pg_catalog.convert_to(artifact.artifact::text,'UTF8'),'sha256'),'hex') END)
  THEN RAISE EXCEPTION 'allocation_cap_or_deterministic_root_report_hash_failed'; END IF;
END $$;

ROLLBACK;
