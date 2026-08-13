\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('fundloop.fixture_manifest_id', :'manifest_id', true);
SELECT set_config('fundloop.fixture_run_id', :'run_id', true);

DO $$
DECLARE
  v_actor uuid := '290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_origin bigint;
  v_target bigint;
  v_manifest public.epoch_allocation_manifests%ROWTYPE;
  v_run public.epoch_allocation_runs%ROWTYPE;
  v_close jsonb;
  v_close_replay jsonb;
  v_reports jsonb;
  v_report_replay jsonb;
  v_obligation public.user_withdrawal_obligations%ROWTYPE;
  v_active numeric(78,0);
  v_harvest numeric(78,0);
  v_carry numeric(78,0);
  v_source_native numeric(78,0);
  v_disposition_exact numeric(38,18);
  v_eur_source_lot bigint;
  v_eur_funded_minor numeric(78,0);
  v_failed boolean := false;
BEGIN
  SELECT id INTO STRICT v_origin FROM public.monthly_cycles WHERE cycle_key='2026-03';
  SELECT id INTO STRICT v_target FROM public.monthly_cycles WHERE cycle_key='2026-06';
  SELECT * INTO STRICT v_manifest FROM public.epoch_allocation_manifests
  WHERE id=current_setting('fundloop.fixture_manifest_id')::bigint;
  SELECT * INTO STRICT v_run FROM public.epoch_allocation_runs
  WHERE id=current_setting('fundloop.fixture_run_id')::bigint;
  SELECT obligation.* INTO STRICT v_obligation FROM public.user_withdrawal_obligations obligation
  WHERE obligation.monthly_cycle_id=v_origin ORDER BY obligation.id LIMIT 1;
  SELECT coalesce(sum(claimed_minor),0) INTO v_active FROM public.user_withdrawal_obligation_claims
  WHERE obligation_id=v_obligation.id AND status IN('reserved','queued','held','paid','closed');
  SELECT coalesce(sum(canonical_minor_capacity) FILTER(WHERE origin_kind='harvested_unclaimed'),0),
    coalesce(sum(canonical_minor_capacity) FILTER(WHERE origin_kind='carryforward_residue'),0)
  INTO v_harvest,v_carry FROM public.epoch_allocation_manifest_pool_sources WHERE manifest_id=v_manifest.id;
  SELECT source.source_lot_id,source.canonical_minor_capacity INTO STRICT v_eur_source_lot,v_eur_funded_minor
  FROM public.epoch_allocation_manifest_sources source
  JOIN public.epoch_allocation_manifests manifest ON manifest.id=source.manifest_id
  JOIN public.monthly_cycles cycle ON cycle.id=manifest.monthly_cycle_id
  JOIN public.epoch_project_package_funding_sources package_source ON package_source.id=(
    SELECT lot.package_source_id FROM public.epoch_valuation_source_lots lot WHERE lot.id=source.source_lot_id)
  WHERE cycle.cycle_key='2026-07' AND package_source.stripe_pay_by_bank_command_id IS NOT NULL;

  IF v_manifest.monthly_cycle_id<>v_target OR v_manifest.policy_key<>'settled_cubid_redistribution_v2'
    OR v_manifest.current_funded_minor<=0 OR v_harvest<=0 OR v_carry<=0
    OR v_manifest.funded_minor<>v_manifest.current_funded_minor+v_harvest+v_carry
    OR v_manifest.harvested_unclaimed_minor<>v_harvest OR v_manifest.carry_in_minor<>v_carry
    OR v_obligation.harvested_minor<>v_obligation.total_minor-v_active
    OR v_obligation.claim_window_closed_at IS NULL
    OR EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=v_obligation.id
      AND status IN('reserved','queued','held','paid','closed') AND claimed_minor<=0)
  THEN RAISE EXCEPTION 'four_epoch_manifest_claim_harvest_conservation_failed'; END IF;

  IF v_eur_funded_minor<>v_active+v_harvest+v_carry
    OR EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_sources current_source
      JOIN public.epoch_valuation_source_lots current_lot ON current_lot.id=current_source.source_lot_id
      WHERE current_source.manifest_id=v_manifest.id
        AND (current_lot.id=v_eur_source_lot OR current_lot.origin_source_lot_id=v_eur_source_lot))
    OR NOT EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_sources current_source
      JOIN public.epoch_valuation_source_lots current_lot ON current_lot.id=current_source.source_lot_id
      JOIN public.epoch_project_package_funding_sources package_source ON package_source.id=current_lot.package_source_id
      JOIN public.stripe_pay_by_bank_commands command ON command.id=package_source.stripe_pay_by_bank_command_id
      JOIN public.stripe_pay_by_bank_evidence evidence ON evidence.command_id=command.id AND evidence.ledger_transaction_id IS NOT NULL
      WHERE current_source.manifest_id=v_manifest.id AND command.provider_checkout_session_id='cs_test_fourepochcurrent'
        AND command.currency_code='EUR' AND command.expected_amount_minor=2000 AND evidence.gross_amount_minor=2000
        AND evidence.fee_amount_minor=6 AND evidence.net_amount_minor=1994)
    OR EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_pool_sources pool_source
      JOIN public.epoch_redistribution_pool_sources pool ON pool.id=pool_source.pool_source_id
      LEFT JOIN public.payout_inventory_lots inventory ON inventory.id=pool.origin_inventory_lot_id
      LEFT JOIN public.epoch_provisional_award_source_fills fill ON fill.id=coalesce(pool.origin_award_fill_id,inventory.source_fill_id)
      LEFT JOIN public.epoch_allocation_source_dispositions disposition
        ON disposition.id=coalesce(pool.origin_disposition_id,fill.disposition_id)
      LEFT JOIN public.epoch_allocation_manifest_sources original_source ON original_source.id=disposition.manifest_source_id
      WHERE pool_source.manifest_id=v_manifest.id AND original_source.source_lot_id IS DISTINCT FROM v_eur_source_lot)
  THEN RAISE EXCEPTION 'four_epoch_eur_source_initial_harvest_carry_double_use_failed'; END IF;

  IF v_run.manifest_id<>v_manifest.id OR v_run.policy_key<>'settled_cubid_redistribution_v2'
    OR v_run.current_funded_minor<>v_manifest.current_funded_minor
    OR v_run.harvested_unclaimed_minor<>v_harvest OR v_run.carry_in_minor<>v_carry
    OR v_run.funded_minor<>v_run.current_funded_minor+v_run.harvested_unclaimed_minor+v_run.carry_in_minor
    OR v_run.retained_initial_minor<=0 OR v_run.score_pool_minor<=0
    OR v_run.top_up_minor<=0 OR v_run.returned_residue_minor<=0
    OR v_run.final_allocation_minor<>v_run.retained_initial_minor+v_run.top_up_minor
    OR v_run.top_up_minor+v_run.returned_residue_minor<>v_run.score_pool_minor+v_harvest+v_carry
    OR EXISTS(SELECT 1 FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id AND
      (award.initial_claim_minor<>award.retained_initial_minor OR award.top_up_minor>award.top_up_capacity_minor
        OR award.final_minor<>award.initial_claim_minor+award.top_up_minor))
  THEN RAISE EXCEPTION 'four_epoch_score_discount_initial_claim_cap_or_carryout_failed'; END IF;

  -- Each input source is conserved once into its initial/pool stage. The later
  -- top-up/carry-out stage is conserved independently by the run totals above.
  IF EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_sources source
    LEFT JOIN LATERAL (SELECT coalesce(sum(disposition.canonical_minor),0) minor,
      coalesce(sum(disposition.exact_usd),0) exact FROM public.epoch_allocation_source_dispositions disposition
      WHERE disposition.run_id=v_run.id AND disposition.manifest_source_id=source.id
        AND disposition.disposition_kind IN('initial_claim','score_pool')) totals ON true
    WHERE source.manifest_id=v_manifest.id AND (totals.minor<>source.canonical_minor_capacity OR totals.exact<>source.exact_usd)
  ) OR EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_pool_sources source
    LEFT JOIN LATERAL (SELECT coalesce(sum(disposition.canonical_minor),0) minor,
      coalesce(sum(disposition.exact_usd),0) exact FROM public.epoch_allocation_source_dispositions disposition
      WHERE disposition.run_id=v_run.id AND disposition.manifest_pool_source_id=source.id
        AND disposition.disposition_kind IN('harvested_pool','carryin_pool')) totals ON true
    WHERE source.manifest_id=v_manifest.id AND (totals.minor<>source.canonical_minor_capacity OR totals.exact<>source.exact_usd)
  ) THEN RAISE EXCEPTION 'four_epoch_source_minor_exact_conservation_failed'; END IF;

  SELECT coalesce(sum(source.native_atomic_amount),0) INTO v_source_native
  FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id;
  SELECT coalesce(sum(disposition.exact_usd),0) INTO v_disposition_exact
  FROM public.epoch_allocation_source_dispositions disposition
  WHERE disposition.run_id=v_run.id AND disposition.disposition_kind IN('initial_claim','score_pool','harvested_pool','carryin_pool');
  IF v_source_native<=0 OR v_disposition_exact<>v_manifest.funded_exact_usd
    OR EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_sources source
      JOIN public.epoch_valuation_source_lots lot ON lot.id=source.source_lot_id
      WHERE source.manifest_id=v_manifest.id AND (source.project_id<>lot.project_id OR source.rail_key<>lot.rail_key
        OR source.financial_asset_id<>lot.financial_asset_id OR source.custody_account_id<>lot.custody_account_id
        OR source.fx_snapshot_id<>lot.fx_snapshot_id OR source.native_atomic_amount<>lot.native_atomic_amount
        OR source.evidence_hash<>lot.evidence_hash))
  THEN RAISE EXCEPTION 'four_epoch_native_project_rail_asset_custody_fx_evidence_failed'; END IF;

  IF (SELECT count(*) FROM public.epoch_redistribution_pool_sources pool
      WHERE pool.target_monthly_cycle_id=v_target AND pool.origin_kind='harvested_unclaimed')
      <>(SELECT count(*) FROM public.epoch_allocation_manifest_pool_sources source
        WHERE source.manifest_id=v_manifest.id AND source.origin_kind='harvested_unclaimed')
    OR EXISTS(SELECT origin_inventory_lot_id FROM public.epoch_redistribution_pool_sources
      WHERE target_monthly_cycle_id=v_target AND origin_kind='harvested_unclaimed'
      GROUP BY origin_inventory_lot_id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'four_epoch_duplicate_harvest_prevention_failed'; END IF;

  BEGIN
    INSERT INTO public.epoch_redistribution_pool_sources(source_lot_key,target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,
      origin_obligation_id,origin_inventory_lot_id,origin_award_fill_id,project_id,rail_key,financial_asset_id,custody_account_id,
      fx_snapshot_id,native_atomic_amount,exact_usd,canonical_minor,source_order,evidence_hash)
    SELECT source_lot_key||':duplicate',target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,origin_obligation_id,
      origin_inventory_lot_id,origin_award_fill_id,project_id,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,
      native_atomic_amount,exact_usd,canonical_minor,source_order,evidence_hash
    FROM public.epoch_redistribution_pool_sources WHERE target_monthly_cycle_id=v_target AND origin_kind='harvested_unclaimed' LIMIT 1;
  EXCEPTION WHEN unique_violation THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'four_epoch_duplicate_harvest_insert_accepted'; END IF;

  v_close:=public.approve_epoch_allocation_close_v2(jsonb_build_object('contractVersion','epoch_allocation_close.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run.id,'manifestHash',v_manifest.manifest_hash,
    'resultHash',v_run.result_hash,'rerunResultHash',v_run.result_hash));
  v_close_replay:=public.approve_epoch_allocation_close_v2(jsonb_build_object('contractVersion','epoch_allocation_close.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run.id,'manifestHash',v_manifest.manifest_hash,
    'resultHash',v_run.result_hash,'rerunResultHash',v_run.result_hash));
  IF v_close->>'closePackageId'<>v_close_replay->>'closePackageId' OR v_close->>'rootHash'<>v_close_replay->>'rootHash'
    OR (v_close->>'rootHash') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'four_epoch_close_rerun_root_failed'; END IF;
  PERFORM public.confirm_epoch_allocation_close_root(jsonb_build_object('contractVersion','epoch_allocation_close_root.v1',
    'deploymentEnvironment','local','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId','rootHash',v_close->>'rootHash'));
  v_reports:=public.generate_monthly_cycle_reports(jsonb_build_object('contractVersion','monthly_cycle_reports_generate.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId'));
  v_report_replay:=public.generate_monthly_cycle_reports(jsonb_build_object('contractVersion','monthly_cycle_reports_generate.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId'));
  IF v_reports->>'rootHash'<>v_close->>'rootHash' OR (v_reports->>'artifactCount')::integer<5 OR (v_report_replay->>'replayed')::boolean IS NOT TRUE
    OR EXISTS(SELECT 1 FROM public.monthly_cycle_report_artifacts artifact
      WHERE artifact.close_package_id=(v_close->>'closePackageId')::bigint
        AND artifact.artifact_hash<>encode(extensions.digest(convert_to(artifact.artifact::text,'UTF8'),'sha256'),'hex'))
  THEN RAISE EXCEPTION 'four_epoch_report_hash_or_replay_failed'; END IF;

  IF NOT EXISTS(SELECT 1 FROM public.epoch_redistribution_pool_sources carry
    JOIN public.epoch_allocation_source_dispositions disposition ON disposition.id=carry.origin_disposition_id
    WHERE carry.origin_monthly_cycle_id=v_target AND carry.origin_kind='carryforward_residue'
      AND carry.predecessor_pool_source_id IS NOT DISTINCT FROM (
        SELECT source.pool_source_id FROM public.epoch_allocation_manifest_pool_sources source
        WHERE source.id=disposition.manifest_pool_source_id))
  THEN RAISE EXCEPTION 'four_epoch_carryout_predecessor_chain_failed'; END IF;
END $$;

ROLLBACK;
