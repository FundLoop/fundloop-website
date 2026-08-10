BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE v_user uuid;v_operator uuid;v_cycle bigint;v_project bigint;v_run bigint;v_result bigint;v_credit bigint;v_obligation bigint;
  v_asset bigint;v_custody bigint;v_fx bigint;v_route bigint;v_request jsonb;v_request_id uuid;v_intent bigint;v_prepared jsonb;v_command bigint;
  v_cad_asset bigint;v_cad_custody bigint;v_cad_fx bigint;v_cad_route bigint;
  v_failed boolean;v_event jsonb;v_paid_event jsonb;v_failed_command bigint;v_ledger bigint;v_index integer;
BEGIN
  SELECT user_id INTO v_user FROM public.users WHERE email='maya@fundloop.example.com';
  SELECT user_id INTO v_operator FROM public.users WHERE user_id<>v_user ORDER BY created_at,user_id LIMIT 1;
  SELECT id INTO v_project FROM public.projects ORDER BY id LIMIT 1;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status) VALUES('2026-08',2026,8,'2026-08-01','2026-08-31','open') ON CONFLICT(cycle_key) DO UPDATE SET status='open' RETURNING id INTO v_cycle;
  SELECT id INTO v_asset FROM public.financial_assets WHERE asset_key='stripe_sandbox_usd';
  SELECT id INTO v_custody FROM public.financial_custody_accounts WHERE asset_id=v_asset AND provider_key='stripe_sandbox' ORDER BY id LIMIT 1;
  INSERT INTO public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id,version,method,rate_usd_per_unit,status,stablecoin_peg_status,preanalysis,reviewed_by_user_id,posted_at,evidence_hash,deployment_environment)
  VALUES(v_cycle,v_asset,141,'manual_after_exhaustion',1,'posted','within_band','{"issue":141}',v_operator,'2026-08-10T12:00:00Z',repeat('a',64),'local') RETURNING id INTO v_fx;
  PERFORM public.sync_stripe_connect_account(v_user,jsonb_build_object('contractVersion','stripe_connect_account_sync.v1','deploymentEnvironment','local',
    'providerAccountId','acct_fundloop141','countryCode','CA','defaultCurrency','USD','detailsSubmitted',true,'payoutsEnabled',true,
    'externalAccountEnabled',true,'externalAccountLast4','6789','currentlyDueCount',0,'eventuallyDueCount',1,'disabledReason','',
    'providerUpdatedAt','2026-08-10T12:00:00Z','evidenceHash',repeat('b',64)));
  SELECT payout_route_id INTO v_route FROM public.stripe_connect_accounts WHERE user_id=v_user;
  IF v_route IS NULL OR (SELECT destination->>'last4' FROM public.user_payout_routes WHERE id=v_route)<>'6789'
    OR (SELECT destination ? 'routing_number' FROM public.user_payout_routes WHERE id=v_route) THEN RAISE EXCEPTION 'redacted ready route was not created'; END IF;

  INSERT INTO public.zkas_runs(month,status,usd_pool,monthly_cycle_id,created_by_user_id) VALUES('2026-08','draft',40,v_cycle,v_operator) RETURNING id INTO v_run;
  FOR v_index IN 1..2 LOOP
    INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,output_row_hash,monthly_cycle_id)
    VALUES(v_run,'stripe-connect-user-'||v_index,true,10,20,md5(v_index::text)||md5((v_index+500)::text),v_cycle) RETURNING id INTO v_result;
    INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,usd_equivalent_amount,idempotency_key,credited_by_user_id)
    VALUES(v_cycle,v_run,v_result,v_user,20,'stripe-connect-credit-'||v_index,v_operator) RETURNING id INTO v_credit;
    INSERT INTO public.user_withdrawal_obligations(source_bookkeeping_credit_id,monthly_cycle_id,user_id,total_minor,state,available_at,evidence_hash)
    VALUES(v_credit,v_cycle,v_user,2000,'available','2026-08-10T12:00:00Z'::timestamptz+make_interval(secs=>v_index),repeat(v_index::text,64)) RETURNING id INTO v_obligation;
    INSERT INTO public.payout_inventory_lots(obligation_id,legacy_inventory_key,project_id,user_id,monthly_cycle_id,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,
      canonical_minor_total,native_atomic_total,deterministic_sequence,evidence_hash)
    VALUES(v_obligation,'stripe-connect:inventory:'||v_index,v_project,v_user,v_cycle,'stripe_bank_transfer',v_asset,v_custody,v_fx,2000,2000,v_index,repeat((v_index+2)::text,64));
  END LOOP;

  v_failed:=false;BEGIN PERFORM public.prepare_stripe_connect_payout(v_operator,1,'production');EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%stripe_connect_runtime_disabled%';END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production payout prepare was accepted';END IF;

  v_request:=public.create_user_withdrawal_request_v3(v_user,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',250,'idempotencyKey','stripe-connect-paid-1'));
  v_request_id:=(v_request->>'requestId')::uuid;SELECT id INTO v_intent FROM public.payout_intents WHERE withdrawal_request_id=v_request_id;
  v_prepared:=public.prepare_stripe_connect_payout(v_operator,v_intent,'local');v_command:=(v_prepared->>'commandId')::bigint;
  IF v_prepared->>'netMinor'<>'975' OR v_prepared->>'canonicalNetMinor'<>'975' OR v_prepared->>'feeMinor'<>'25' THEN RAISE EXCEPTION 'user fee snapshot changed at provider boundary';END IF;
  PERFORM public.record_stripe_connect_payout_submission(v_command,'tr_paid1','po_paid1','req_paid1');

  v_event:=jsonb_build_object('contractVersion','stripe_connect_webhook.v1','deploymentEnvironment','local','providerEventId','evt_transit1',
    'providerAccountId','acct_fundloop141','eventType','payout.updated','providerObjectId','po_paid1','providerCreatedAt','2026-08-10T14:00:00Z',
    'signatureTimestamp',extract(epoch FROM '2026-08-10T14:00:00Z'::timestamptz)::bigint,'payloadSha256',repeat('c',64),'livemode',false,'observationSource','stripe_sdk_v1',
    'providerStatus','in_transit','amountMinor','975','currencyCode','USD','destinationLast4','6789','failureCode','','arrivalAt','2026-08-12T00:00:00Z');
  PERFORM public.ingest_stripe_connect_webhook(v_event);
  PERFORM public.ingest_stripe_connect_webhook(v_event);
  v_failed:=false;BEGIN PERFORM public.ingest_stripe_connect_webhook(v_event||jsonb_build_object('amountMinor','976'));EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%stripe_connect_webhook_dedupe_conflict%';END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed duplicate webhook was accepted';END IF;
  PERFORM public.ingest_stripe_connect_webhook(v_event||jsonb_build_object('providerEventId','evt_pendingold1','providerCreatedAt','2026-08-10T13:00:00Z','providerStatus','pending','payloadSha256',repeat('d',64)));
  IF (SELECT status FROM public.stripe_connect_payout_commands WHERE id=v_command)<>'in_transit'
    OR (SELECT ordering_status FROM public.stripe_connect_webhook_events WHERE provider_event_id='evt_pendingold1')<>'out_of_order' THEN RAISE EXCEPTION 'out-of-order webhook regressed payout';END IF;

  v_paid_event:=v_event||jsonb_build_object('providerEventId','evt_paid1','eventType','payout.paid','providerCreatedAt','2026-08-10T15:00:00Z','providerStatus','paid','payloadSha256',repeat('e',64));
  PERFORM public.ingest_stripe_connect_webhook(v_paid_event);
  SELECT ledger_transaction_id INTO v_ledger FROM public.stripe_connect_payout_commands WHERE id=v_command;
  IF v_ledger IS NULL OR (SELECT status FROM public.payout_intents WHERE id=v_intent)<>'paid' OR (SELECT status FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'paid'
    OR (SELECT status FROM public.payout_execution_attempts WHERE id=(v_prepared->>'attemptId')::bigint)<>'reconciled'
    OR (SELECT sum(functional_usd_amount) FILTER(WHERE side='debit') FROM public.ledger_postings WHERE transaction_id=v_ledger)<>9.75
    OR (SELECT sum(functional_usd_amount) FILTER(WHERE side='credit') FROM public.ledger_postings WHERE transaction_id=v_ledger)<>9.75
  THEN RAISE EXCEPTION 'provider paid state was not atomically journal reconciled';END IF;

  -- CAD preserves canonical USD value separately from provider-native minor units.
  SELECT id INTO v_cad_asset FROM public.financial_assets WHERE asset_key='stripe_connect_sandbox_cad';
  SELECT id INTO v_cad_custody FROM public.financial_custody_accounts WHERE asset_id=v_cad_asset AND provider_key='stripe_sandbox';
  INSERT INTO public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id,version,method,rate_usd_per_unit,status,stablecoin_peg_status,preanalysis,reviewed_by_user_id,posted_at,evidence_hash,deployment_environment)
  VALUES(v_cycle,v_cad_asset,141,'manual_after_exhaustion',0.75,'posted','outside_band','{"issue":141,"currency":"CAD"}',v_operator,'2026-08-10T12:00:00Z',repeat('9',64),'local') RETURNING id INTO v_cad_fx;
  PERFORM public.sync_stripe_connect_account(v_operator,jsonb_build_object('contractVersion','stripe_connect_account_sync.v1','deploymentEnvironment','local',
    'providerAccountId','acct_fundloopcad141','countryCode','CA','defaultCurrency','CAD','detailsSubmitted',true,'payoutsEnabled',true,
    'externalAccountEnabled',true,'externalAccountLast4','1414','currentlyDueCount',0,'eventuallyDueCount',0,'disabledReason','',
    'providerUpdatedAt','2026-08-10T12:00:00Z','evidenceHash',repeat('8',64)));
  SELECT payout_route_id INTO v_cad_route FROM public.stripe_connect_accounts WHERE user_id=v_operator;
  INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,output_row_hash,monthly_cycle_id)
    VALUES(v_run,'stripe-connect-cad-user',true,10,20,repeat('7',64),v_cycle) RETURNING id INTO v_result;
  INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,usd_equivalent_amount,idempotency_key,credited_by_user_id)
    VALUES(v_cycle,v_run,v_result,v_operator,20,'stripe-connect-cad-credit',v_operator) RETURNING id INTO v_credit;
  INSERT INTO public.user_withdrawal_obligations(source_bookkeeping_credit_id,monthly_cycle_id,user_id,total_minor,state,available_at,evidence_hash)
    VALUES(v_credit,v_cycle,v_operator,2000,'available','2026-08-10T12:00:03Z',repeat('6',64)) RETURNING id INTO v_obligation;
  INSERT INTO public.payout_inventory_lots(obligation_id,legacy_inventory_key,project_id,user_id,monthly_cycle_id,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,
    canonical_minor_total,native_atomic_total,deterministic_sequence,evidence_hash)
    VALUES(v_obligation,'stripe-connect:cad:inventory',v_project,v_operator,v_cycle,'stripe_bank_transfer',v_cad_asset,v_cad_custody,v_cad_fx,2000,2667,1,repeat('5',64));
  v_request:=public.create_user_withdrawal_request_v3(v_operator,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_cad_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_connect_sandbox_cad','userFeeBps',0,'idempotencyKey','stripe-connect-cad-1'));
  v_request_id:=(v_request->>'requestId')::uuid;SELECT id INTO v_intent FROM public.payout_intents WHERE withdrawal_request_id=v_request_id;
  v_prepared:=public.prepare_stripe_connect_payout(v_user,v_intent,'local');v_command:=(v_prepared->>'commandId')::bigint;
  IF v_prepared->>'currencyCode'<>'cad' OR v_prepared->>'canonicalNetMinor'<>'1000' OR v_prepared->>'netMinor'<>'1334'
    OR (SELECT currency_code FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'CAD' THEN RAISE EXCEPTION 'CAD provider-native amount was not derived at locked FX';END IF;
  PERFORM public.record_stripe_connect_payout_submission(v_command,'tr_cad1','po_cad1','req_cad1');
  PERFORM public.ingest_stripe_connect_webhook(v_event||jsonb_build_object('providerEventId','evt_cadpaid1','providerAccountId','acct_fundloopcad141',
    'eventType','payout.paid','providerObjectId','po_cad1','providerCreatedAt','2026-08-10T15:30:00Z','providerStatus','paid','amountMinor','1334','currencyCode','CAD',
    'destinationLast4','1414','payloadSha256',repeat('4',64)));
  SELECT ledger_transaction_id INTO v_ledger FROM public.stripe_connect_payout_commands WHERE id=v_command;
  IF v_ledger IS NULL OR (SELECT sum(functional_usd_amount) FILTER(WHERE side='debit') FROM public.ledger_postings WHERE transaction_id=v_ledger)<>10
    OR (SELECT sum(native_atomic_amount) FILTER(WHERE side='debit') FROM public.ledger_postings WHERE transaction_id=v_ledger)<>1334
  THEN RAISE EXCEPTION 'CAD paid event did not reconcile native and functional amounts';END IF;

  v_request:=public.create_user_withdrawal_request_v3(v_user,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-connect-failed-1'));
  v_request_id:=(v_request->>'requestId')::uuid;SELECT id INTO v_intent FROM public.payout_intents WHERE withdrawal_request_id=v_request_id;
  v_prepared:=public.prepare_stripe_connect_payout(v_operator,v_intent,'local');v_failed_command:=(v_prepared->>'commandId')::bigint;
  PERFORM public.record_stripe_connect_payout_submission(v_failed_command,'tr_failed1','po_failed1','req_failed1');
  PERFORM public.ingest_stripe_connect_webhook(v_event||jsonb_build_object('providerEventId','evt_failed1','eventType','payout.failed','providerObjectId','po_failed1',
    'providerCreatedAt','2026-08-10T16:00:00Z','providerStatus','failed','amountMinor','1000','failureCode','account_closed','payloadSha256',repeat('f',64)));
  IF (SELECT status FROM public.stripe_connect_payout_commands WHERE id=v_failed_command)<>'needs_remediation'
    OR (SELECT status FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'held' OR (SELECT ledger_transaction_id FROM public.stripe_connect_payout_commands WHERE id=v_failed_command) IS NOT NULL
  THEN RAISE EXCEPTION 'failed payout was falsely reconciled or not held';END IF;
  v_prepared:=public.prepare_stripe_connect_payout(v_operator,v_intent,'local');
  IF v_prepared->>'existingTransferId'<>'tr_failed1' OR (SELECT count(DISTINCT provider_transfer_id) FROM public.stripe_connect_payout_commands WHERE payout_intent_id=v_intent)<>1
  THEN RAISE EXCEPTION 'remediation would double-transfer connected account funds';END IF;

  PERFORM public.ingest_stripe_connect_webhook(jsonb_build_object('contractVersion','stripe_connect_webhook.v1','deploymentEnvironment','local','providerEventId','evt_account1',
    'providerAccountId','acct_fundloop141','eventType','account.updated','providerObjectId','acct_fundloop141','providerCreatedAt','2026-08-10T17:00:00Z',
    'signatureTimestamp',extract(epoch FROM '2026-08-10T17:00:00Z'::timestamptz)::bigint,'payloadSha256',repeat('1',64),'livemode',false,'observationSource','stripe_sdk_v1',
    'onboardingStatus','requirements_due','detailsSubmitted',true,'payoutsEnabled',false,'externalAccountEnabled',false,'externalAccountLast4','6789',
    'currentlyDueCount',1,'eventuallyDueCount',1,'disabledReason','requirements.past_due'));
  IF (SELECT onboarding_status FROM public.stripe_connect_accounts WHERE user_id=v_user)<>'requirements_due' OR (SELECT status FROM public.user_payout_routes WHERE id=v_route)<>'disabled'
  THEN RAISE EXCEPTION 'account requirement change did not disable payout route';END IF;

  v_failed:=false;BEGIN EXECUTE 'SET LOCAL ROLE authenticated';PERFORM public.prepare_stripe_connect_payout(v_operator,v_intent,'local');EXCEPTION WHEN insufficient_privilege THEN v_failed:=true;END;RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated caller executed Stripe payout RPC';END IF;
  v_failed:=false;BEGIN EXECUTE 'SET LOCAL ROLE service_role';INSERT INTO public.stripe_connect_payout_observations(webhook_event_id,stripe_connect_payout_command_id,provider_status,amount_minor,currency_code,evidence_hash)
    VALUES(999,v_command,'paid',975,'USD',repeat('a',64));EXCEPTION WHEN insufficient_privilege THEN v_failed:=true;END;RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role bypassed typed Stripe command';END IF;
END $$;
ROLLBACK;
