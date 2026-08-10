BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE v_actor uuid; v_operator uuid; v_project bigint; v_cycle bigint; v_route bigint; v_asset bigint; v_intent bigint; v_request jsonb;
  v_deployment bigint; v_platform bigint; v_command jsonb; v_command_id bigint; v_period_start timestamptz; v_failed boolean; v_ledger bigint;
  v_token text:='0x00000000000000000000000000000000000000a1'; v_recipient text:='0x0000000000000000000000000000000000000001';
  v_request_hash text:='0x'||repeat('a',64); v_epoch_key text:='0x'||repeat('b',64); v_tx text:='0x'||repeat('c',64); v_block text:='0x'||repeat('d',64);
BEGIN
  SELECT user_id INTO v_actor FROM public.users WHERE email='maya@fundloop.example.com';
  SELECT user_id INTO v_operator FROM public.users WHERE user_id<>v_actor ORDER BY created_at,user_id LIMIT 1;
  SELECT id INTO v_project FROM public.projects ORDER BY id LIMIT 1;
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key='2026-10';
  UPDATE public.epoch_shadow_states SET monthly_cycle_id=v_cycle,current_stage='payout_open',updated_at=clock_timestamp()
    WHERE id=(SELECT id FROM public.epoch_shadow_states WHERE current_stage<>'closed' ORDER BY updated_at DESC,id DESC LIMIT 1);
  SELECT period.starts_at INTO v_period_start FROM public.accounting_periods period JOIN public.epoch_shadow_states state ON state.accounting_period_id=period.id
    WHERE state.monthly_cycle_id=v_cycle;
  SELECT id INTO v_route FROM public.user_payout_routes WHERE user_id=v_actor AND rail='evm' ORDER BY id LIMIT 1;
  SELECT id INTO v_asset FROM public.financial_assets WHERE asset_key='base_review_usdc';
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_route,'requestedMinor',1000,'projectId',v_project,'assetKey','base_review_usdc','userFeeBps',1000,'idempotencyKey','base-payout-control-1'));
  SELECT id INTO v_intent FROM public.payout_intents WHERE withdrawal_request_id=(v_request->>'requestId')::uuid;

  INSERT INTO public.base_safe_payout_deployments(deployment_environment,chain_id,safe_role,safe_address,module_address,paymaster_policy_address,
    limited_signer_address,module_owner_address,paymaster_owner_address,paymaster_controller_address,
    max_per_transaction_native,max_rolling_24h_native,max_per_epoch_native,is_paused,is_active,evidence_hash)
  VALUES('local',31337,'epoch','0x0000000000000000000000000000000000000010','0x0000000000000000000000000000000000000020',
    '0x0000000000000000000000000000000000000030','0x0000000000000000000000000000000000000040',
    '0x0000000000000000000000000000000000000010','0x0000000000000000000000000000000000000010','0x0000000000000000000000000000000000000020',
    20000000,500000000,5000000000,false,true,repeat('1',64))
  RETURNING id INTO v_deployment;
  INSERT INTO public.base_safe_payout_deployments(deployment_environment,chain_id,safe_role,safe_address,module_address,paymaster_policy_address,
    limited_signer_address,module_owner_address,paymaster_owner_address,paymaster_controller_address,
    max_per_transaction_native,max_rolling_24h_native,max_per_epoch_native,is_paused,is_active,evidence_hash)
  VALUES('local',31337,'platform','0x0000000000000000000000000000000000000011','0x0000000000000000000000000000000000000021',
    '0x0000000000000000000000000000000000000031','0x0000000000000000000000000000000000000041',
    '0x0000000000000000000000000000000000000011','0x0000000000000000000000000000000000000011','0x0000000000000000000000000000000000000021',
    20000000,500000000,5000000000,false,true,repeat('5',64))
  RETURNING id INTO v_platform;
  v_failed:=false; BEGIN
    INSERT INTO public.base_safe_payout_deployments(deployment_environment,chain_id,safe_role,safe_address,module_address,paymaster_policy_address,
      limited_signer_address,module_owner_address,paymaster_owner_address,paymaster_controller_address,
      max_per_transaction_native,max_rolling_24h_native,max_per_epoch_native,is_paused,is_active,evidence_hash)
    VALUES('dev',31337,'epoch','0x0000000000000000000000000000000000000050','0x0000000000000000000000000000000000000051',
      '0x0000000000000000000000000000000000000052','0x0000000000000000000000000000000000000053',
      '0x0000000000000000000000000000000000000099','0x0000000000000000000000000000000000000050','0x0000000000000000000000000000000000000051',
      20000000,500000000,5000000000,false,true,repeat('9',64));
  EXCEPTION WHEN check_violation THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'non-Safe module owner was accepted'; END IF;
  INSERT INTO public.base_safe_payout_assets VALUES(v_deployment,v_asset,v_token,true,repeat('2',64));
  INSERT INTO public.base_paymaster_budgets VALUES(v_deployment,1000000,100000,false,1,repeat('3',64),clock_timestamp());

  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','production','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_runtime_disabled%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production payout authorization was accepted'; END IF;

  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress','0x0000000000000000000000000000000000000099',
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_intent_mismatch%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong recipient was accepted'; END IF;

  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress','0x00000000000000000000000000000000000000ff',
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_token_not_allowed%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong token was accepted'; END IF;

  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000099','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_platform_safe_unavailable%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong platform Safe was accepted'; END IF;

  UPDATE public.base_safe_payout_deployments SET max_per_transaction_native=5000000 WHERE id=v_deployment;
  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_transaction_limit%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'over-limit payout was accepted'; END IF;
  UPDATE public.base_safe_payout_deployments SET max_per_transaction_native=20000000 WHERE id=v_deployment;

  UPDATE public.base_paymaster_budgets SET remaining_native=500 WHERE deployment_id=v_deployment;
  v_failed:=false; BEGIN PERFORM public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_paymaster_budget_unavailable%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'depleted paymaster was accepted'; END IF;
  UPDATE public.base_paymaster_budgets SET remaining_native=1000000 WHERE deployment_id=v_deployment;

  v_command:=public.authorize_base_safe_payout(v_operator,jsonb_build_object('contractVersion','base_safe_payout_authorize.v1',
    'deploymentEnvironment','local','deploymentId',v_deployment,'payoutIntentId',v_intent,'recipientAddress',v_recipient,
    'feeRecipientAddress','0x0000000000000000000000000000000000000011','tokenAddress',v_token,
    'nativeAtomicAmount',9000000,'userFeeNativeAmount',1000000,'requestHash',v_request_hash,'epochKey',v_epoch_key,'moduleNonce',1,
    'expiresAt','2026-12-31T00:00:00Z','gasBudgetNative',1000));
  v_command_id:=(v_command->>'commandId')::bigint;
  IF v_command->>'status'<>'authorized' OR (SELECT remaining_native FROM public.base_paymaster_budgets WHERE deployment_id=v_deployment)<>999000
    OR (SELECT sum(native_atomic_amount) FROM public.base_payout_fee_inventory_reservations WHERE command_id=v_command_id)<>1000000
  THEN RAISE EXCEPTION 'valid payout authorization failed'; END IF;

  v_failed:=false; BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM public.authorize_base_safe_payout(v_operator,'{}');
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated executed payout RPC'; END IF;
  v_failed:=false; BEGIN EXECUTE 'SET LOCAL ROLE service_role'; INSERT INTO public.base_payout_execution_commands(
    payout_execution_attempt_id,withdrawal_request_id,payout_intent_id,deployment_id,monthly_cycle_id,project_id,financial_asset_id,token_address,
    recipient_address,native_atomic_amount,request_hash,epoch_key,module_nonce,expires_at,gas_budget_native,authorized_by_user_id)
    SELECT payout_execution_attempt_id,withdrawal_request_id,payout_intent_id,deployment_id,monthly_cycle_id,project_id,financial_asset_id,token_address,
      recipient_address,native_atomic_amount,'0x'||repeat('e',64),epoch_key,2,expires_at,gas_budget_native,authorized_by_user_id
    FROM public.base_payout_execution_commands WHERE id=v_command_id;
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role bypassed typed payout command'; END IF;

  v_failed:=false; BEGIN PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','finalized','txHash',v_tx,'replacementTxHash','',
    'blockNumber',10,'blockHash',v_block,'currentBlockNumber',20,'confirmationCount',10,'l1BatchFinalized',true,'receiptSuccess',true,
    'observedTokenAddress',v_token,'observedRecipientAddress','0x0000000000000000000000000000000000000099','observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('4',64),'observedAt',v_period_start+interval '1 hour'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_observation_mismatch%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong observed recipient was accepted'; END IF;

  v_failed:=false; BEGIN PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','finalized','txHash',v_tx,'replacementTxHash','',
    'blockNumber',10,'blockHash',v_block,'currentBlockNumber',20,'confirmationCount',10,'l1BatchFinalized',false,'receiptSuccess',true,
    'observedTokenAddress',v_token,'observedRecipientAddress',v_recipient,'observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('4',64),'observedAt',v_period_start+interval '1 hour'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_finality_required%'; END;
  IF NOT v_failed OR (SELECT status FROM public.user_withdrawal_requests WHERE id=(v_request->>'requestId')::uuid)='paid'
  THEN RAISE EXCEPTION 'unfinalized payout became paid'; END IF;

  PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','failed','txHash','0x'||repeat('e',64),'replacementTxHash','',
    'blockNumber',11,'blockHash','0x'||repeat('1',64),'currentBlockNumber',11,'confirmationCount',0,'l1BatchFinalized',false,'receiptSuccess',false,
    'observedTokenAddress',v_token,'observedRecipientAddress',v_recipient,'observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('6',64),'observedAt',v_period_start+interval '2 hours'));
  PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','replaced','txHash','0x'||repeat('f',64),'replacementTxHash','0x'||repeat('2',64),
    'blockNumber',12,'blockHash','0x'||repeat('2',64),'currentBlockNumber',12,'confirmationCount',0,'l1BatchFinalized',false,'receiptSuccess',true,
    'observedTokenAddress',v_token,'observedRecipientAddress',v_recipient,'observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('7',64),'observedAt',v_period_start+interval '3 hours'));
  PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','reorged','txHash','0x'||repeat('3',64),'replacementTxHash','',
    'blockNumber',13,'blockHash','0x'||repeat('3',64),'currentBlockNumber',13,'confirmationCount',0,'l1BatchFinalized',false,'receiptSuccess',true,
    'observedTokenAddress',v_token,'observedRecipientAddress',v_recipient,'observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('8',64),'observedAt',v_period_start+interval '4 hours'));
  IF (SELECT status FROM public.user_withdrawal_requests WHERE id=(v_request->>'requestId')::uuid)='paid'
    OR (SELECT count(*) FROM public.base_payout_execution_observations WHERE command_id=v_command_id AND status IN('failed','replaced','reorged'))<>3
    OR NOT EXISTS(SELECT 1 FROM public.base_payout_execution_observations WHERE command_id=v_command_id AND status='replaced'
      AND tx_hash='0x'||repeat('f',64) AND replacement_tx_hash='0x'||repeat('2',64))
  THEN RAISE EXCEPTION 'failed replacement or reorg evidence implied paid'; END IF;

  PERFORM public.reconcile_base_safe_payout(jsonb_build_object('contractVersion','base_safe_payout_observation.v1',
    'deploymentEnvironment','local','commandId',v_command_id,'status','finalized','txHash',v_tx,'replacementTxHash','',
    'blockNumber',10,'blockHash',v_block,'currentBlockNumber',20,'confirmationCount',10,'l1BatchFinalized',true,'receiptSuccess',true,
    'observedTokenAddress',v_token,'observedRecipientAddress',v_recipient,'observedNativeAtomicAmount',9000000,
    'observedFeeRecipientAddress','0x0000000000000000000000000000000000000011','observedUserFeeNativeAmount',1000000,'observedGasBudgetNative',1000,
    'observedRequestHash',v_request_hash,'observationSource','trusted_viem_v1','evidenceHash',repeat('4',64),'observedAt',v_period_start+interval '1 hour'));
  SELECT ledger_transaction_id INTO v_ledger FROM public.base_payout_reconciliation_links WHERE command_id=v_command_id;
  IF (SELECT status FROM public.user_withdrawal_requests WHERE id=(v_request->>'requestId')::uuid)<>'paid'
    OR (SELECT status FROM public.payout_intents WHERE id=v_intent)<>'paid' OR v_ledger IS NULL
    OR (SELECT bool_and(status='consumed') FROM public.base_payout_fee_inventory_reservations WHERE command_id=v_command_id) IS NOT TRUE
    OR (SELECT sum(native_atomic_amount) FILTER(WHERE side='debit') FROM public.ledger_postings WHERE transaction_id=v_ledger)<>10000000
    OR (SELECT sum(functional_usd_amount) FILTER(WHERE side='debit') FROM public.ledger_postings WHERE transaction_id=v_ledger)
      <>(SELECT sum(functional_usd_amount) FILTER(WHERE side='credit') FROM public.ledger_postings WHERE transaction_id=v_ledger)
  THEN RAISE EXCEPTION 'finalized exact payout lacked paid state and balanced journal'; END IF;

  v_failed:=false; BEGIN UPDATE public.base_payout_execution_observations SET evidence_hash=repeat('9',64) WHERE command_id=v_command_id;
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%base_payout_evidence_append_only%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'payout observation was mutable'; END IF;
END $$;

ROLLBACK;
