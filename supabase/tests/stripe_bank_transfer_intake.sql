\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_actor uuid;
  v_project_id bigint;
  v_payment_id bigint;
  v_intent_id bigint;
  v_replay bigint;
  v_available jsonb;
  v_refund jsonb;
  v_result record;
  v_ledger bigint;
  v_payment_status bigint;
BEGIN
  SELECT p.id,pa.id,participant.user_id INTO v_project_id,v_payment_id,v_actor
  FROM public.projects p JOIN public.payments pa ON pa.project_id=p.id
  JOIN public.participants participant ON participant.project_id=p.id AND participant.is_admin
  WHERE p.slug='ecostream' ORDER BY pa.id LIMIT 1;
  INSERT INTO public.accounting_periods(period_key,starts_at,ends_at)
  VALUES('stripe_fixture_2025_q1','2025-01-01Z','2025-04-01Z') ON CONFLICT(period_key)DO NOTHING;
  SELECT status_id INTO v_payment_status FROM public.payments WHERE id=v_payment_id;

  v_intent_id:=public.record_stripe_bank_transfer_intent(jsonb_build_object(
    'contractVersion','stripe_bank_transfer_intent.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','ecostream','paymentId',v_payment_id,'currencyCode','USD','expectedAmountMinor','128000',
    'providerAccountId','acct_FundLoopSandbox131','providerCustomerId','cus_FundLoopPayment131',
    'providerPaymentIntentId','pi_FundLoopPayment131','evidenceHash',repeat('1',64)));
  v_replay:=public.record_stripe_bank_transfer_intent(jsonb_build_object(
    'contractVersion','stripe_bank_transfer_intent.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','ecostream','paymentId',v_payment_id,'currencyCode','USD','expectedAmountMinor','128000',
    'providerAccountId','acct_FundLoopSandbox131','providerCustomerId','cus_FundLoopPayment131',
    'providerPaymentIntentId','pi_FundLoopPayment131','evidenceHash',repeat('1',64)));
  IF v_replay<>v_intent_id THEN RAISE EXCEPTION 'stripe intent replay changed identity';END IF;
  BEGIN
    PERFORM public.record_stripe_bank_transfer_intent(jsonb_build_object('deploymentEnvironment','local','actorUserId',v_actor,'projectSlug','ecostream',
      'paymentId',v_payment_id,'currencyCode','CAD','expectedAmountMinor','128000','providerAccountId','acct_FundLoopSandbox131',
      'providerCustomerId','cus_CadDenied131','providerPaymentIntentId','pi_CadDenied131','evidenceHash',repeat('2',64)));
    RAISE EXCEPTION 'CAD bank transfer accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%cad_bank_transfer_unavailable%'THEN RAISE;END IF;END;
  BEGIN
    PERFORM public.record_stripe_bank_transfer_intent(jsonb_build_object('deploymentEnvironment','production','actorUserId',v_actor,'projectSlug','ecostream',
      'paymentId',v_payment_id,'currencyCode','USD','expectedAmountMinor','128000','providerAccountId','acct_FundLoopSandbox131',
      'providerCustomerId','cus_ProdDenied131','providerPaymentIntentId','pi_ProdDenied131','evidenceHash',repeat('2',64)));
    RAISE EXCEPTION 'production Stripe intent accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%runtime_disabled%'THEN RAISE;END IF;END;

  PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(jsonb_build_object(
    'contractVersion','stripe_bank_transfer_webhook.v1','deploymentEnvironment','local','providerEventId','evt_Funded131',
    'providerAccountId','acct_FundLoopSandbox131','eventType','customer_cash_balance_transaction.created','providerObjectId','ccsbtxn_Funded131',
    'providerPaymentIntentId',NULL,'providerCustomerId','cus_FundLoopPayment131','providerCreatedAt','2025-03-20T12:00:00Z','apiVersion','2026-07-29.dahlia',
    'signatureTimestamp',1742472000,'payloadSha256',repeat('3',64),'livemode',false,'observationSource','stripe_sdk_v1','evidenceType','funded',
    'currencyCode','USD','grossAmountMinor','128000','feeAmountMinor','0','netAmountMinor','128000','providerBalanceTransactionId',NULL,
    'balanceSnapshots',jsonb_build_array(jsonb_build_object('currencyCode','USD','availableAmountMinor','0','pendingAmountMinor','128000')),
    'balanceEvidenceHash',repeat('4',64)));

  v_available:=jsonb_build_object(
    'contractVersion','stripe_bank_transfer_webhook.v1','deploymentEnvironment','local','providerEventId','evt_Available131',
    'providerAccountId','acct_FundLoopSandbox131','eventType','payment_intent.succeeded','providerObjectId','pi_FundLoopPayment131',
    'providerPaymentIntentId','pi_FundLoopPayment131','providerCustomerId','cus_FundLoopPayment131','providerCreatedAt','2025-03-21T12:00:00Z',
    'apiVersion','2026-07-29.dahlia','signatureTimestamp',1742558400,'payloadSha256',repeat('5',64),'livemode',false,
    'observationSource','stripe_sdk_v1','evidenceType','available','currencyCode','USD','grossAmountMinor','128000','feeAmountMinor','1000',
    'netAmountMinor','127000','providerBalanceTransactionId','txn_Available131','providerBalanceCurrencyCode','USD',
    'providerBalanceGrossAmountMinor','128000','providerBalanceFeeAmountMinor','1000','providerBalanceNetAmountMinor','127000',
    'balanceSnapshots',jsonb_build_array(jsonb_build_object('currencyCode','USD','availableAmountMinor','127000','pendingAmountMinor','0')),
    'balanceEvidenceHash',repeat('6',64));
  SELECT * INTO v_result FROM public.ingest_stripe_bank_transfer_webhook(v_available);
  v_ledger:=v_result.ledger_transaction_id;
  IF v_ledger IS NULL OR NOT EXISTS(SELECT 1 FROM public.shadow_financial_journals WHERE ledger_transaction_id=v_ledger)
    OR NOT EXISTS(SELECT 1 FROM public.external_funding_applications a JOIN public.external_financial_events e ON e.id=a.event_id WHERE e.provider_event_id='evt_Available131')
    THEN RAISE EXCEPTION 'available Stripe event was not shadow journaled';END IF;
  IF NOT(SELECT available_for_shadow_close FROM public.stripe_bank_transfer_status WHERE intent_id=v_intent_id)
    THEN RAISE EXCEPTION 'signed availability did not unlock shadow close';END IF;
  PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available);
  PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available||jsonb_build_object(
    'signatureTimestamp',1742558460,
    'balanceSnapshots',jsonb_build_array(jsonb_build_object('currencyCode','USD','availableAmountMinor','128000','pendingAmountMinor','0')),
    'balanceEvidenceHash',repeat('d',64)));
  IF(SELECT count(*) FROM public.stripe_webhook_events WHERE provider_event_id='evt_Available131')<>1 THEN RAISE EXCEPTION 'webhook replay duplicated';END IF;
  BEGIN
    PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available||jsonb_build_object('grossAmountMinor','127999'));
    RAISE EXCEPTION 'changed webhook replay accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%dedupe_conflict%'THEN RAISE;END IF;END;
  BEGIN
    PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available||jsonb_build_object('providerEventId','evt_Mismatch131','grossAmountMinor','127999','payloadSha256',repeat('7',64)));
    RAISE EXCEPTION 'amount mismatch accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%available_evidence_mismatch%'THEN RAISE;END IF;END;
  BEGIN
    PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available||jsonb_build_object('providerEventId','evt_AccountMismatch131','providerAccountId','acct_OtherSandbox',
      'payloadSha256',repeat('8',64)));
    RAISE EXCEPTION 'account mismatch accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%account_mismatch%'THEN RAISE;END IF;END;
  BEGIN
    PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_available||jsonb_build_object('providerEventId','evt_TypeMismatch131','eventType','payment_intent.processing',
      'payloadSha256',repeat('9',64)));
    RAISE EXCEPTION 'event/evidence mismatch accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%evidence_type_mismatch%'THEN RAISE;END IF;END;

  PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(jsonb_build_object(
    'contractVersion','stripe_bank_transfer_webhook.v1','deploymentEnvironment','local','providerEventId','evt_OutOfOrder131',
    'providerAccountId','acct_FundLoopSandbox131','eventType','payment_intent.processing','providerObjectId','pi_FundLoopPayment131',
    'providerPaymentIntentId','pi_FundLoopPayment131','providerCustomerId','cus_FundLoopPayment131','providerCreatedAt','2025-03-20T18:00:00Z',
    'apiVersion','2026-07-29.dahlia','signatureTimestamp',1742493600,'payloadSha256',repeat('a',64),'livemode',false,
    'observationSource','stripe_sdk_v1','evidenceType','processing','currencyCode','USD','grossAmountMinor','128000','feeAmountMinor','0',
    'netAmountMinor','128000','providerBalanceTransactionId',NULL,'balanceSnapshots','[]'::jsonb,'balanceEvidenceHash',repeat('b',64)));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_bank_transfer_evidence WHERE ordering_status='out_of_order')THEN RAISE EXCEPTION 'out-of-order event unclassified';END IF;
  IF(SELECT status FROM public.stripe_bank_transfer_status WHERE intent_id=v_intent_id)<>'available'THEN RAISE EXCEPTION 'late old event regressed state';END IF;

  v_refund:=jsonb_build_object(
    'contractVersion','stripe_bank_transfer_webhook.v1','deploymentEnvironment','local','providerEventId','evt_Refund131',
    'providerAccountId','acct_FundLoopSandbox131','eventType','charge.refunded','providerObjectId','ch_Refund131',
    'providerPaymentIntentId','pi_FundLoopPayment131','providerCustomerId','cus_FundLoopPayment131','providerCreatedAt','2025-03-22T12:00:00Z',
    'apiVersion','2026-07-29.dahlia','signatureTimestamp',1742644800,'payloadSha256',repeat('c',64),'livemode',false,
    'observationSource','stripe_sdk_v1','evidenceType','refunded','currencyCode','USD','grossAmountMinor','128000','feeAmountMinor','0',
    'netAmountMinor','128000','providerBalanceTransactionId','txn_Refund131','balanceSnapshots','[]'::jsonb,'balanceEvidenceHash',repeat('d',64));
  PERFORM * FROM public.ingest_stripe_bank_transfer_webhook(v_refund);
  IF NOT EXISTS(SELECT 1 FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_ledger)
    OR(SELECT status FROM public.stripe_bank_transfer_status WHERE intent_id=v_intent_id)<>'refunded'
    OR(SELECT available_for_shadow_close FROM public.stripe_bank_transfer_status WHERE intent_id=v_intent_id)
    THEN RAISE EXCEPTION 'refund did not reverse availability';END IF;
  IF(SELECT status_id FROM public.payments WHERE id=v_payment_id)IS DISTINCT FROM v_payment_status THEN RAISE EXCEPTION 'legacy payment mutated';END IF;
  IF NOT(SELECT sweep_evidence_pending FROM public.stripe_bank_transfer_status WHERE intent_id=v_intent_id)THEN RAISE EXCEPTION 'missing sweep gate not visible';END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.record_stripe_bank_transfer_intent('{}');RAISE EXCEPTION 'authenticated intent RPC accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM * FROM public.stripe_bank_transfer_status;RAISE EXCEPTION 'authenticated status view accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$ DECLARE table_name text;BEGIN
  FOREACH table_name IN ARRAY ARRAY['stripe_bank_transfer_intents','stripe_webhook_events','stripe_bank_transfer_evidence','stripe_balance_snapshots','stripe_clearing_sweep_evidence'] LOOP
    BEGIN EXECUTE format('INSERT INTO public.%I DEFAULT VALUES',table_name);RAISE EXCEPTION 'service insert accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN EXECUTE format('UPDATE public.%I SET production_enabled=false WHERE false',table_name);RAISE EXCEPTION 'service update accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN EXECUTE format('DELETE FROM public.%I WHERE false',table_name);RAISE EXCEPTION 'service delete accepted for %',table_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  END LOOP;
END $$;
RESET ROLE;

DO $$ BEGIN
  BEGIN UPDATE public.stripe_webhook_events SET event_type='changed' WHERE provider_event_id='evt_Available131';RAISE EXCEPTION 'owner webhook mutation accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE'%append_only%'THEN RAISE;END IF;END;
END $$;

ROLLBACK;
