\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_actor uuid:='00000000-0000-4000-8000-000000000101';
  v_cycle bigint;
  v_run bigint;
  v_result bigint;
  v_credit bigint;
  v_void_result bigint;
  v_void_credit bigint;
  v_blocked jsonb;
  v_prepared jsonb;
  v_activated jsonb;
  v_replayed jsonb;
  v_rolled_back jsonb;
  v_manifest text;
  v_obligation bigint;
  v_ledger bigint;
  v_failed boolean;
BEGIN
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key='2026-05';
  INSERT INTO public.zkas_runs(month,status,usd_pool,monthly_cycle_id,created_by_user_id)
  VALUES('2026-05','draft',12.34,v_cycle,v_actor) RETURNING id INTO v_run;
  INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,
    app_count,project_count,output_row_hash,monthly_cycle_id)
  VALUES(v_run,'cutover-opening-user',true,1,12.34,1,1,repeat('a',64),v_cycle) RETURNING id INTO v_result;
  INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,
    usd_equivalent_amount,idempotency_key,credited_by_user_id)
  VALUES(v_cycle,v_run,v_result,v_actor,12.34,'cutover-credit-approved',v_actor) RETURNING id INTO v_credit;

  INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,
    app_count,project_count,output_row_hash,monthly_cycle_id)
  VALUES(v_run,'cutover-void-user',false,0,5,1,1,repeat('b',64),v_cycle) RETURNING id INTO v_void_result;
  INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,status,
    usd_equivalent_amount,idempotency_key,credited_by_user_id)
  VALUES(v_cycle,v_run,v_void_result,v_actor,'voided',5,'cutover-credit-voided',v_actor) RETURNING id INTO v_void_credit;

  v_blocked:=public.prepare_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_prepare.v1','deploymentEnvironment','local',
    'idempotencyKey','cutover-blocked-fixture','evidenceHash',repeat('c',64),'approvedOpeningBalances','[]'::jsonb));
  IF (v_blocked->>'blockerCount')::integer<>1 THEN RAISE EXCEPTION 'unapproved active credit was not blocking: %',v_blocked; END IF;
  BEGIN
    PERFORM public.activate_financial_cutover(v_actor,jsonb_build_object(
      'contractVersion','financial_cutover_activate.v1','deploymentEnvironment','local','runId',(v_blocked->>'runId')::bigint,
      'manifestHash',v_blocked->>'manifestHash','evidenceHash',repeat('d',64)));
    RAISE EXCEPTION 'blocked cutover activated';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%financial_cutover_blockers_unresolved%' THEN RAISE; END IF;
  END;

  v_prepared:=public.prepare_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_prepare.v1','deploymentEnvironment','local',
    'idempotencyKey','cutover-approved-fixture','evidenceHash',repeat('e',64),
    'approvedOpeningBalances',jsonb_build_array(jsonb_build_object(
      'sourceType','bookkeeping_credit','sourceId',v_credit::text,'evidenceHash',repeat('f',64)))));
  IF (v_prepared->>'blockerCount')::integer<>0 THEN RAISE EXCEPTION 'approved cutover retained blockers: %',v_prepared; END IF;
  v_manifest:=v_prepared->>'manifestHash';
  IF v_manifest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'manifest hash missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.financial_cutover_source_records
    WHERE run_id=(v_prepared->>'runId')::bigint AND source_type='bookkeeping_credit' AND source_id=v_credit::text
      AND classification='approved_opening_balance') THEN RAISE EXCEPTION 'opening balance classification missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.financial_cutover_source_records
    WHERE run_id=(v_prepared->>'runId')::bigint AND source_type='bookkeeping_credit' AND source_id=v_void_credit::text
      AND classification='reversed_voided') THEN RAISE EXCEPTION 'voided classification missing'; END IF;

  UPDATE public.monthly_cycle_bookkeeping_credits SET usd_equivalent_amount=12.35 WHERE id=v_credit;
  v_failed:=false;
  BEGIN
    PERFORM public.activate_financial_cutover(v_actor,jsonb_build_object(
      'contractVersion','financial_cutover_activate.v1','deploymentEnvironment','local','runId',(v_prepared->>'runId')::bigint,
      'manifestHash',v_manifest,'evidenceHash',repeat('1',64)));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%financial_cutover_source_drift%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed source activated against stale manifest'; END IF;
  UPDATE public.monthly_cycle_bookkeeping_credits SET usd_equivalent_amount=12.34 WHERE id=v_credit;

  v_activated:=public.activate_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_activate.v1','deploymentEnvironment','local','runId',(v_prepared->>'runId')::bigint,
    'manifestHash',v_manifest,'evidenceHash',repeat('1',64)));
  IF v_activated->>'status'<>'active' OR (v_activated->>'noValueTransferred')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'cutover activation result invalid: %',v_activated; END IF;
  SELECT id INTO v_obligation FROM public.user_withdrawal_obligations WHERE source_bookkeeping_credit_id=v_credit;
  IF v_obligation IS NULL OR (SELECT total_minor FROM public.user_withdrawal_obligations WHERE id=v_obligation)<>1234
  THEN RAISE EXCEPTION 'opening liability was not posted exactly'; END IF;
  SELECT ledger_transaction_id INTO v_ledger FROM public.financial_cutover_canonical_links
    WHERE run_id=(v_prepared->>'runId')::bigint AND source_record_id=(SELECT id FROM public.financial_cutover_source_records
      WHERE run_id=(v_prepared->>'runId')::bigint AND source_type='bookkeeping_credit' AND source_id=v_credit::text);
  IF v_ledger IS NULL OR (SELECT sum(functional_usd_amount) FROM public.ledger_postings WHERE transaction_id=v_ledger AND side='debit')<>12.34
    OR (SELECT sum(functional_usd_amount) FROM public.ledger_postings WHERE transaction_id=v_ledger AND side='credit')<>12.34
  THEN RAISE EXCEPTION 'opening liability ledger is not balanced'; END IF;
  IF (SELECT difference_minor FROM public.financial_cutover_reconciliation_report WHERE run_id=(v_prepared->>'runId')::bigint)<>0
  THEN RAISE EXCEPTION 'cutover reconciliation did not reach equality'; END IF;
  IF (SELECT read_source FROM public.financial_cutover_compatibility_positions WHERE legacy_credit_id=v_credit)<>'canonical_liability'
  THEN RAISE EXCEPTION 'compatibility read did not switch to canonical liability'; END IF;

  v_replayed:=public.activate_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_activate.v1','deploymentEnvironment','local','runId',(v_prepared->>'runId')::bigint,
    'manifestHash',v_manifest,'evidenceHash',repeat('1',64)));
  IF v_replayed->>'status'<>'active' OR (SELECT count(*) FROM public.user_withdrawal_obligations WHERE source_bookkeeping_credit_id=v_credit)<>1
    OR (SELECT count(*) FROM public.ledger_transactions WHERE idempotency_key='cutover-opening-credit:'||v_credit::text)<>1
  THEN RAISE EXCEPTION 'cutover replay duplicated canonical obligations'; END IF;

  v_failed:=false;
  BEGIN UPDATE public.monthly_cycle_bookkeeping_credits SET usd_equivalent_amount=99 WHERE id=v_credit;
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%legacy_financial_writes_retired%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'legacy bookkeeping write remained enabled'; END IF;
  v_failed:=false;
  BEGIN UPDATE public.payments SET notes='forbidden after cutover' WHERE id=(SELECT min(id) FROM public.payments);
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%legacy_financial_writes_retired%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'legacy payment write remained enabled'; END IF;

  v_failed:=false;
  BEGIN PERFORM public.prepare_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_prepare.v1','deploymentEnvironment','production',
    'idempotencyKey','cutover-production-denied','evidenceHash',repeat('2',64),'approvedOpeningBalances','[]'::jsonb));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%financial_cutover_contract_invalid%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production cutover was enabled'; END IF;

  v_rolled_back:=public.rollback_financial_cutover(v_actor,jsonb_build_object(
    'contractVersion','financial_cutover_rollback.v1','deploymentEnvironment','local','runId',(v_prepared->>'runId')::bigint,
    'manifestHash',v_manifest,'evidenceHash',repeat('3',64)));
  IF v_rolled_back->>'status'<>'rolled_back' OR (v_rolled_back->>'canonicalRecordsRetained')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'rollback result invalid: %',v_rolled_back; END IF;
  UPDATE public.monthly_cycle_bookkeeping_credits SET updated_at=updated_at WHERE id=v_credit;
  IF NOT EXISTS(SELECT 1 FROM public.user_withdrawal_obligations WHERE id=v_obligation)
  THEN RAISE EXCEPTION 'rollback destructively removed canonical evidence'; END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$ DECLARE v_failed boolean:=false;BEGIN
  BEGIN PERFORM public.prepare_financial_cutover('00000000-0000-4000-8000-000000000101','{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated could execute cutover'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$ DECLARE v_failed boolean:=false;BEGIN
  BEGIN INSERT INTO public.financial_cutover_runs(deployment_environment,idempotency_key,command_hash,evidence_hash,actor_user_id)
    VALUES('local','direct-write-denied',repeat('a',64),repeat('b',64),'00000000-0000-4000-8000-000000000101');
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role direct cutover write was allowed'; END IF;
END $$;
RESET ROLE;

ROLLBACK;

SELECT 'financial_cutover_control_plane_passed' AS result;
