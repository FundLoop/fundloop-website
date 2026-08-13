\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_actor uuid := '290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_origin bigint;
  v_e_minus_2 bigint;
  v_e_minus_1 bigint;
  v_target bigint;
  v_target_period bigint;
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
  v_eur_source_lot bigint;
  v_current_payment bigint;
  v_current_command uuid;
  v_current_evidence bigint;
  v_current_package bigint;
  v_current_dataset bigint;
  v_current_source_row bigint;
  v_current_fx_observation bigint;
  v_current_source_lot bigint;
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
  SELECT v_obligation.user_id,(CASE lot.rail_key WHEN 'stripe_bank_transfer' THEN 'fiat_stub' ELSE 'evm' END)::public.payout_rail,
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

  SELECT source.source_lot_id INTO STRICT v_eur_source_lot
  FROM public.epoch_allocation_manifest_sources source
  JOIN public.epoch_allocation_manifests manifest ON manifest.id=source.manifest_id
  WHERE manifest.monthly_cycle_id=v_fixture_cycle;

  -- Target-cycle funding is an independent provider settlement. The original
  -- EUR lot is reserved exclusively for its E-3 award and carry dispositions;
  -- cloning it here would spend the same economic source twice.
  INSERT INTO public.accounting_periods(period_key,starts_at,ends_at,timezone_name)
  VALUES('local_review_2026_06','2026-06-01T07:00:00Z','2026-07-01T07:00:00Z','America/Los_Angeles')
  RETURNING id INTO v_target_period;
  UPDATE public.epoch_shadow_states SET accounting_period_id=v_target_period,monthly_cycle_id=v_target,
    current_stage='reviewing',state_version=state_version+1,is_paused=false,production_enabled=false,updated_at=clock_timestamp()
  WHERE id=(SELECT id FROM public.epoch_shadow_states ORDER BY updated_at DESC,id DESC LIMIT 1);
  IF NOT FOUND THEN RAISE EXCEPTION 'four_epoch_target_review_state_missing'; END IF;
  INSERT INTO public.payments(project_id,monthly_cycle_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,v_target,'2026-06-01','2026-06-30',200,22,11,v_actor) RETURNING id INTO v_current_payment;
  PERFORM public.post_project_payment_funding_quote(jsonb_build_object(
    'contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'paymentId',v_current_payment,'railKey','stripe_pay_by_bank','currencyCode','EUR','rateUsdPerUnit','1.10',
    'sourceKey','four_epoch_current_fx','observedAt',clock_timestamp()-interval '1 minute',
    'freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('1',64)));
  v_current_command:=public.prepare_stripe_pay_by_bank_command(jsonb_build_object(
    'contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','paymentId',v_current_payment,'currencyCode','EUR','expectedAmountMinor','2000',
    'customerCountry','FI','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank',
    'platformAccountId','acct_testbank','privatePreviewEnabled',false));
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object(
    'commandId',v_current_command,'providerAccountId','acct_testbank','providerCheckoutSessionId','cs_test_fourepochcurrent',
    'capabilityEvidenceHash',repeat('2',64)));
  v_current_evidence:=public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object(
    'contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local','providerEventId','evt_fourepochcurrent',
    'providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_fourepochcurrent',
    'providerCreatedAt','2026-06-15T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1781524800,
    'payloadSha256',repeat('3',64),'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('2',64),
    'evidenceType','settled_available','commandId',v_current_command,'providerCheckoutSessionId','cs_test_fourepochcurrent',
    'providerPaymentIntentId','pi_fourepochcurrent','providerChargeId','ch_fourepochcurrent','providerRefundId',NULL,
    'providerBalanceTransactionId','txn_fourepochcurrent','currencyCode','EUR','customerCountry','FI','grossAmountMinor','2000',
    'refundAmountMinor',NULL,'feeAmountMinor','6','netAmountMinor','1994','balanceStatus','available','paymentMethodType','pay_by_bank'));
  v_current_package:=public.validate_epoch_project_package(jsonb_build_object(
    'deploymentEnvironment','local','actorRole','internal_admin','actorUserId',v_actor,'projectSlug','nomad-workspaces',
    'cycleKey','2026-06','complianceEvidenceHash',repeat('4',64),'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed'));
  INSERT INTO public.project_attribution_datasets(project_id,monthly_cycle_id,status,row_count,total_attribution_points,submitted_by_user_id)
  VALUES(3,v_target,'approved',1,1,v_actor) RETURNING id INTO v_current_dataset;
  INSERT INTO public.project_attribution_rows(dataset_id,project_id,monthly_cycle_id,row_index,scoped_cubid_id,user_id,attribution_points)
  VALUES(v_current_dataset,3,v_target,1,'four-epoch-independent-current',v_actor,1) RETURNING id INTO v_current_source_row;
  INSERT INTO public.epoch_project_package_cohort(package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,
    locked_cubid_score,locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash)
  VALUES(v_current_package,v_current_source_row,v_actor,repeat('5',64),'valid','eligible',10,20,clock_timestamp(),
    clock_timestamp()+interval '1 day',repeat('6',64));
  UPDATE public.epoch_project_packages SET status='approved',list_status='valid',funding_status='settled',compliance_status='passed',
    cubid_status='eligible',cohort_count=1,eligible_user_count=1,approved_at=clock_timestamp(),approved_by_user_id=v_actor
  WHERE id=v_current_package;
  v_current_fx_observation:=public.record_epoch_fx_observation(jsonb_build_object(
    'contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local','cycleKey','2026-06',
    'assetKey','stripe_pay_by_bank_eur','sourceKey','four_epoch_current_fx','sourceRank',1,'rateUsdPerUnit','1.10',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('7',64),'actorUserId',v_actor));
  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object(
    'contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local','cycleKey','2026-06',
    'assetKey','stripe_pay_by_bank_eur','method','primary','observationId',v_current_fx_observation,
    'preanalysis',jsonb_build_object('fresh',true),'evidenceHash',repeat('8',64),'actorUserId',v_actor));
  IF public.prepare_epoch_financial_sources(jsonb_build_object(
      'contractVersion','epoch_financial_prep.v1','deploymentEnvironment','local','packageId',v_current_package,'actorUserId',v_actor))<>1
  THEN RAISE EXCEPTION 'four_epoch_independent_current_prep_failed';END IF;
  SELECT lot.id INTO STRICT v_current_source_lot FROM public.epoch_valuation_source_lots lot
  JOIN public.epoch_project_package_funding_sources source ON source.id=lot.package_source_id
  WHERE source.stripe_pay_by_bank_command_id=v_current_command;
  IF v_current_source_lot=v_eur_source_lot OR EXISTS(SELECT 1 FROM public.epoch_valuation_source_lots lot
    WHERE lot.id=v_current_source_lot AND lot.origin_source_lot_id=v_eur_source_lot)
  THEN RAISE EXCEPTION 'four_epoch_eur_source_reused_as_current_funding';END IF;
  UPDATE public.epoch_redistribution_pool_sources pool SET target_monthly_cycle_id=v_target,origin_monthly_cycle_id=v_origin
  FROM public.epoch_allocation_source_dispositions disposition
  JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
  WHERE pool.origin_kind='carryforward_residue' AND pool.origin_disposition_id=disposition.id
    AND source.source_lot_id=v_eur_source_lot;

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
    OR (SELECT canonical_minor_capacity FROM public.epoch_allocation_manifest_sources source
      JOIN public.epoch_allocation_manifests manifest ON manifest.id=source.manifest_id
      WHERE source.source_lot_id=v_eur_source_lot AND manifest.monthly_cycle_id=v_fixture_cycle)<>v_active+v_harvest+v_carry
    OR EXISTS(SELECT 1 FROM public.epoch_valuation_source_lots lot
      WHERE lot.monthly_cycle_id=v_target AND (lot.id=v_eur_source_lot OR lot.origin_source_lot_id=v_eur_source_lot))
    OR EXISTS(SELECT 1 FROM public.payout_inventory_lots inventory
      JOIN public.epoch_provisional_award_source_fills fill ON fill.id=inventory.source_fill_id
      JOIN public.epoch_allocation_source_dispositions disposition ON disposition.id=fill.disposition_id
      JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
      WHERE inventory.obligation_id=v_obligation.id AND source.source_lot_id<>v_eur_source_lot)
    OR EXISTS(SELECT 1 FROM public.epoch_redistribution_pool_sources pool
      JOIN public.epoch_allocation_source_dispositions disposition ON disposition.id=pool.origin_disposition_id
      LEFT JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
      WHERE pool.target_monthly_cycle_id=v_target AND pool.origin_kind='carryforward_residue'
        AND source.source_lot_id IS DISTINCT FROM v_eur_source_lot)
    OR v_newer_total<=0 OR v_oldest_harvest<>v_oldest.canonical_minor_total-v_active
    OR EXISTS(SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.obligation_id=v_obligation.id
      AND (lot.deterministic_sequence,lot.id)>(v_oldest.deterministic_sequence,v_oldest.id)
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_preview->'redistributionSources') item(value)
        WHERE item.value->>'sourceLotId'='harvest:'||v_target::text||':'||lot.id::text
          AND (item.value->>'canonicalMinorCapacity')::numeric=lot.canonical_minor_total))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_preview->'redistributionSources') item(value)
      WHERE item.value->>'originKind'='harvested_unclaimed' AND item.value->>'originCycleKey'<>'2026-03')
  THEN RAISE EXCEPTION 'four_epoch_eur_source_harvest_carry_no_double_use_failed'
    USING DETAIL=jsonb_build_object('originCycleKey',v_preview->>'originCycleKey','harvest',v_harvest,'expectedHarvest',v_obligation.total_minor-v_active,
      'carry',v_carry,'active',v_active,'oldestHarvest',v_oldest_harvest,'expectedOldestHarvest',v_oldest.canonical_minor_total-v_active,
      'newerTotal',v_newer_total,'redistributionSources',v_preview->'redistributionSources')::text;
  END IF;
END $$;

COMMIT;
