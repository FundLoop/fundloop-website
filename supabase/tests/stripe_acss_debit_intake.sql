BEGIN;
\set ON_ERROR_STOP on

DO $$
DECLARE v_actor uuid:='290eb647-f25f-43f3-bf6b-1e2b2cf25e69';v_payment bigint;v_command uuid;v_command_replay uuid;v_evidence bigint;
  v_payment2 bigint;v_payment3 bigint;v_command2 uuid;v_command3 uuid;
  v_ledger bigint;v_reversal bigint;v_package bigint;v_cycle bigint;v_denied boolean:=false;v_direct_denied boolean:=false;
  v_base jsonb;
BEGIN
  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,100,10,v_actor) RETURNING id INTO v_payment;

  BEGIN
    PERFORM public.prepare_stripe_acss_debit_command(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','production',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','CAD','expectedAmountMinor','10000'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_acss_runtime_disabled%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'production_prepare_should_fail';END IF;

  v_denied:=false;
  BEGIN
    PERFORM public.prepare_stripe_acss_debit_command(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','USD','expectedAmountMinor','10000'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_acss_currency_unavailable%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'usd_without_evidence_should_fail';END IF;

  v_base:=jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','CAD','expectedAmountMinor','10000');
  v_command:=public.prepare_stripe_acss_debit_command(v_base);
  v_command_replay:=public.prepare_stripe_acss_debit_command(v_base);
  IF v_command<>v_command_replay THEN RAISE EXCEPTION 'prepare_not_idempotent';END IF;
  PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_command,'providerAccountId','acct_testpad',
    'providerCheckoutSessionId','cs_test_padfixture','capabilityEvidenceHash',repeat('d',64)));

  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.stripe_acss_debit_evidence(webhook_event_id,command_id,evidence_type,currency_code,gross_amount_minor,ordering_status,evidence_hash)
    VALUES(1,v_command,'processing','CAD',10000,'in_order',repeat('e',64));
  EXCEPTION WHEN insufficient_privilege THEN v_direct_denied:=true;END;
  RESET ROLE;
  IF NOT v_direct_denied THEN RAISE EXCEPTION 'authenticated_direct_write_should_fail';END IF;

  v_evidence:=public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_padprocessing','providerAccountId','acct_testpad','eventType','payment_intent.processing','providerObjectId','pi_padfixture',
    'providerCreatedAt','2026-08-08T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786180000,'payloadSha256',repeat('1',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','processing','commandId',v_command,
    'providerCheckoutSessionId','cs_test_padfixture','providerPaymentIntentId','pi_padfixture','providerChargeId','ch_padfixture','providerMandateId','mandate_padfixture',
    'providerBalanceTransactionId',NULL,'currencyCode','CAD','grossAmountMinor','10000','feeAmountMinor',NULL,'netAmountMinor',NULL,
    'balanceStatus','pending','paymentMethodType','acss_debit'));
  IF (SELECT available_for_package FROM public.stripe_acss_debit_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'processing_should_not_fund';END IF;

  v_evidence:=public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_padsettled','providerAccountId','acct_testpad','eventType','payment_intent.succeeded','providerObjectId','pi_padfixture',
    'providerCreatedAt','2026-08-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352800,'payloadSha256',repeat('2',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_command,
    'providerCheckoutSessionId','cs_test_padfixture','providerPaymentIntentId','pi_padfixture','providerChargeId','ch_padfixture','providerMandateId','mandate_padfixture',
    'providerBalanceTransactionId','txn_padfixture','currencyCode','CAD','grossAmountMinor','10000','feeAmountMinor','25','netAmountMinor','9975',
    'balanceStatus','available','paymentMethodType','acss_debit'));
  SELECT ledger_transaction_id INTO v_ledger FROM public.stripe_acss_debit_evidence WHERE id=v_evidence;
  IF v_ledger IS NULL OR NOT (SELECT available_for_package FROM public.stripe_acss_debit_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'settled_should_fund';END IF;
  IF (SELECT sum(CASE side WHEN'debit'THEN functional_usd_amount ELSE-functional_usd_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0
    OR (SELECT sum(CASE side WHEN'debit'THEN native_atomic_amount ELSE-native_atomic_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0 THEN
    RAISE EXCEPTION 'pad_ledger_not_conserved';END IF;

  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-08',2026,8,'2026-08-01','2026-08-31',v_actor,v_actor) RETURNING id INTO v_cycle;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-09',2026,9,'2026-09-01','2026-09-30',v_actor,v_actor);
  UPDATE public.payments SET monthly_cycle_id=v_cycle WHERE id=v_payment;
  v_package:=public.validate_epoch_project_package(jsonb_build_object('deploymentEnvironment','local','actorRole','internal_admin','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','cycleKey','2026-08','complianceEvidenceHash',repeat('4',64),'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed'));
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_funding_sources WHERE package_id=v_package AND source_kind='stripe_acss_debit'
      AND stripe_acss_debit_command_id=v_command) OR (SELECT funding_status FROM public.epoch_project_packages WHERE id=v_package)<>'settled' THEN
    RAISE EXCEPTION 'settled_pad_not_bound_to_exact_package';END IF;

  PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_padrefund','providerAccountId','acct_testpad','eventType','charge.refunded','providerObjectId','ch_padfixture',
    'providerCreatedAt','2026-08-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439200,'payloadSha256',repeat('3',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_padfixture','providerPaymentIntentId','pi_padfixture','providerChargeId','ch_padfixture','providerMandateId','mandate_padfixture',
    'providerBalanceTransactionId','txn_padfixture','currencyCode','CAD','grossAmountMinor','10000','feeAmountMinor','0','netAmountMinor','10000',
    'balanceStatus','available','paymentMethodType','acss_debit'));
  SELECT id INTO v_reversal FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_ledger;
  IF v_reversal IS NULL OR (SELECT available_for_package FROM public.stripe_acss_debit_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'refund_should_reverse';END IF;
  IF (SELECT funding_status FROM public.epoch_project_packages WHERE id=v_package)<>'unsettled'
    OR NOT EXISTS(SELECT 1 FROM public.stripe_acss_debit_package_invalidations WHERE command_id=v_command AND package_id=v_package AND reason='refunded') THEN
    RAISE EXCEPTION 'refund_should_invalidate_package_source';END IF;

  IF public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_padrefund','providerAccountId','acct_testpad','eventType','charge.refunded','providerObjectId','ch_padfixture',
    'providerCreatedAt','2026-08-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439200,'payloadSha256',repeat('3',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_padfixture','providerPaymentIntentId','pi_padfixture','providerChargeId','ch_padfixture','providerMandateId','mandate_padfixture',
    'providerBalanceTransactionId','txn_padfixture','currencyCode','CAD','grossAmountMinor','10000','feeAmountMinor','0','netAmountMinor','10000',
    'balanceStatus','available','paymentMethodType','acss_debit'))<>v_evidence+1 THEN NULL;END IF;
  IF (SELECT count(*) FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_ledger)<>1 THEN RAISE EXCEPTION 'refund_replay_double_reversed';END IF;

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,101,10.1,v_actor) RETURNING id INTO v_payment2;
  v_command2:=public.prepare_stripe_acss_debit_command(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment2,'currencyCode','CAD','expectedAmountMinor','10100'));
  PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_command2,'providerAccountId','acct_testpad',
    'providerCheckoutSessionId','cs_test_padterminal','capabilityEvidenceHash',repeat('d',64)));
  PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_padterminalfirst','providerAccountId','acct_testpad','eventType','charge.dispute.closed','providerObjectId','dp_padterminal',
    'providerCreatedAt','2026-08-12T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786525600,'payloadSha256',repeat('5',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','dispute_lost','commandId',v_command2,
    'providerCheckoutSessionId','cs_test_padterminal','providerPaymentIntentId','pi_padterminal','providerChargeId','ch_padterminal','providerMandateId','mandate_padterminal',
    'providerBalanceTransactionId','txn_padterminal','currencyCode','CAD','grossAmountMinor','10100','feeAmountMinor','0','netAmountMinor','10100',
    'balanceStatus','available','paymentMethodType','acss_debit'));
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_padlateavailable','providerAccountId','acct_testpad','eventType','payment_intent.succeeded','providerObjectId','pi_padterminal',
      'providerCreatedAt','2026-08-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352801,'payloadSha256',repeat('6',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_command2,
      'providerCheckoutSessionId','cs_test_padterminal','providerPaymentIntentId','pi_padterminal','providerChargeId','ch_padterminal','providerMandateId','mandate_padterminal',
      'providerBalanceTransactionId','txn_padterminal','currencyCode','CAD','grossAmountMinor','10100','feeAmountMinor','25','netAmountMinor','10075',
      'balanceStatus','available','paymentMethodType','acss_debit'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_acss_terminal_evidence_blocks_settlement%';END;
  IF NOT v_denied OR EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence WHERE command_id=v_command2 AND ledger_transaction_id IS NOT NULL) THEN
    RAISE EXCEPTION 'terminal_first_should_block_late_settlement';END IF;

  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_padwrongidentity','providerAccountId','acct_testpad','eventType','payment_intent.processing','providerObjectId','pi_padother',
      'providerCreatedAt','2026-08-13T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786612000,'payloadSha256',repeat('7',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','processing','commandId',v_command2,
      'providerCheckoutSessionId','cs_test_padterminal','providerPaymentIntentId','pi_padother','providerChargeId','ch_padterminal','providerMandateId','mandate_padterminal',
      'providerBalanceTransactionId',NULL,'currencyCode','CAD','grossAmountMinor','10100','feeAmountMinor',NULL,'netAmountMinor',NULL,
      'balanceStatus','pending','paymentMethodType','acss_debit'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_acss_provider_identity_conflict%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'provider_identity_change_should_fail';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_padmissingsession','providerAccountId','acct_testpad','eventType','payment_intent.processing','providerObjectId','pi_padterminal',
      'providerCreatedAt','2026-08-13T12:01:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786612060,'payloadSha256',repeat('a',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','processing','commandId',v_command2,
      'providerCheckoutSessionId',NULL,'providerPaymentIntentId','pi_padterminal','providerChargeId','ch_padterminal','providerMandateId','mandate_padterminal',
      'providerBalanceTransactionId',NULL,'currencyCode','CAD','grossAmountMinor','10100','feeAmountMinor',NULL,'netAmountMinor',NULL,
      'balanceStatus','pending','paymentMethodType','acss_debit'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_acss_provider_identity_missing%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'missing_checkout_session_should_fail';END IF;

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,102,10.2,v_actor) RETURNING id INTO v_payment3;
  v_command3:=public.prepare_stripe_acss_debit_command(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment3,'currencyCode','CAD','expectedAmountMinor','10200'));
  PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_command3,'providerAccountId','acct_testpad',
    'providerCheckoutSessionId','cs_test_paddispute','capabilityEvidenceHash',repeat('d',64)));
  PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_paddisputesettle','providerAccountId','acct_testpad','eventType','payment_intent.succeeded','providerObjectId','pi_paddispute',
    'providerCreatedAt','2026-08-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352802,'payloadSha256',repeat('8',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_command3,
    'providerCheckoutSessionId','cs_test_paddispute','providerPaymentIntentId','pi_paddispute','providerChargeId','ch_paddispute','providerMandateId','mandate_paddispute',
    'providerBalanceTransactionId','txn_paddispute','currencyCode','CAD','grossAmountMinor','10200','feeAmountMinor','25','netAmountMinor','10175',
    'balanceStatus','available','paymentMethodType','acss_debit'));
  PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_paddisputeopen','providerAccountId','acct_testpad','eventType','charge.dispute.created','providerObjectId','dp_paddispute',
    'providerCreatedAt','2026-08-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439202,'payloadSha256',repeat('9',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','disputed','commandId',v_command3,
    'providerCheckoutSessionId','cs_test_paddispute','providerPaymentIntentId','pi_paddispute','providerChargeId','ch_paddispute','providerMandateId','mandate_paddispute',
    'providerBalanceTransactionId','txn_paddispute','currencyCode','CAD','grossAmountMinor','10200','feeAmountMinor','0','netAmountMinor','10200',
    'balanceStatus','available','paymentMethodType','acss_debit'));
  IF (SELECT available_for_package FROM public.stripe_acss_debit_status WHERE command_id=v_command3) THEN RAISE EXCEPTION 'open_dispute_should_not_fund';END IF;
END $$;

ROLLBACK;
