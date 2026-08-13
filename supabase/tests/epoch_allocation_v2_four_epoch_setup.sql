\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_actor uuid := '290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_origin bigint;
  v_e_minus_2 bigint;
  v_e_minus_1 bigint;
  v_target bigint;
  v_fixture_cycle bigint;
  v_close public.epoch_close_packages%ROWTYPE;
  v_obligation public.user_withdrawal_obligations%ROWTYPE;
  v_route bigint;
  v_request uuid;
  v_status text;
  v_index integer := 0;
  v_unit numeric(78,0);
  v_active numeric(78,0);
  v_preview jsonb;
  v_harvest numeric(78,0);
  v_carry numeric(78,0);
  v_oldest public.payout_inventory_lots%ROWTYPE;
  v_newer_total numeric(78,0);
  v_oldest_harvest numeric(78,0);
BEGIN
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES
    ('2026-03',2026,3,'2026-03-01','2026-03-31','completed'),
    ('2026-04',2026,4,'2026-04-01','2026-04-30','completed'),
    ('2026-05',2026,5,'2026-05-01','2026-05-31','completed'),
    ('2026-06',2026,6,'2026-06-01','2026-06-30','completed')
  ON CONFLICT(cycle_key) DO UPDATE SET period_start=excluded.period_start,period_end=excluded.period_end,status=excluded.status;
  SELECT id INTO STRICT v_origin FROM public.monthly_cycles WHERE cycle_key='2026-03';
  SELECT id INTO STRICT v_e_minus_2 FROM public.monthly_cycles WHERE cycle_key='2026-04';
  SELECT id INTO STRICT v_e_minus_1 FROM public.monthly_cycles WHERE cycle_key='2026-05';
  SELECT id INTO STRICT v_target FROM public.monthly_cycles WHERE cycle_key='2026-06';
  SELECT id INTO STRICT v_fixture_cycle FROM public.monthly_cycles WHERE cycle_key='2026-07';

  SELECT package.* INTO STRICT v_close FROM public.epoch_close_packages package
  JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id
  WHERE package.monthly_cycle_id=v_fixture_cycle AND approval.actor_user_id=v_actor
  ORDER BY package.id DESC LIMIT 1;
  PERFORM public.confirm_epoch_allocation_close_root(jsonb_build_object(
    'contractVersion','epoch_allocation_close_root.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'closePackageId',v_close.id,'rootHash',v_close.root_hash));
  PERFORM public.prepare_epoch_withdrawal_obligations(v_close.id,v_actor,'local');

  UPDATE public.user_withdrawal_obligations obligation
  SET monthly_cycle_id=v_origin,source_expires_after_cycle_id=v_target,available_at='2026-03-01T00:00:00Z'
  WHERE obligation.source_award_control_id IN (
    SELECT control.id FROM public.epoch_provisional_award_controls control WHERE control.approval_id=v_close.approval_id);
  UPDATE public.payout_inventory_lots lot SET monthly_cycle_id=v_origin,expires_after_cycle_id=v_target
  WHERE lot.obligation_id IN (SELECT id FROM public.user_withdrawal_obligations WHERE monthly_cycle_id=v_origin);

  SELECT obligation.* INTO STRICT v_obligation FROM public.user_withdrawal_obligations obligation
  WHERE obligation.monthly_cycle_id=v_origin ORDER BY obligation.id LIMIT 1;
  SELECT lot.* INTO STRICT v_oldest FROM public.payout_inventory_lots lot WHERE lot.obligation_id=v_obligation.id
  ORDER BY lot.deterministic_sequence,lot.id LIMIT 1;
  IF (SELECT count(*) FROM public.payout_inventory_lots WHERE obligation_id=v_obligation.id)<2 OR v_oldest.canonical_minor_total<10
  THEN RAISE EXCEPTION 'four_epoch_multiple_inventory_lots_required'; END IF;
  v_unit:=greatest(1,floor(v_oldest.canonical_minor_total/10));

  INSERT INTO public.user_payout_routes(user_id,rail,label,currency_code,destination,is_default,status,created_by_user_id)
  SELECT v_obligation.user_id,CASE lot.rail_key WHEN 'stripe_bank_transfer' THEN 'fiat_stub' ELSE 'evm' END,
    'Four epoch lifecycle','USD',CASE lot.rail_key WHEN 'stripe_bank_transfer' THEN '{"bank":"hashed-fixture"}'::jsonb
      ELSE '{"address":"0x0000000000000000000000000000000000000001"}'::jsonb END,false,'active',v_actor
  FROM public.payout_inventory_lots lot WHERE lot.obligation_id=v_obligation.id ORDER BY lot.deterministic_sequence LIMIT 1
  RETURNING id INTO v_route;
  FOREACH v_status IN ARRAY ARRAY['reserved','queued','held','paid','closed','released'] LOOP
    v_index:=v_index+1;
    INSERT INTO public.user_withdrawal_requests(user_id,payout_route_id,status,requested_usd_amount,currency_code,idempotency_key,requested_at,
      requested_minor,fee_minor,net_minor,user_fee_bps,rail_key,financial_asset_id,project_id,destination_hash,request_hash,
      production_enabled,closed_at)
    SELECT v_obligation.user_id,v_route,CASE WHEN v_status='released' THEN 'cancelled' ELSE v_status END,v_unit/100,'USD',
      CASE WHEN v_status='released' THEN 'four-epoch-race-release' ELSE 'four-epoch-protected-'||v_status END,
      '2026-03-15T00:00:00Z',v_unit,0,v_unit,0,lot.rail_key,lot.financial_asset_id,lot.project_id,
      repeat('1',64),encode(extensions.digest(convert_to('four-epoch-request:'||v_status,'UTF8'),'sha256'),'hex'),false,
      CASE WHEN v_status IN('paid','closed','released') THEN '2026-03-20T00:00:00Z'::timestamptz ELSE NULL END
    FROM public.payout_inventory_lots lot WHERE lot.obligation_id=v_obligation.id ORDER BY lot.deterministic_sequence LIMIT 1
    RETURNING id INTO v_request;
    INSERT INTO public.user_withdrawal_obligation_claims(withdrawal_request_id,obligation_id,sequence_no,claimed_minor,status,created_at,updated_at)
    VALUES(v_request,v_obligation.id,1,v_unit,v_status,'2026-03-15T00:00:00Z','2026-03-15T00:00:00Z');
  END LOOP;

  SELECT coalesce(sum(claimed_minor),0) INTO v_active FROM public.user_withdrawal_obligation_claims
  WHERE obligation_id=v_obligation.id AND status IN('reserved','queued','held','paid','closed');
  IF v_active<>5*v_unit OR (SELECT available_minor FROM public.user_withdrawal_obligation_balances WHERE id=v_obligation.id)<>v_obligation.total_minor-v_active
    OR (SELECT count(DISTINCT status) FROM public.user_withdrawal_obligation_claims WHERE obligation_id=v_obligation.id
      AND status IN('reserved','queued','held','paid','closed'))<>5
  THEN RAISE EXCEPTION 'four_epoch_partial_claim_status_or_release_reeligibility_failed'; END IF;

  INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,origin_source_lot_id,project_id,monthly_cycle_id,
    source_position,source_kind,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,
    fee_ledger_transaction_id,native_atomic_amount,source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,
    project_fee_bps,project_fee_exact_usd,base_fee_bps,base_fee_exact_usd,distributable_exact_usd,canonical_minor_unit_scale,
    deterministic_source_order,project_fee_assessed_once,classification_status,state,expires_after_cycle_id,reserved_exact_usd,
    evidence_hash,deployment_environment,production_enabled)
  SELECT 'lifecycle:2026-06:'||lot.id,lot.package_id,lot.id,lot.project_id,v_target,lot.source_position,lot.source_kind,
    lot.rail_key,lot.financial_asset_id,lot.custody_account_id,lot.fx_snapshot_id,lot.fee_policy_id,lot.fee_ledger_transaction_id,
    lot.native_atomic_amount,lot.source_preliminary_exact_usd,lot.gross_exact_usd,lot.fx_difference_exact_usd,
    lot.project_fee_bps,lot.project_fee_exact_usd,lot.base_fee_bps,lot.base_fee_exact_usd,lot.distributable_exact_usd,
    lot.canonical_minor_unit_scale,lot.deterministic_source_order,lot.project_fee_assessed_once,lot.classification_status,
    'ready_for_lock',v_target,0,lot.evidence_hash,lot.deployment_environment,false
  FROM public.epoch_valuation_source_lots lot
  WHERE lot.id IN (SELECT source_lot_id FROM public.epoch_allocation_manifest_sources source
    JOIN public.epoch_allocation_manifests manifest ON manifest.id=source.manifest_id WHERE manifest.monthly_cycle_id=v_fixture_cycle);
  UPDATE public.epoch_project_packages package SET canonical_cycle_id=v_target,funding_status='settled'
  WHERE package.id IN (SELECT lot.package_id FROM public.epoch_valuation_source_lots lot WHERE lot.monthly_cycle_id=v_target);
  UPDATE public.epoch_redistribution_pool_sources SET target_monthly_cycle_id=v_target,origin_monthly_cycle_id=v_origin
  WHERE origin_kind='carryforward_residue' AND target_monthly_cycle_id>v_target;

  v_preview:=public.epoch_allocation_v2_preview_input('2026-06',1.50,'local');
  SELECT coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric)
    FILTER(WHERE item.value->>'originKind'='harvested_unclaimed'),0),
    coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric)
    FILTER(WHERE item.value->>'originKind'='carryforward_residue'),0)
  INTO v_harvest,v_carry FROM jsonb_array_elements(v_preview->'redistributionSources') item(value);
  SELECT coalesce(sum(canonical_minor_total),0) INTO v_newer_total FROM public.payout_inventory_lots
  WHERE obligation_id=v_obligation.id AND (deterministic_sequence,id)>(v_oldest.deterministic_sequence,v_oldest.id);
  SELECT coalesce((item.value->>'canonicalMinorCapacity')::numeric,0) INTO v_oldest_harvest
  FROM jsonb_array_elements(v_preview->'redistributionSources') item(value)
  WHERE item.value->>'sourceLotId'='harvest:'||v_target::text||':'||v_oldest.id::text;
  IF v_preview->>'originCycleKey'<>'2026-03' OR v_harvest<>v_obligation.total_minor-v_active OR v_carry<=0
    OR v_newer_total<=0 OR v_oldest_harvest<>v_oldest.canonical_minor_total-v_active
    OR EXISTS(SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.obligation_id=v_obligation.id
      AND (lot.deterministic_sequence,lot.id)>(v_oldest.deterministic_sequence,v_oldest.id)
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_preview->'redistributionSources') item(value)
        WHERE item.value->>'sourceLotId'='harvest:'||v_target::text||':'||lot.id::text
          AND (item.value->>'canonicalMinorCapacity')::numeric=lot.canonical_minor_total))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_preview->'redistributionSources') item(value)
      WHERE item.value->>'originKind'='harvested_unclaimed' AND item.value->>'originCycleKey'<>'2026-03')
  THEN RAISE EXCEPTION 'four_epoch_oldest_retained_newest_harvested_conservation_failed'; END IF;
END $$;

COMMIT;
