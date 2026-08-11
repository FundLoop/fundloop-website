BEGIN;
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_actor uuid:='290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_payment bigint;v_terminal_payment bigint;v_command uuid;v_terminal uuid;v_evidence bigint;
  v_ledger bigint;v_reversal bigint;v_residual bigint;v_second_residual bigint;v_package bigint;v_cycle bigint;
  v_denied boolean:=false;v_direct_denied boolean:=false;v_base jsonb;
BEGIN
  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,100,10,v_actor) RETURNING id INTO v_payment;

  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','production',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','GBP','expectedAmountMinor','10000',
      'customerCountry','GB','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank','privatePreviewEnabled',false));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_runtime_disabled%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'production_prepare_should_fail';END IF;

  v_denied:=false;
  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','EUR','expectedAmountMinor','10000',
      'customerCountry','DE','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank','privatePreviewEnabled',true));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_private_preview_unavailable%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'private_preview_should_fail';END IF;

  v_denied:=false;
  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','GBP','expectedAmountMinor','10000',
      'customerCountry','GB','merchantCountry','CA','chargeTopology','destination','providerAccountId','acct_testbank','platformAccountId','acct_testbank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_eligibility_mismatch%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'unimplemented_topology_should_fail';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','GBP','expectedAmountMinor','10000',
      'customerCountry','GB','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_connected','platformAccountId','acct_testbank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_topology_account_mismatch%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'topology_account_mismatch_should_fail';END IF;

  v_base:=jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','GBP','expectedAmountMinor','10000','customerCountry','GB',
    'merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank','privatePreviewEnabled',false);
  v_command:=public.prepare_stripe_pay_by_bank_command(v_base);
  IF v_command<>public.prepare_stripe_pay_by_bank_command(v_base) THEN RAISE EXCEPTION 'prepare_not_idempotent';END IF;
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object('commandId',v_command,'providerAccountId','acct_testbank',
    'providerCheckoutSessionId','cs_test_bankfixture','capabilityEvidenceHash',repeat('d',64)));

  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.stripe_pay_by_bank_evidence(webhook_event_id,command_id,evidence_type,currency_code,gross_amount_minor,ordering_status,evidence_hash)
    VALUES(1,v_command,'processing','GBP',10000,'in_order',repeat('e',64));
  EXCEPTION WHEN insufficient_privilege THEN v_direct_denied:=true;END;
  RESET ROLE;
  IF NOT v_direct_denied THEN RAISE EXCEPTION 'authenticated_direct_write_should_fail';END IF;

  v_evidence:=public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_banksettled','providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_bankfixture',
    'providerCreatedAt','2026-08-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352800,'payloadSha256',repeat('2',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId',NULL,
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor',NULL,
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT ledger_transaction_id INTO v_ledger FROM public.stripe_pay_by_bank_evidence WHERE id=v_evidence;
  IF v_ledger IS NULL OR NOT (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'settled_should_fund';END IF;
  IF (SELECT sum(CASE side WHEN'debit'THEN native_atomic_amount ELSE-native_atomic_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0
    OR (SELECT sum(CASE side WHEN'debit'THEN functional_usd_amount ELSE-functional_usd_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0 THEN
    RAISE EXCEPTION 'pay_by_bank_ledger_not_conserved';END IF;

  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-08',2026,8,'2026-08-01','2026-08-31',v_actor,v_actor) RETURNING id INTO v_cycle;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-09',2026,9,'2026-09-01','2026-09-30',v_actor,v_actor);
  UPDATE public.payments SET monthly_cycle_id=v_cycle WHERE id=v_payment;
  v_package:=public.validate_epoch_project_package(jsonb_build_object('deploymentEnvironment','local','actorRole','internal_admin','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','cycleKey','2026-08','complianceEvidenceHash',repeat('4',64),'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed'));
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_funding_sources WHERE package_id=v_package AND source_kind='stripe_pay_by_bank'
      AND stripe_pay_by_bank_command_id=v_command AND asset_code='GBP' AND native_atomic_amount=10000) THEN
    RAISE EXCEPTION 'settled_source_not_bound_to_package';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundpending','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture',
    'providerCreatedAt','2026-08-11T10:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786432000,'payloadSha256',repeat('3',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refund_pending','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','0',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command)
    OR (SELECT funding_status FROM public.epoch_project_packages WHERE id=v_package)<>'unsettled'
    OR NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_package_invalidations WHERE command_id=v_command AND reason='refund_pending') THEN
    RAISE EXCEPTION 'refund_pending_should_invalidate';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundfailed','providerAccountId','acct_testbank','eventType','refund.failed','providerObjectId','re_bankfixture',
    'providerCreatedAt','2026-08-11T11:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786435600,'payloadSha256',repeat('a',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refund_failed','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','0',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE command_id=v_command AND provider_refund_id='re_bankfixture'
      AND evidence_type='refund_failed' AND current_refund_amount_minor=2500 AND cumulative_successful_refund_amount_minor=0) THEN
    RAISE EXCEPTION 'refund_failed_current_and_cumulative_amounts_not_preserved';END IF;
  v_direct_denied:=false;
  BEGIN
    UPDATE public.stripe_pay_by_bank_refund_observations SET current_refund_amount_minor=1 WHERE command_id=v_command;
  EXCEPTION WHEN OTHERS THEN v_direct_denied:=SQLERRM LIKE '%stripe_pay_by_bank_records_are_append_only%';END;
  IF NOT v_direct_denied THEN RAISE EXCEPTION 'refund_observations_should_be_append_only';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefunded','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture',
    'providerCreatedAt','2026-08-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439200,'payloadSha256',repeat('5',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','2500',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT id INTO v_reversal FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_ledger;
  SELECT e.ledger_transaction_id INTO v_residual FROM public.stripe_pay_by_bank_evidence e WHERE command_id=v_command AND evidence_type='refunded' ORDER BY id DESC LIMIT 1;
  IF v_reversal IS NULL OR v_residual IS NULL OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_residual AND side='debit')<>7500
    OR (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'partial_refund_conservation_failed';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefunded2','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture2',
    'providerCreatedAt','2026-08-11T13:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786442800,'payloadSha256',repeat('8',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture2',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT e.ledger_transaction_id INTO v_second_residual FROM public.stripe_pay_by_bank_evidence e
    WHERE command_id=v_command AND provider_refund_id='re_bankfixture2';
  IF v_second_residual IS NULL OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000
    OR NOT EXISTS(SELECT 1 FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_residual) THEN
    RAISE EXCEPTION 'sequential_partial_refund_should_replace_residual';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefunded2replay','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture2',
    'providerCreatedAt','2026-08-11T13:05:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786443100,'payloadSha256',repeat('b',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture2',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefunded2replay')
    OR (SELECT count(*) FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id))<>1
    OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000 THEN
    RAISE EXCEPTION 'same_status_provider_replay_should_be_idempotent';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundedstale','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture4',
    'providerCreatedAt','2026-08-11T13:10:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786443400,'payloadSha256',repeat('c',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture4',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','2500',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefundedstale')
    OR (SELECT count(*) FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id))<>1
    OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000 THEN
    RAISE EXCEPTION 'decreasing_cumulative_refund_should_not_enlarge_residual';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundedfull','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture3',
    'providerCreatedAt','2026-08-11T14:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786446400,'payloadSha256',repeat('9',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture3',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','10000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_second_residual)
    OR EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id)) THEN
    RAISE EXCEPTION 'full_refund_should_retire_all_residuals';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE command_id=v_command AND provider_refund_id='re_bankfixture3'
      AND evidence_type='refunded' AND current_refund_amount_minor=5000 AND cumulative_successful_refund_amount_minor=10000) THEN
    RAISE EXCEPTION 'successful_refund_current_and_cumulative_amounts_not_preserved';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundedafterfull','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture5',
    'providerCreatedAt','2026-08-11T15:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786450000,'payloadSha256',repeat('f',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture5',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefundedafterfull')
    OR EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id)) THEN
    RAISE EXCEPTION 'stale_refund_after_full_should_not_recreate_residual';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_bankrefundedafterfull','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture5',
      'providerCreatedAt','2026-08-11T15:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786450001,'payloadSha256',repeat('e',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
      'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture5',
      'providerBalanceTransactionId','txn_bankfixture','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','5000',
      'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_webhook_dedupe_conflict%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'changed_stale_provider_event_should_conflict';END IF;

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,101,10.1,v_actor) RETURNING id INTO v_terminal_payment;
  v_terminal:=public.prepare_stripe_pay_by_bank_command(v_base||jsonb_build_object('paymentId',v_terminal_payment,'expectedAmountMinor','10100'));
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object('commandId',v_terminal,'providerAccountId','acct_testbank',
    'providerCheckoutSessionId','cs_test_bankterminal','capabilityEvidenceHash',repeat('d',64)));
  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankexpired','providerAccountId','acct_testbank','eventType','checkout.session.expired','providerObjectId','cs_test_bankterminal',
    'providerCreatedAt','2026-08-12T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786525600,'payloadSha256',repeat('6',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','expired','commandId',v_terminal,
    'providerCheckoutSessionId','cs_test_bankterminal','providerPaymentIntentId',NULL,'providerChargeId',NULL,'providerRefundId',NULL,
    'providerBalanceTransactionId',NULL,'currencyCode','GBP','customerCountry','GB','grossAmountMinor','10100','refundAmountMinor',NULL,
    'feeAmountMinor',NULL,'netAmountMinor',NULL,'balanceStatus',NULL,'paymentMethodType',NULL));
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_banklate','providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_bankterminal',
      'providerCreatedAt','2026-08-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439201,'payloadSha256',repeat('7',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_terminal,
      'providerCheckoutSessionId','cs_test_bankterminal','providerPaymentIntentId','pi_bankterminal','providerChargeId','ch_bankterminal','providerRefundId',NULL,
      'providerBalanceTransactionId','txn_bankterminal','currencyCode','GBP','customerCountry','GB','grossAmountMinor','10100','refundAmountMinor',NULL,
      'feeAmountMinor','30','netAmountMinor','10070','balanceStatus','available','paymentMethodType','pay_by_bank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_terminal_evidence_blocks_settlement%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'expired_should_block_late_settlement';END IF;
END $$;

ROLLBACK;
