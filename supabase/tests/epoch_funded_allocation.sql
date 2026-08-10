BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE
  v_actor uuid:='11c1a713-b14b-49c0-bcc4-0246fbc78410';
  v_project bigint:=1;
  v_cycle bigint;
  v_payment bigint;
  v_intent bigint;
  v_package bigint;
  v_observation bigint;
  v_manifest jsonb;
  v_manifest_id bigint;
  v_manifest_hash text;
  v_source_lot_id bigint;
  v_exact numeric(38,18);
  v_funded_minor numeric(78,0);
  v_initial_minor numeric(78,0);
  v_score_minor numeric(78,0);
  v_initial_exact numeric(38,18);
  v_cap_exact numeric(38,18);
  v_artifact jsonb;
  v_run bigint;
  v_replay bigint;
  v_close jsonb;
  v_close_replay jsonb;
  v_root_hash text;
  v_failed boolean;
BEGIN
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES('2026-08',2026,8,'2026-08-01','2026-08-31','prep')
  ON CONFLICT(cycle_key) DO UPDATE SET status=excluded.status;
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key='2026-08';

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,monthly_cycle_id)
  VALUES(v_project,'2026-08-01','2026-08-31',100,100,100,v_cycle) RETURNING id INTO v_payment;
  INSERT INTO public.stripe_bank_transfer_intents(project_id,payment_id,accounting_period_id,actor_user_id,currency_code,expected_amount_minor,
    provider_account_id,provider_customer_id,provider_payment_intent_id,instruction_evidence_hash,deployment_environment)
  VALUES(v_project,v_payment,1,v_actor,'USD',10000,'acct_allocation','cus_allocation','pi_allocation',repeat('1',64),'local')
  RETURNING id INTO v_intent;
  INSERT INTO public.epoch_project_packages(project_id,intended_cycle_id,canonical_cycle_id,version,status,list_status,funding_status,
    compliance_status,cubid_status,cutoff_at,frozen_at,approved_at,approved_by_user_id,project_fee_assessed_once,base_fee_deferred,
    payment_count,funding_source_count,cohort_count,eligible_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id)
  VALUES(v_project,v_cycle,v_cycle,1,'approved','valid','settled','passed','eligible','2026-09-01T07:00:00Z','2026-09-01T07:00:00Z',
    '2026-09-02T00:00:00Z',v_actor,false,true,1,1,1,1,100,'{}',repeat('2',64),v_actor) RETURNING id INTO v_package;
  INSERT INTO public.epoch_project_package_funding_sources(package_id,source_position,source_kind,stripe_intent_id,asset_code,
    native_atomic_amount,preliminary_usd,source_evidence_hash,project_fee_assessed_once,base_fee_deferred)
  VALUES(v_package,0,'stripe_bank_transfer',v_intent,'USD',10000,100,repeat('3',64),false,true);
  INSERT INTO public.epoch_project_package_cohort(package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,
    locked_cubid_score,locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash)
  VALUES(v_package,101,v_actor,repeat('4',64),'valid','eligible',10,20,'2026-08-31T00:00:00Z','2026-09-02T00:00:00Z',repeat('5',64));

  v_observation:=public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','sourceKey','allocation_primary','sourceRank',1,'rateUsdPerUnit','1',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('6',64),'actorUserId',v_actor));
  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','stripe_sandbox_usd','method','primary','observationId',v_observation,
    'preanalysis',jsonb_build_object('fresh',true),'evidenceHash',repeat('7',64),'actorUserId',v_actor));
  IF public.prepare_epoch_financial_sources(jsonb_build_object('contractVersion','epoch_financial_prep.v1','deploymentEnvironment','local',
    'packageId',v_package,'actorUserId',v_actor))<>1 THEN RAISE EXCEPTION 'allocation source prep failed'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.lock_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_lock.v1',
      'deploymentEnvironment','production','cycleKey','2026-08','actorUserId',v_actor));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_allocation_runtime_disabled%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production allocation lock was accepted'; END IF;

  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES('2026-09',2026,9,'2026-09-01','2026-09-30','prep') ON CONFLICT(cycle_key) DO NOTHING;
  v_failed:=false;
  BEGIN
    PERFORM public.lock_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_lock.v1',
      'deploymentEnvironment','local','cycleKey','2026-09','actorUserId',v_actor));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_allocation_sources_missing%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'empty funded cycle created an allocation manifest'; END IF;

  v_manifest:=public.lock_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_lock.v1',
    'deploymentEnvironment','local','cycleKey','2026-08','actorUserId',v_actor));
  v_manifest_id:=(v_manifest->>'manifestId')::bigint;
  v_manifest_hash:=v_manifest->>'manifestHash';
  IF (SELECT state FROM public.epoch_valuation_source_lots WHERE package_id=v_package)<>'reserved'
    OR (SELECT reserved_exact_usd FROM public.epoch_valuation_source_lots WHERE package_id=v_package)<=0 THEN
    RAISE EXCEPTION 'allocation lock did not reserve source'; END IF;
  IF (public.lock_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_lock.v1',
    'deploymentEnvironment','local','cycleKey','2026-08','actorUserId',v_actor))->>'manifestId')::bigint<>v_manifest_id THEN
    RAISE EXCEPTION 'allocation lock was not idempotent'; END IF;

  SELECT source_lot_id,exact_usd,canonical_minor_capacity INTO v_source_lot_id,v_exact,v_funded_minor
  FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id;
  v_initial_minor:=floor((v_funded_minor+1)/2);
  v_score_minor:=v_funded_minor-v_initial_minor;
  v_initial_exact:=v_exact/2;
  v_cap_exact:=v_initial_exact*3;
  v_artifact:=jsonb_build_object(
    'policy','settled_cubid_redistribution_v1','cycleKey','2026-08','manifestHash',v_manifest_hash,'minorUnitScale',2,
    'totals',jsonb_build_object('fundedExactUsd',v_exact::text,'fundedMinor',v_funded_minor::text,
      'retainedInitialMinor',v_initial_minor::text,'scorePoolMinor',v_score_minor::text,'overlapPoolMinor','0',
      'topUpMinor',v_score_minor::text,'returnedResidueMinor','0','finalAllocationMinor',v_funded_minor::text,'subMinorExactUsd','0'),
    'users',jsonb_build_array(jsonb_build_object('userId',v_actor::text,'aggregateInitialExactUsd',v_initial_exact::text,
      'baselineExactUsd',v_initial_exact::text,'exactCapUsd',v_cap_exact::text,'minorUnitCap',floor(v_cap_exact*100)::text,
      'retainedInitialMinor',v_initial_minor::text,'topUpMinor',v_score_minor::text,'finalMinor',v_funded_minor::text,
      'projectClaims',jsonb_build_array(jsonb_build_object('projectId',v_project,'initialClaimExactUsd',v_initial_exact::text)))),
    'sourceDispositions',jsonb_build_array(
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',(SELECT source_lot_key FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id),
        'userId',v_actor::text,'projectId',v_project,'kind','initial_retained','canonicalMinor',v_initial_minor::text,'exactUsd',v_initial_exact::text),
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',(SELECT source_lot_key FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id),
        'userId',NULL,'projectId',v_project,'kind','score_pool','canonicalMinor',v_score_minor::text,'exactUsd',v_initial_exact::text),
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',(SELECT source_lot_key FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id),
        'userId',v_actor::text,'projectId',v_project,'kind','top_up','canonicalMinor',v_score_minor::text,'exactUsd',v_initial_exact::text)),
    'invariantChecks',jsonb_build_array(jsonb_build_object('code','canonical_minor_conservation','ok',true),
      jsonb_build_object('code','user_caps_respected','ok',true),jsonb_build_object('code','source_provenance_conserved','ok',true),
      jsonb_build_object('code','pool_consumption_conserved','ok',true)),
    'resultHash',repeat('8',64));
  v_run:=public.record_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v1',
    'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('8',64),'artifact',v_artifact));
  v_replay:=public.record_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v1',
    'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('8',64),'artifact',v_artifact));
  IF v_run<>v_replay OR (SELECT status FROM public.epoch_allocation_manifests WHERE id=v_manifest_id)<>'calculated' THEN
    RAISE EXCEPTION 'allocation result replay failed'; END IF;
  IF (SELECT final_allocation_minor+returned_residue_minor FROM public.epoch_allocation_runs WHERE id=v_run)<>v_funded_minor
    OR EXISTS(SELECT 1 FROM public.epoch_allocation_user_awards WHERE run_id=v_run AND final_minor>minor_unit_cap) THEN
    RAISE EXCEPTION 'allocation result did not conserve or respect cap'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.record_funded_epoch_allocation(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v1',
      'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('9',64),'artifact',v_artifact));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_allocation_result_conflict%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed allocation result replay was accepted'; END IF;

  UPDATE public.epoch_shadow_states SET monthly_cycle_id=v_cycle,current_stage='reviewing',state_version=100,is_paused=false
  WHERE accounting_period_id=(SELECT id FROM public.accounting_periods WHERE period_key='local_review_2026_08');
  INSERT INTO public.participants(project_id,user_id,is_admin) VALUES(v_project,v_actor,true)
  ON CONFLICT(project_id,user_id) DO UPDATE SET is_admin=true;

  v_failed:=false;
  BEGIN
    PERFORM public.approve_epoch_allocation_close(jsonb_build_object('contractVersion','epoch_allocation_close.v1',
      'deploymentEnvironment','production','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
      'resultHash',repeat('8',64),'rerunResultHash',repeat('8',64)));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_close_runtime_disabled%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production close approval was accepted'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.approve_epoch_allocation_close(jsonb_build_object('contractVersion','epoch_allocation_close.v1',
      'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
      'resultHash',repeat('8',64),'rerunResultHash',repeat('9',64)));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%epoch_close_approved_result_mismatch%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'mismatched deterministic rerun was accepted'; END IF;

  v_close:=public.approve_epoch_allocation_close(jsonb_build_object('contractVersion','epoch_allocation_close.v1',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
    'resultHash',repeat('8',64),'rerunResultHash',repeat('8',64)));
  v_root_hash:=v_close->>'rootHash';
  IF v_close->>'status'<>'payout_readying' OR v_root_hash !~ '^[0-9a-f]{64}$'
    OR v_root_hash=repeat('0',64) THEN RAISE EXCEPTION 'close package did not finalize'; END IF;
  v_close_replay:=public.approve_epoch_allocation_close(jsonb_build_object('contractVersion','epoch_allocation_close.v1',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
    'resultHash',repeat('8',64),'rerunResultHash',repeat('8',64)));
  IF v_close_replay->>'rootHash'<>v_root_hash THEN RAISE EXCEPTION 'close package replay was not idempotent'; END IF;
  IF (SELECT current_stage FROM public.epoch_shadow_states WHERE monthly_cycle_id=v_cycle)<>'payout_readying'
    OR (SELECT count(*) FROM public.epoch_close_artifacts WHERE close_package_id=(v_close->>'closePackageId')::bigint)<>12
    OR EXISTS(SELECT 1 FROM public.epoch_provisional_award_controls WHERE monthly_cycle_id=v_cycle
      AND (payable_status<>'not_payable' OR ownership_status<>'not_user_owned' OR status<>'conditional'))
    OR (SELECT coalesce(sum(final_award_minor),0) FROM public.epoch_provisional_award_controls WHERE monthly_cycle_id=v_cycle)<>v_funded_minor
    OR (SELECT coalesce(sum(functional_usd_amount) FILTER(WHERE side='debit'),0)-coalesce(sum(functional_usd_amount) FILTER(WHERE side='credit'),0)
      FROM public.ledger_postings posting JOIN public.ledger_transactions transaction ON transaction.id=posting.transaction_id
      WHERE transaction.idempotency_key LIKE 'epoch-close:'||v_run::text||':%')<>0
  THEN RAISE EXCEPTION 'close package award or ledger conservation failed'; END IF;
  IF (SELECT published_user_count FROM public.epoch_close_public_view WHERE cycle_key='2026-08') IS NOT NULL
    OR (SELECT row_to_json(public_row)::text FROM public.epoch_close_public_view public_row WHERE cycle_key='2026-08') LIKE '%'||v_actor::text||'%'
  THEN RAISE EXCEPTION 'public close view leaked private cohort data'; END IF;
  IF jsonb_array_length(public.read_epoch_close_scope(v_actor,'user','2026-08',NULL))<>1
    OR jsonb_array_length(public.read_epoch_close_scope(v_actor,'project','2026-08',v_project))<>1
  THEN RAISE EXCEPTION 'scoped close reads did not return expected rows'; END IF;

  v_failed:=false;
  BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM public.lock_funded_epoch_allocation('{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated allocation RPC was executable'; END IF;
  v_failed:=false;
  BEGIN EXECUTE 'SET LOCAL ROLE service_role'; INSERT INTO public.epoch_allocation_runs(manifest_id,policy_key,result_hash,artifact,funded_minor,
    retained_initial_minor,score_pool_minor,overlap_pool_minor,top_up_minor,returned_residue_minor,final_allocation_minor,actor_user_id,deployment_environment)
    VALUES(v_manifest_id,'settled_cubid_redistribution_v1',repeat('a',64),'{}',1,1,0,0,0,0,1,v_actor,'local');
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role direct allocation write was accepted'; END IF;
  v_failed:=false;
  BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM public.read_epoch_close_scope(v_actor,'user','2026-08',NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated close RPC was executable directly'; END IF;
  v_failed:=false;
  BEGIN EXECUTE 'SET LOCAL ROLE service_role'; INSERT INTO public.epoch_provisional_award_controls(approval_id,run_award_id,monthly_cycle_id,
    user_id,retained_initial_minor,redistribution_top_up_minor,final_award_minor,minor_unit_cap,approved_result_hash)
    SELECT id,(SELECT id FROM public.epoch_allocation_user_awards WHERE run_id=v_run LIMIT 1),v_cycle,v_actor,1,0,1,1,repeat('8',64)
    FROM public.epoch_allocation_approvals WHERE run_id=v_run;
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role direct provisional award write was accepted'; END IF;
END $$;

ROLLBACK;
