BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$ DECLARE v_actor uuid:='11c1a713-b14b-49c0-bcc4-0246fbc78410'; v_project bigint:=1; v_cycle bigint; v_expiry bigint; v_target bigint;
  v_package bigint; v_bad_package bigint; v_payment1 bigint; v_payment2 bigint; v_intent1 bigint; v_intent2 bigint; v_obs bigint; v_fallback bigint; v_fx bigint; v_count integer;
  v_lot bigint; v_successor bigint; v_failed boolean; v_fraction_total numeric; v_native_total numeric; v_distributable numeric;
BEGIN
  IF public.clamp_epoch_fee_bps(0,50,150)<>50 OR public.clamp_epoch_fee_bps(2000,50,150)<>150 THEN
    RAISE EXCEPTION 'fee min/max clamp failed'; END IF;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status) VALUES
    ('2026-08',2026,8,'2026-08-01','2026-08-31','prep'),
    ('2026-11',2026,11,'2026-11-01','2026-11-30','open'),
    ('2026-12',2026,12,'2026-12-01','2026-12-31','open')
  ON CONFLICT(cycle_key) DO UPDATE SET status=excluded.status;
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key='2026-08';
  SELECT id INTO v_expiry FROM public.monthly_cycles WHERE cycle_key='2026-11';
  SELECT id INTO v_target FROM public.monthly_cycles WHERE cycle_key='2026-12';

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,monthly_cycle_id)
  VALUES(v_project,'2026-08-01','2026-08-31',100,100,100,v_cycle) RETURNING id INTO v_payment1;
  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,monthly_cycle_id)
  VALUES(v_project,'2026-08-01','2026-08-31',100,100,100,v_cycle) RETURNING id INTO v_payment2;
  INSERT INTO public.stripe_bank_transfer_intents(project_id,payment_id,accounting_period_id,actor_user_id,currency_code,expected_amount_minor,
    provider_account_id,provider_customer_id,provider_payment_intent_id,instruction_evidence_hash,deployment_environment)
  VALUES(v_project,v_payment1,1,v_actor,'USD',10000,'acct_prep1','cus_prep1','pi_prep1',repeat('1',64),'local') RETURNING id INTO v_intent1;
  INSERT INTO public.stripe_bank_transfer_intents(project_id,payment_id,accounting_period_id,actor_user_id,currency_code,expected_amount_minor,
    provider_account_id,provider_customer_id,provider_payment_intent_id,instruction_evidence_hash,deployment_environment)
  VALUES(v_project,v_payment2,1,v_actor,'USD',10000,'acct_prep2','cus_prep2','pi_prep2',repeat('2',64),'local') RETURNING id INTO v_intent2;

  INSERT INTO public.epoch_project_packages(project_id,intended_cycle_id,canonical_cycle_id,version,status,list_status,funding_status,
    compliance_status,cubid_status,cutoff_at,frozen_at,approved_at,approved_by_user_id,project_fee_assessed_once,base_fee_deferred,
    payment_count,funding_source_count,cohort_count,eligible_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id)
  VALUES(v_project,v_cycle,v_cycle,1,'approved','valid','settled','passed','eligible','2026-09-01T07:00:00Z','2026-09-01T07:00:00Z',
    '2026-09-02T00:00:00Z',v_actor,false,true,2,2,1,1,200,'{}',repeat('3',64),v_actor) RETURNING id INTO v_package;
  INSERT INTO public.epoch_project_package_funding_sources(package_id,source_position,source_kind,stripe_intent_id,asset_code,
    native_atomic_amount,preliminary_usd,source_evidence_hash,project_fee_assessed_once,base_fee_deferred) VALUES
    (v_package,0,'stripe_bank_transfer',v_intent1,'USD',10000,100,repeat('4',64),false,true),
    (v_package,1,'stripe_bank_transfer',v_intent2,'USD',10000,100,repeat('5',64),true,true);
  INSERT INTO public.epoch_project_package_cohort(package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,
    locked_cubid_score,locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash)
  VALUES(v_package,101,v_actor,repeat('6',64),'valid','eligible',10,20,'2026-08-31T00:00:00Z','2026-09-02T00:00:00Z',repeat('7',64));

  v_failed:=false; BEGIN PERFORM public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1',
    'deploymentEnvironment','production','cycleKey','2026-08','assetKey','stripe_sandbox_usd','sourceKey','primary_fixture','sourceRank',1,
    'rateUsdPerUnit','1','observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('8',64),'actorUserId',v_actor)); EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%runtime_disabled%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production FX observation was accepted'; END IF;

  v_obs:=public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','sourceKey','primary_fixture','sourceRank',1,'rateUsdPerUnit','1',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('8',64),'actorUserId',v_actor));
  v_fallback:=public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','sourceKey','fallback_fixture','sourceRank',2,'rateUsdPerUnit','1',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('d',64),'actorUserId',v_actor));
  v_failed:=false; BEGIN PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','method','fallback','observationId',v_fallback,'preanalysis','{}'::jsonb,
    'evidenceHash',repeat('e',64),'actorUserId',v_actor)); EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%higher_priority_source_available%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'fallback FX bypassed a fresh eligible primary'; END IF;
  v_failed:=false; BEGIN PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','method','manual_after_exhaustion','manualRateUsdPerUnit','1','preanalysis','{}'::jsonb,
    'evidenceHash',repeat('9',64),'actorUserId',v_actor)); EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%manual_source_not_exhausted%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'manual FX bypassed eligible source'; END IF;
  v_fx:=public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','method','primary','observationId',v_obs,'preanalysis',jsonb_build_object('fresh',true),
    'evidenceHash',repeat('9',64),'actorUserId',v_actor));
  IF (SELECT status FROM public.epoch_fx_snapshots WHERE id=v_fx)<>'posted' THEN RAISE EXCEPTION 'primary FX did not post'; END IF;
  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-11','assetKey','local_review_usd','method','manual_after_exhaustion','manualRateUsdPerUnit','1.004',
    'preanalysis',jsonb_build_object('allConfiguredSourcesExhausted',true),'evidenceHash',repeat('a',64),'actorUserId',v_actor));
  IF NOT EXISTS(SELECT 1 FROM public.epoch_fx_snapshots f JOIN public.monthly_cycles c ON c.id=f.monthly_cycle_id
    WHERE c.cycle_key='2026-11' AND f.status='paused_depeg' AND f.stablecoin_peg_status='outside_band') THEN
    RAISE EXCEPTION 'stablecoin depeg did not pause'; END IF;

  v_count:=public.prepare_epoch_financial_sources(jsonb_build_object('contractVersion','epoch_financial_prep.v1','deploymentEnvironment','local',
    'packageId',v_package,'actorUserId',v_actor));
  IF v_count<>2 THEN RAISE EXCEPTION 'expected two source lots, got %',v_count; END IF;
  INSERT INTO public.epoch_project_packages(project_id,intended_cycle_id,canonical_cycle_id,version,status,list_status,funding_status,
    compliance_status,cubid_status,cutoff_at,frozen_at,approved_at,approved_by_user_id,project_fee_assessed_once,base_fee_deferred,
    payment_count,funding_source_count,cohort_count,eligible_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id)
  SELECT project_id,intended_cycle_id,canonical_cycle_id,2,status,list_status,funding_status,compliance_status,cubid_status,cutoff_at,
    frozen_at,approved_at,approved_by_user_id,project_fee_assessed_once,base_fee_deferred,1,1,0,0,100,'{}',repeat('b',64),created_by_user_id
  FROM public.epoch_project_packages WHERE id=v_package RETURNING id INTO v_bad_package;
  INSERT INTO public.epoch_project_package_funding_sources(package_id,source_position,source_kind,stripe_intent_id,asset_code,
    native_atomic_amount,preliminary_usd,source_evidence_hash,project_fee_assessed_once,base_fee_deferred)
  VALUES(v_bad_package,0,'stripe_bank_transfer',v_intent1,'CAD',10000,100,repeat('c',64),false,true);
  v_failed:=false; BEGIN PERFORM public.prepare_epoch_financial_sources(jsonb_build_object('contractVersion','epoch_financial_prep.v1',
    'deploymentEnvironment','local','packageId',v_bad_package,'actorUserId',v_actor)); EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%source_evidence_mismatch%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'source/provider dimension mismatch was accepted'; END IF;
  SELECT sum(native_atomic_amount),sum(distributable_exact_usd) INTO v_native_total,v_distributable
  FROM public.epoch_valuation_source_lots WHERE package_id=v_package;
  IF v_native_total<>20000 OR v_distributable<>194.025 THEN RAISE EXCEPTION 'fee conservation failed native %, distributable %',v_native_total,v_distributable; END IF;
  IF (SELECT project_fee_exact_usd FROM public.epoch_valuation_source_lots WHERE package_id=v_package AND source_position=0)<>1
    OR (SELECT project_fee_exact_usd FROM public.epoch_valuation_source_lots WHERE package_id=v_package AND source_position=1)<>0 THEN
    RAISE EXCEPTION 'project fee assessed-once guard failed'; END IF;
  IF (SELECT count(*) FROM public.epoch_funded_allocation_lock_candidates WHERE package_id=v_package)<>2 THEN
    RAISE EXCEPTION 'funded lock candidates missing exact source/user dimensions'; END IF;
  IF (SELECT count(*) FROM public.epoch_valuation_source_lots lot JOIN public.ledger_transactions tx ON tx.id=lot.fee_ledger_transaction_id
      WHERE lot.package_id=v_package AND tx.transaction_type='epoch_review_fee_processing')<>2 THEN
    RAISE EXCEPTION 'fee source lots were not bound to neutral ledger transactions'; END IF;

  SELECT id INTO v_lot FROM public.epoch_valuation_source_lots WHERE package_id=v_package AND source_position=0;
  UPDATE public.epoch_valuation_source_lots SET expires_after_cycle_id=v_expiry,reserved_exact_usd=1,state='reserved' WHERE id=v_lot;
  UPDATE public.epoch_valuation_source_lots SET expires_after_cycle_id=v_expiry WHERE package_id=v_package AND id<>v_lot;
  v_count:=public.harvest_expired_epoch_source_lots('local','2026-12',100);
  IF v_count<>1 THEN RAISE EXCEPTION 'scheduled harvest expected one unreserved source, got %',v_count; END IF;
  v_failed:=false; BEGIN PERFORM public.harvest_epoch_source_lot(jsonb_build_object('contractVersion','epoch_source_harvest.v1','deploymentEnvironment','local',
    'sourceLotId',v_lot,'targetCycleKey','2026-12','actorUserId',v_actor)); EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%harvest_unavailable%' OR SQLERRM LIKE '%harvest_reserved%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'reserved source was harvested'; END IF;
  UPDATE public.epoch_valuation_source_lots SET reserved_exact_usd=0,state='ready_for_lock' WHERE id=v_lot;
  v_successor:=public.harvest_epoch_source_lot(jsonb_build_object('contractVersion','epoch_source_harvest.v1','deploymentEnvironment','local',
    'sourceLotId',v_lot,'targetCycleKey','2026-12','actorUserId',v_actor));
  IF NOT EXISTS(SELECT 1 FROM public.epoch_valuation_source_lots WHERE id=v_successor AND origin_source_lot_id=v_lot
    AND distributable_exact_usd=96.525 AND classification_status='provisional_funded_epoch_principal') THEN
    RAISE EXCEPTION 'source-linked carryover failed'; END IF;

  INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,origin_source_lot_id,project_id,monthly_cycle_id,source_position,
    source_kind,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,fee_ledger_transaction_id,native_atomic_amount,
    source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,
    project_fee_bps,project_fee_exact_usd,base_fee_bps,base_fee_exact_usd,distributable_exact_usd,deterministic_source_order,
    project_fee_assessed_once,evidence_hash,deployment_environment)
  SELECT 'fraction:'||n,v_package,v_lot,v_project,v_cycle,10+n,'carryover',asset.rail_key,asset.id,custody.id,v_fx,
    (SELECT id FROM public.epoch_fee_policies WHERE policy_key='review_default'),
    (SELECT fee_ledger_transaction_id FROM public.epoch_valuation_source_lots WHERE id=v_successor),335000,.335,.335,0,0,0,0,0,.335,10+n,true,
    encode(extensions.digest(convert_to('fraction:'||n,'UTF8'),'sha256'),'hex'),'local'
  FROM generate_series(1,4)n JOIN public.financial_assets asset ON asset.asset_key='local_review_usd'
  JOIN public.financial_custody_accounts custody ON custody.asset_id=asset.id AND custody.custody_key='local_review_custody';
  SELECT sum(distributable_exact_usd) INTO v_fraction_total FROM public.epoch_valuation_source_lots WHERE source_lot_key LIKE 'fraction:%';
  IF v_fraction_total<>1.340000000000000000 OR (SELECT count(DISTINCT source_lot_key) FROM public.epoch_valuation_source_lots WHERE source_lot_key LIKE 'fraction:%')<>4 THEN
    RAISE EXCEPTION 'fractional source preservation failed'; END IF;

  v_failed:=false; BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM public.prepare_epoch_financial_sources('{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated prep RPC was executable'; END IF;
END $$;

ROLLBACK;
