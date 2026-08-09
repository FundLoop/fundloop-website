\set ON_ERROR_STOP on
BEGIN;

UPDATE public.base_intake_v2_deployments SET is_active = true, is_paused = false
WHERE deployment_environment = 'local' AND chain_id = 31337;
UPDATE public.base_intake_v2_assets SET is_enabled = true
WHERE deployment_id = (SELECT id FROM public.base_intake_v2_deployments WHERE deployment_environment = 'local' AND chain_id = 31337);
INSERT INTO public.base_project_fee_versions(project_id, version, fee_bps, evidence_hash, is_current)
VALUES (101, 1, 250, repeat('1', 64), true);

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_base_intake_v2_receipt('{}');
    RAISE EXCEPTION 'authenticated Base receipt RPC was allowed';
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
DECLARE command jsonb := jsonb_build_object(
  'contractVersion','fundloop-base-intake-v2','deploymentEnvironment','local','chainId',31337,
  'contractAddress','0x0000000000000000000000000000000000000132',
  'platformTreasuryAddress','0x0000000000000000000000000000000000000201',
  'epochTreasuryAddress','0x0000000000000000000000000000000000000202',
  'projectId',101,'accountingPeriodId',(SELECT id FROM public.accounting_periods WHERE period_key='local_review_2026_08'),
  'providerEventId','base:local:receipt:1','txHash','0x'||repeat('a',64),'logIndex',0,'blockNumber',100,
  'blockHash','0x'||repeat('b',64),'senderAddress','0x0000000000000000000000000000000000000401',
  'tokenSymbol','USDC','tokenAddress','0x0000000000000000000000000000000000000301',
  'grossNativeAmount','10000000','projectFeeBps',250,'platformFeeNativeAmount','250000',
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
    PERFORM public.record_base_intake_v2_receipt(command || jsonb_build_object('epochTreasuryAddress','0x0000000000000000000000000000000000000999','providerEventId','wrong-treasury'));
    RAISE EXCEPTION 'wrong Base treasury was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_deployment_mismatch' THEN RAISE; END IF; END;
END $$;

DO $$
DECLARE v_receipt_id bigint := (SELECT id FROM public.base_intake_v2_receipts WHERE provider_event_id='base:local:receipt:1');
  base_command jsonb := jsonb_build_object('deploymentEnvironment','local','receiptId',v_receipt_id,
    'currentBlockNumber',100,'observedBlockHash','0x'||repeat('b',64),'observedTxHash','0x'||repeat('a',64),
    'platformObservedNativeAmount','250000','epochObservedNativeAmount','9750000',
    'evidenceHash',repeat('d',64),'observedAt','2026-08-09T12:01:00Z');
BEGIN
  PERFORM public.reconcile_base_intake_v2_receipt(base_command);
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',101,'observedAt','2026-08-09T12:02:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'epochObservedNativeAmount','9749999','observedAt','2026-08-09T12:03:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'observedBlockHash','0x'||repeat('e',64),'observedAt','2026-08-09T12:04:00Z'));
  PERFORM public.reconcile_base_intake_v2_receipt(base_command || jsonb_build_object('currentBlockNumber',102,'replacementTxHash','0x'||repeat('f',64),'observedAt','2026-08-09T12:05:00Z'));
  IF (SELECT array_agg(e.status ORDER BY e.id) FROM public.base_intake_v2_reconciliation_events e WHERE e.receipt_id=v_receipt_id)
    <> ARRAY['confirming','exact','mismatch','reorged','replaced'] THEN RAISE EXCEPTION 'Base reconciliation lifecycle mismatch'; END IF;
END $$;

RESET ROLE;
UPDATE public.base_intake_v2_deployments SET is_paused = true WHERE deployment_environment='local';
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.reconcile_base_intake_v2_receipt(jsonb_build_object('deploymentEnvironment','local','receiptId',
      (SELECT id FROM public.base_intake_v2_receipts LIMIT 1)));
    RAISE EXCEPTION 'paused Base reconciliation was allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'base_intake_v2_reconciliation_disabled' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.base_intake_v2_receipts) <> 1 THEN RAISE EXCEPTION 'Base receipt dedupe residue'; END IF;
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
