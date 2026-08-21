BEGIN;
\set ON_ERROR_STOP on

DO $$
DECLARE v_actor uuid:='290eb647-f25f-43f3-bf6b-1e2b2cf25e69';v_payment bigint;v_acss uuid;v_pbb uuid;v_denied boolean:=false;
BEGIN
  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,100,10,v_actor) RETURNING id INTO v_payment;

  PERFORM public.post_project_payment_funding_quote(jsonb_build_object('contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'paymentId',v_payment,'railKey','stripe_acss_debit','currencyCode','CAD','rateUsdPerUnit','0.8',
    'sourceKey','trusted_fx_fixture','observedAt',clock_timestamp()-interval '1 minute','freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('1',64)));
  PERFORM public.post_project_payment_funding_quote(jsonb_build_object('contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'paymentId',v_payment,'railKey','stripe_pay_by_bank','currencyCode','GBP','rateUsdPerUnit','1.25',
    'sourceKey','trusted_fx_fixture','observedAt',clock_timestamp()-interval '1 minute','freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('2',64)));

  v_acss:=public.prepare_stripe_acss_debit_command(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','CAD','expectedAmountMinor','10000'));
  v_pbb:=public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','GBP','expectedAmountMinor','10000','customerCountry','GB',
    'merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank'));
  IF (SELECT expected_amount_minor FROM public.stripe_acss_debit_commands WHERE id=v_acss)<>12500
    OR (SELECT expected_amount_minor FROM public.stripe_pay_by_bank_commands WHERE id=v_pbb)<>8000 THEN
    RAISE EXCEPTION 'server_quote_did_not_convert_usd_obligation';
  END IF;

  PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_acss,'providerAccountId','acct_testpad',
    'providerCheckoutSessionId','cs_test_railacss','capabilityEvidenceHash',repeat('3',64)));
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object('commandId',v_pbb,'providerAccountId','acct_testbank',
    'providerCheckoutSessionId','cs_test_railpbb','capabilityEvidenceHash',repeat('4',64)));

  PERFORM public.ingest_stripe_acss_debit_webhook(jsonb_build_object('contractVersion','stripe_acss_debit_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_railacsssettled','providerAccountId','acct_testpad','eventType','payment_intent.succeeded','providerObjectId','pi_railacss',
    'providerCreatedAt','2026-08-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352800,'payloadSha256',repeat('5',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('3',64),'evidenceType','settled_available','commandId',v_acss,
    'providerCheckoutSessionId','cs_test_railacss','providerPaymentIntentId','pi_railacss','providerChargeId','ch_railacss','providerMandateId','mandate_railacss',
    'providerBalanceTransactionId','txn_railacss','currencyCode','CAD','grossAmountMinor','12500','feeAmountMinor','25','netAmountMinor','12475',
    'balanceStatus','available','paymentMethodType','acss_debit'));

  BEGIN
    PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_railpbbsettled','providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_railpbb',
      'providerCreatedAt','2026-08-10T12:01:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352860,'payloadSha256',repeat('6',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('4',64),'evidenceType','settled_available','commandId',v_pbb,
      'providerCheckoutSessionId','cs_test_railpbb','providerPaymentIntentId','pi_railpbb','providerChargeId','ch_railpbb','providerRefundId',NULL,
      'providerBalanceTransactionId','txn_railpbb','currencyCode','GBP','customerCountry','GB','grossAmountMinor','8000','refundAmountMinor',NULL,
      'feeAmountMinor','30','netAmountMinor','7970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%project_payment_already_settled_on_another_rail%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'second_settled_rail_should_fail';END IF;
  IF (SELECT rail_key FROM public.project_payment_settled_rail_claims WHERE payment_id=v_payment)<>'stripe_acss_debit'
    OR EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_evidence WHERE command_id=v_pbb AND evidence_type='settled_available') THEN
    RAISE EXCEPTION 'cross_rail_claim_not_atomic';
  END IF;

  v_denied:=false;
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.post_project_payment_funding_quote(jsonb_build_object('contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'paymentId',v_payment,'railKey','stripe_acss_debit','currencyCode','CAD','rateUsdPerUnit','1',
      'sourceKey','hostile','observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('7',64)));
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;END;
  RESET ROLE;
  IF NOT v_denied THEN RAISE EXCEPTION 'authenticated_quote_write_should_fail';END IF;
END $$;

ROLLBACK;
