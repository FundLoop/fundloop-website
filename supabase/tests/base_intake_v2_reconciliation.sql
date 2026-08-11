\set ON_ERROR_STOP on
BEGIN;

UPDATE public.base_intake_v2_deployments SET is_active = true, is_paused = false
WHERE deployment_environment = 'local' AND chain_id = 31337;
UPDATE public.base_intake_v2_assets SET is_enabled = true
WHERE deployment_id = (SELECT id FROM public.base_intake_v2_deployments WHERE deployment_environment = 'local' AND chain_id = 31337);
INSERT INTO public.base_project_fee_versions(project_id, version, fee_bps, evidence_hash, is_current)
VALUES (101, 1, 250, repeat('1', 64), true);
UPDATE public.base_project_fee_versions SET is_current=false WHERE project_id=101 AND version=1;
INSERT INTO public.base_project_fee_versions(project_id,version,fee_bps,evidence_hash,is_current)
VALUES(101,2,300,repeat('2',64),true);

DO $$
DECLARE next_environment text; next_chain bigint;
BEGIN
  FOREACH next_chain IN ARRAY ARRAY[84532::bigint, 8453::bigint] LOOP
    BEGIN
      UPDATE public.base_intake_v2_deployments SET chain_id = next_chain
      WHERE deployment_environment = 'local' AND chain_id = 31337;
      RAISE EXCEPTION 'enabled local fixture deployment moved to chain %', next_chain;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'base_intake_v2_enabled_asset_coordinates_locked' THEN RAISE; END IF;
    END;
  END LOOP;
  FOREACH next_environment IN ARRAY ARRAY['dev', 'test'] LOOP
    BEGIN
      UPDATE public.base_intake_v2_deployments SET deployment_environment = next_environment
      WHERE deployment_environment = 'local' AND chain_id = 31337;
      RAISE EXCEPTION 'enabled local fixture deployment moved to environment %', next_environment;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'base_intake_v2_enabled_asset_coordinates_locked' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    UPDATE public.base_intake_v2_deployments SET contract_address='0x0000000000000000000000000000000000009991'
    WHERE deployment_environment='local' AND chain_id=31337;
    RAISE EXCEPTION 'enabled deployment contract address changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_enabled_asset_coordinates_locked' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.base_intake_v2_deployments SET platform_treasury_address='0x0000000000000000000000000000000000009992'
    WHERE deployment_environment='local' AND chain_id=31337;
    RAISE EXCEPTION 'enabled deployment treasury changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_enabled_asset_coordinates_locked' THEN RAISE; END IF; END;

  UPDATE public.base_intake_v2_deployments SET is_active=false, is_paused=true
  WHERE deployment_environment='local' AND chain_id=31337;
  UPDATE public.base_intake_v2_deployments SET is_active=true, is_paused=false
  WHERE deployment_environment='local' AND chain_id=31337;
END $$;

INSERT INTO public.base_intake_v2_deployments(deployment_environment,chain_id,contract_address,platform_treasury_address,
  epoch_treasury_address,is_paused,is_active) VALUES('dev',84532,'0x0000000000000000000000000000000000000132',
  '0x0000000000000000000000000000000000000201','0x0000000000000000000000000000000000000202',true,false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.base_intake_v2_assets(deployment_id,symbol,token_address,is_enabled,provider_evidence_status)
    SELECT id,'USDT','0x0000000000000000000000000000000000000302',true,'unverified'
    FROM public.base_intake_v2_deployments WHERE deployment_environment='dev';
    RAISE EXCEPTION 'unverified Base Sepolia USDT was activated';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_provider_evidence_required' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.base_intake_v2_assets(deployment_id,symbol,token_address,is_enabled,provider_evidence_status)
    SELECT id,'USDC','0x0000000000000000000000000000000000000301',true,'reviewed_issuer'
    FROM public.base_intake_v2_deployments WHERE deployment_environment='dev';
    RAISE EXCEPTION 'wrong Base Sepolia USDC address was activated';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_provider_evidence_required' THEN RAISE; END IF; END;
END $$;

INSERT INTO public.base_intake_v2_deployments(deployment_environment,chain_id,contract_address,platform_treasury_address,
  epoch_treasury_address,is_paused,is_active) VALUES
  ('local',84532,'0x0000000000000000000000000000000000001132','0x0000000000000000000000000000000000001201','0x0000000000000000000000000000000000001202',true,false),
  ('local',8453,'0x0000000000000000000000000000000000002132','0x0000000000000000000000000000000000002201','0x0000000000000000000000000000000000002202',true,false);
DO $$
DECLARE chain bigint;
BEGIN
  FOREACH chain IN ARRAY ARRAY[84532::bigint,8453::bigint] LOOP
    BEGIN
      INSERT INTO public.base_intake_v2_assets(deployment_id,symbol,token_address,is_enabled,provider_evidence_status)
      SELECT id,'USDT',CASE chain WHEN 84532 THEN '0x0000000000000000000000000000000000001302' ELSE '0x0000000000000000000000000000000000002302' END,
        true,'local_fixture_only' FROM public.base_intake_v2_deployments
      WHERE deployment_environment='local' AND chain_id=chain;
      RAISE EXCEPTION 'local fixture provider asset was allowed on chain %',chain;
    EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_provider_evidence_required' THEN RAISE; END IF; END;
    BEGIN
      UPDATE public.base_intake_v2_deployments SET is_paused=false,is_active=true
      WHERE deployment_environment='local' AND chain_id=chain;
      SET CONSTRAINTS base_intake_v2_deployment_activation IMMEDIATE;
      RAISE EXCEPTION 'fixture-less local deployment activated on chain %',chain;
    EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_activation_evidence_missing' THEN RAISE; END IF; END;
    SET CONSTRAINTS base_intake_v2_deployment_activation DEFERRED;
  END LOOP;
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_base_intake_v2_receipt('{}');
    RAISE EXCEPTION 'authenticated Base receipt RPC was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.reconcile_base_intake_v2_receipt(jsonb_build_object('receiptId',1,'observationSource','trusted_viem_v1',
      'platformObservedNativeAmount','250000','epochObservedNativeAmount','9750000'));
    RAISE EXCEPTION 'authenticated crafted Base reconciliation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.base_intake_v2_receipts(deployment_id, project_id, accounting_period_id, fee_version_id,
      provider_event_id, tx_hash, log_index, block_number, block_hash, sender_address, token_symbol, token_address,
      gross_native_amount, project_fee_bps, platform_fee_native_amount, net_epoch_native_amount,
      platform_treasury_address, epoch_treasury_address, evidence_hash, observed_at)
    SELECT d.id, 101, p.id, f.id, 'browser-forged', '0x' || repeat('1',64), 0, 1, '0x' || repeat('2',64),
      '0x0000000000000000000000000000000000000999', 'USDC', '0x0000000000000000000000000000000000000301',
      100, 250, 2, 98, d.platform_treasury_address, d.epoch_treasury_address, repeat('3',64), now()
    FROM public.base_intake_v2_deployments d, public.accounting_periods p, public.base_project_fee_versions f LIMIT 1;
    RAISE EXCEPTION 'authenticated Base receipt write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.base_intake_v2_deployments DEFAULT VALUES;
    RAISE EXCEPTION 'service role direct Base deployment write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(jsonb_build_object('deploymentEnvironment','production'));
    RAISE EXCEPTION 'production Base receipt was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_disabled' THEN RAISE; END IF; END;
END $$;

DO $$
DECLARE source_value jsonb;
BEGIN
  FOREACH source_value IN ARRAY ARRAY[
    '{}'::jsonb,
    '{"observationSource":null}'::jsonb,
    '{"observationSource":"caller_asserted"}'::jsonb
  ] LOOP
    BEGIN
      PERFORM public.reconcile_base_intake_v2_receipt(source_value || jsonb_build_object('receiptId',1,'deploymentEnvironment','local'));
      RAISE EXCEPTION 'untrusted observation source was allowed: %',source_value;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'base_intake_v2_trusted_observation_required' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

DO $$
DECLARE command jsonb := jsonb_build_object(
  'contractVersion','fundloop-base-intake-v2','deploymentEnvironment','local','chainId',31337,
  'contractAddress','0x0000000000000000000000000000000000000132',
  'platformTreasuryAddress','0x0000000000000000000000000000000000000201',
  'epochTreasuryAddress','0x0000000000000000000000000000000000000202',
  'projectId',101,'accountingPeriodId',(SELECT id FROM public.accounting_periods WHERE period_key='local_review_2026_08'),
  'providerEventId','base:local:receipt:1','txHash','0x'||repeat('a',64),'logIndex',0,
  'receiptReference','0x'||repeat('1',64),'blockNumber',100,
  'blockHash','0x'||repeat('b',64),'senderAddress','0x0000000000000000000000000000000000000401',
  'tokenSymbol','USDC','tokenAddress','0x0000000000000000000000000000000000000301',
  'grossNativeAmount','10000000','projectFeeBps',250,'projectFeeVersion',1,'platformFeeNativeAmount','250000',
  'netEpochNativeAmount','9750000','evidenceHash',repeat('c',64),'observedAt','2026-08-09T12:00:00Z'
); first_id bigint; replay_id bigint;
BEGIN
  first_id := public.record_base_intake_v2_receipt(command);
  replay_id := public.record_base_intake_v2_receipt(command);
  IF first_id <> replay_id THEN RAISE EXCEPTION 'Base receipt replay changed canonical id'; END IF;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object('tokenAddress','0x0000000000000000000000000000000000000999','providerEventId','evil-token'));
    RAISE EXCEPTION 'malicious Base token was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_token_not_allowed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object('projectFeeBps',300,'providerEventId','wrong-fee'));
    RAISE EXCEPTION 'wrong Base fee snapshot was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_fee_snapshot_mismatch' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object('projectFeeVersion',2,'providerEventId','wrong-fee-version'));
    RAISE EXCEPTION 'wrong Base fee version was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_fee_snapshot_mismatch' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object('epochTreasuryAddress','0x0000000000000000000000000000000000000999','providerEventId','wrong-treasury'));
    RAISE EXCEPTION 'wrong Base treasury was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_deployment_mismatch' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object(
      'providerEventId','duplicate-log','receiptReference','0x'||repeat('2',64)));
    RAISE EXCEPTION 'duplicate transaction log was recorded';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object(
    'providerEventId','base:local:receipt:2','logIndex',1,'receiptReference','0x'||repeat('2',64)));
END $$;

DO $$
DECLARE v_receipt_id bigint := (SELECT id FROM public.base_intake_v2_receipts WHERE provider_event_id='base:local:receipt:1');
  base_command jsonb := jsonb_build_object('deploymentEnvironment','local','receiptId',v_receipt_id,
    'currentBlockNumber',100,'observedReceiptBlockNumber',100,
    'observedBlockHash','0x'||repeat('b',64),'observedTxHash','0x'||repeat('a',64),
    'platformObservedNativeAmount','250000','epochObservedNativeAmount','9750000',
    'evidenceHash',repeat('d',64),'observedAt','2026-08-09T12:01:00Z','observationSource','trusted_viem_v1',
    'receiptEventMatched',true,'observedLogIndex',0,'observedReceiptReference','0x'||repeat('1',64));
BEGIN
  PERFORM public.reconcile_base_intake_v2_receipt(base_command);
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',101,'observedAt','2026-08-09T12:02:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'epochObservedNativeAmount','9749999','observedAt','2026-08-09T12:03:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'observedBlockHash','0x'||repeat('e',64),'observedAt','2026-08-09T12:04:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'replacementTxHash','0x'||repeat('f',64),'observedAt','2026-08-09T12:05:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',101,
    'observedReceiptBlockNumber',101,'observedAt','2026-08-09T12:06:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',101,
    'observedLogIndex',1,'observedReceiptReference','0x'||repeat('2',64),'receiptEventMatched',true,
    'observedAt','2026-08-09T12:07:00Z'));
  IF (SELECT array_agg(e.status ORDER BY e.id) FROM public.base_intake_v2_reconciliation_events e WHERE e.receipt_id=v_receipt_id)
    <> ARRAY['confirming','exact','mismatch','reorged','replaced','mismatch','mismatch'] THEN RAISE EXCEPTION 'Base reconciliation lifecycle mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.base_intake_v2_reconciliation_events
    WHERE receipt_id=v_receipt_id AND observed_receipt_block_number=101 AND status='exact') THEN
    RAISE EXCEPTION 'stored low block number became exact';
  END IF;
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',103,'observedAt','2026-08-09T12:09:00Z'));
  IF (SELECT status FROM public.base_intake_v2_reconciliation_events WHERE receipt_id=v_receipt_id ORDER BY observed_at DESC,id DESC LIMIT 1)<>'exact' THEN
    RAISE EXCEPTION 'Base exact latest evidence missing for financial prep';
  END IF;
END $$;

RESET ROLE;
DO $$
DECLARE v_actor uuid:='00000000-0000-4000-8000-000000000101';v_cohort_user uuid;v_cycle bigint;v_package bigint;v_receipt bigint;v_source_row bigint;v_fx_observation bigint;v_prep_count integer;
BEGIN
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES('2026-08',2026,8,'2026-08-01','2026-08-31','prep') ON CONFLICT(cycle_key)DO UPDATE SET status=excluded.status
  RETURNING id INTO v_cycle;
  SELECT id INTO v_receipt FROM public.base_intake_v2_receipts WHERE provider_event_id='base:local:receipt:1';
  SELECT row.id,row.user_id INTO v_source_row,v_cohort_user FROM public.project_attribution_rows row
  WHERE row.project_id=101 AND row.user_id IS NOT NULL ORDER BY row.id LIMIT 1;
  INSERT INTO public.epoch_project_packages(project_id,intended_cycle_id,canonical_cycle_id,version,status,list_status,funding_status,
    compliance_status,cubid_status,cutoff_at,approved_at,approved_by_user_id,project_fee_assessed_once,base_fee_deferred,
    payment_count,funding_source_count,cohort_count,eligible_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id)
  VALUES(101,v_cycle,v_cycle,1,'approved','valid','settled','passed','eligible','2026-09-01T07:00:00Z','2026-09-02T00:00:00Z',v_actor,
    true,true,0,1,1,1,9.75,'{}',repeat('6',64),v_actor) RETURNING id INTO v_package;
  INSERT INTO public.epoch_project_package_funding_sources(package_id,source_position,source_kind,base_receipt_id,asset_code,
    native_atomic_amount,preliminary_usd,source_evidence_hash,project_fee_assessed_once,base_fee_deferred)
  SELECT v_package,0,'base_stablecoin',receipt.id,receipt.token_symbol,receipt.net_epoch_native_amount,9.75,receipt.evidence_hash,true,true
  FROM public.base_intake_v2_receipts receipt WHERE receipt.id=v_receipt;
  INSERT INTO public.epoch_project_package_cohort(package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,
    locked_cubid_score,locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash)
  VALUES(v_package,v_source_row,v_cohort_user,repeat('9',64),'valid','eligible',10,20,clock_timestamp(),clock_timestamp()+interval '1 day',repeat('a',64));
  v_fx_observation:=public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','base_usdc','sourceKey','base_primary_fixture','sourceRank',1,'rateUsdPerUnit','1',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('7',64),'actorUserId',v_actor));
  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-08','assetKey','base_usdc','method','primary','observationId',v_fx_observation,'preanalysis',jsonb_build_object('fresh',true),
    'evidenceHash',repeat('8',64),'actorUserId',v_actor));
  v_prep_count:=public.prepare_epoch_financial_sources(jsonb_build_object('contractVersion','epoch_financial_prep.v1','deploymentEnvironment','local',
    'packageId',v_package,'actorUserId',v_actor));
  IF v_prep_count<>1 OR NOT EXISTS(SELECT 1 FROM public.epoch_valuation_source_lots lot
      JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
      JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id
      WHERE lot.package_id=v_package AND lot.source_kind='base_stablecoin' AND asset.asset_key='base_usdc'
        AND custody.custody_key='base_usdc_epoch_treasury' AND lot.native_atomic_amount=9750000 AND lot.gross_exact_usd=9.75)
    OR NOT EXISTS(SELECT 1 FROM public.epoch_funded_allocation_lock_candidates WHERE package_id=v_package AND source_kind='base_stablecoin') THEN
    RAISE EXCEPTION 'settled_base_did_not_reach_financial_prep';END IF;
END $$;

DO $$
DECLARE v_receipt_id bigint := (SELECT id FROM public.base_intake_v2_receipts WHERE provider_event_id='base:local:receipt:2');
  reconciliation_id bigint;
BEGIN
  reconciliation_id := public.reconcile_base_intake_v2_receipt(jsonb_build_object(
    'deploymentEnvironment','local','receiptId',v_receipt_id,'currentBlockNumber',101,
    'observedReceiptBlockNumber',100,'observedBlockHash','0x'||repeat('b',64),'observedTxHash','0x'||repeat('a',64),
    'platformObservedNativeAmount','250000','epochObservedNativeAmount','9750000','evidenceHash',repeat('e',64),
    'observedAt','2026-08-09T12:08:00Z','observationSource','trusted_viem_v1','receiptEventMatched',true,
    'observedLogIndex',0,'observedReceiptReference','0x'||repeat('1',64)));
  IF (SELECT status FROM public.base_intake_v2_reconciliation_events WHERE id=reconciliation_id) <> 'mismatch' THEN
    RAISE EXCEPTION 'wrong log/reference receipt reconciled';
  END IF;
END $$;

RESET ROLE;
UPDATE public.base_intake_v2_deployments SET is_paused = true WHERE deployment_environment='local';
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.reconcile_base_intake_v2_receipt(jsonb_build_object('deploymentEnvironment','local','receiptId',
      (SELECT id FROM public.base_intake_v2_receipts LIMIT 1),'observationSource','trusted_viem_v1'));
    RAISE EXCEPTION 'paused Base reconciliation was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_reconciliation_disabled' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.base_intake_v2_receipts) <> 2 THEN RAISE EXCEPTION 'Base receipt identity residue'; END IF;
  IF EXISTS(SELECT 1 FROM public.base_intake_v2_receipts WHERE gross_native_amount <> platform_fee_native_amount + net_epoch_native_amount) THEN
    RAISE EXCEPTION 'Base treasury conservation failed';
  END IF;
END $$;

DO $$ BEGIN
  BEGIN
    UPDATE public.base_intake_v2_receipts SET evidence_hash=repeat('9',64);
    RAISE EXCEPTION 'owner Base receipt update was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_append_only' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM public.base_intake_v2_reconciliation_events;
    RAISE EXCEPTION 'owner Base reconciliation delete was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_append_only' THEN RAISE; END IF; END;
END $$;

ROLLBACK;
SELECT 'Base intake V2 SQL validation passed' AS result;
