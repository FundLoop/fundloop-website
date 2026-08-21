BEGIN;
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_actor uuid:='290eb647-f25f-43f3-bf6b-1e2b2cf25e69';
  v_payment bigint;v_terminal_payment bigint;v_command uuid;v_terminal uuid;v_evidence bigint;
  v_ledger bigint;v_reversal bigint;v_residual bigint;v_second_residual bigint;v_package bigint;v_cycle bigint;v_dataset bigint;v_source_row bigint;v_fx_observation bigint;v_prep_count integer;
  v_quote public.project_payment_funding_quotes%ROWTYPE;v_provider public.stripe_pay_by_bank_evidence%ROWTYPE;
  v_provider_event public.stripe_webhook_events%ROWTYPE;v_source public.epoch_project_package_funding_sources%ROWTYPE;
  v_lot public.epoch_valuation_source_lots%ROWTYPE;v_fx public.epoch_fx_snapshots%ROWTYPE;
  v_preview jsonb;v_manifest jsonb;v_manifest_id bigint;v_manifest_hash text;v_source_lot_id bigint;v_source_lot_key text;
  v_artifact jsonb;v_run bigint;v_close jsonb;v_close_replay jsonb;v_root_hash text;v_reports jsonb;v_publish jsonb;
  v_exact numeric(38,18);v_funded_minor numeric(78,0);v_initial_minor numeric(78,0);v_score_minor numeric(78,0);v_topup_minor numeric(78,0);v_residue_minor numeric(78,0);
  v_denied boolean:=false;v_direct_denied boolean:=false;v_base jsonb;
BEGIN
  INSERT INTO public.accounting_periods(period_key,starts_at,ends_at,timezone_name)
  VALUES('local_review_2026_07','2026-07-01T07:00:00Z','2026-08-01T07:00:00Z','America/Los_Angeles');
  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-07-01','2026-07-31',1000,110,11,v_actor) RETURNING id INTO v_payment;

  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','production',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','EUR','expectedAmountMinor','10000',
      'customerCountry','DE','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank','privatePreviewEnabled',false));
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
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','EUR','expectedAmountMinor','10000',
      'customerCountry','FI','merchantCountry','CA','chargeTopology','destination','providerAccountId','acct_testbank','platformAccountId','acct_testbank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_eligibility_mismatch%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'unimplemented_topology_should_fail';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.prepare_stripe_pay_by_bank_command(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local',
      'actorUserId',v_actor,'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','EUR','expectedAmountMinor','10000',
      'customerCountry','FI','merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_connected','platformAccountId','acct_testbank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_topology_account_mismatch%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'topology_account_mismatch_should_fail';END IF;

  PERFORM public.post_project_payment_funding_quote(jsonb_build_object('contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'paymentId',v_payment,'railKey','stripe_pay_by_bank','currencyCode','EUR','rateUsdPerUnit','1.10',
    'sourceKey','local_review_fx','observedAt',clock_timestamp()-interval '1 minute','freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('c',64)));

  v_base:=jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment','local','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','paymentId',v_payment,'currencyCode','EUR','expectedAmountMinor','10000','customerCountry','FI',
    'merchantCountry','CA','chargeTopology','platform','providerAccountId','acct_testbank','platformAccountId','acct_testbank','privatePreviewEnabled',false);
  v_command:=public.prepare_stripe_pay_by_bank_command(v_base);
  IF v_command<>public.prepare_stripe_pay_by_bank_command(v_base) THEN RAISE EXCEPTION 'prepare_not_idempotent';END IF;
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object('commandId',v_command,'providerAccountId','acct_testbank',
    'providerCheckoutSessionId','cs_test_bankfixture','capabilityEvidenceHash',repeat('d',64)));

  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.stripe_pay_by_bank_evidence(webhook_event_id,command_id,evidence_type,currency_code,gross_amount_minor,ordering_status,evidence_hash)
    VALUES(1,v_command,'processing','EUR',10000,'in_order',repeat('e',64));
  EXCEPTION WHEN insufficient_privilege THEN v_direct_denied:=true;END;
  RESET ROLE;
  IF NOT v_direct_denied THEN RAISE EXCEPTION 'authenticated_direct_write_should_fail';END IF;

  v_evidence:=public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_banksettled','providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_bankfixture',
    'providerCreatedAt','2026-07-10T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786352800,'payloadSha256',repeat('2',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId',NULL,
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor',NULL,
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT ledger_transaction_id INTO v_ledger FROM public.stripe_pay_by_bank_evidence WHERE id=v_evidence;
  IF v_ledger IS NULL OR NOT (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'settled_should_fund';END IF;
  IF (SELECT sum(CASE side WHEN'debit'THEN native_atomic_amount ELSE-native_atomic_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0
    OR (SELECT sum(CASE side WHEN'debit'THEN functional_usd_amount ELSE-functional_usd_amount END) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>0 THEN
    RAISE EXCEPTION 'pay_by_bank_ledger_not_conserved';END IF;
  SELECT * INTO STRICT v_quote FROM public.project_payment_funding_quotes WHERE id=(SELECT funding_quote_id FROM public.stripe_pay_by_bank_commands WHERE id=v_command);
  SELECT * INTO STRICT v_provider FROM public.stripe_pay_by_bank_evidence WHERE id=v_evidence;
  SELECT event.* INTO STRICT v_provider_event FROM public.stripe_webhook_events event WHERE event.id=v_provider.webhook_event_id;
  IF v_quote.payment_id<>v_payment OR v_quote.project_id<>3 OR v_quote.rail_key<>'stripe_pay_by_bank'
    OR v_quote.currency_code<>'EUR' OR v_quote.obligation_usd_minor<>11000 OR v_quote.source_amount_minor<>10000
    OR v_quote.rate_usd_per_unit<>1.10 OR v_quote.source_key<>'local_review_fx' OR v_quote.evidence_hash<>repeat('c',64)
    OR v_quote.observed_at>=v_quote.freshness_expires_at
    OR v_provider.command_id<>v_command OR v_provider.evidence_type<>'settled_available' OR v_provider.currency_code<>'EUR'
    OR v_provider.gross_amount_minor<>10000 OR v_provider.fee_amount_minor<>30 OR v_provider.net_amount_minor<>9970
    OR v_provider.gross_amount_minor<>v_provider.fee_amount_minor+v_provider.net_amount_minor OR v_provider.balance_status<>'available'
    OR v_provider.provider_checkout_session_id<>'cs_test_bankfixture' OR v_provider.provider_payment_intent_id<>'pi_bankfixture'
    OR v_provider.provider_charge_id<>'ch_bankfixture' OR v_provider.provider_balance_transaction_id<>'txn_bankfixture'
    OR v_provider.evidence_hash<>repeat('2',64) OR v_provider_event.provider_event_id<>'evt_banksettled'
    OR v_provider_event.provider_created_at<>'2026-07-10T12:00:00Z'::timestamptz OR v_provider_event.payload_sha256<>repeat('2',64)
    OR (SELECT count(*) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>2
    OR EXISTS(SELECT 1 FROM public.ledger_postings posting
      JOIN public.stripe_pay_by_bank_custody_routes route ON route.currency_code='EUR'
      WHERE posting.transaction_id=v_ledger AND (posting.native_atomic_amount<>v_quote.source_amount_minor
        OR posting.functional_usd_amount<>v_quote.obligation_usd_minor/100
        OR posting.fx_usd_per_unit<>v_quote.rate_usd_per_unit OR posting.asset_id<>route.asset_id
        OR posting.custody_account_id<>route.custody_account_id OR posting.project_id<>3))
    OR (SELECT count(DISTINCT side) FROM public.ledger_postings WHERE transaction_id=v_ledger)<>2
    OR NOT EXISTS(SELECT 1 FROM public.ledger_transactions transaction WHERE transaction.id=v_ledger
      AND transaction.transaction_type='stripe_pay_by_bank_receipt' AND transaction.effective_at=v_provider_event.provider_created_at
      AND transaction.evidence_hash=v_provider.evidence_hash)
  THEN RAISE EXCEPTION 'eur_provider_quote_ledger_provenance_failed';END IF;

  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-04',2026,4,'2026-04-01','2026-04-30',v_actor,v_actor);
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-07',2026,7,'2026-07-01','2026-07-31',v_actor,v_actor) RETURNING id INTO v_cycle;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,created_by_user_id,updated_by_user_id)
  VALUES('2026-08',2026,8,'2026-08-01','2026-08-31',v_actor,v_actor) ON CONFLICT(cycle_key) DO NOTHING;
  INSERT INTO public.epoch_shadow_states(accounting_period_id,monthly_cycle_id,current_stage,state_version)
  VALUES((SELECT id FROM public.accounting_periods WHERE period_key='local_review_2026_07'),v_cycle,'reviewing',100);
  UPDATE public.payments SET monthly_cycle_id=v_cycle WHERE id=v_payment;
  v_package:=public.validate_epoch_project_package(jsonb_build_object('deploymentEnvironment','local','actorRole','internal_admin','actorUserId',v_actor,
    'projectSlug','nomad-workspaces','cycleKey','2026-07','complianceEvidenceHash',repeat('4',64),'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed'));
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_funding_sources WHERE package_id=v_package AND source_kind='stripe_pay_by_bank'
      AND stripe_pay_by_bank_command_id=v_command AND asset_code='EUR' AND native_atomic_amount=10000) THEN
    RAISE EXCEPTION 'settled_source_not_bound_to_package';END IF;
  SELECT * INTO STRICT v_source FROM public.epoch_project_package_funding_sources
  WHERE package_id=v_package AND stripe_pay_by_bank_command_id=v_command;
  IF v_source.asset_code<>v_quote.currency_code OR v_source.native_atomic_amount<>v_quote.source_amount_minor
    OR v_source.preliminary_usd<>v_quote.obligation_usd_minor/100 OR v_source.source_evidence_hash<>v_provider.evidence_hash
  THEN RAISE EXCEPTION 'eur_package_source_persisted_provenance_failed';END IF;
  INSERT INTO public.project_attribution_datasets(project_id,monthly_cycle_id,status,row_count,total_attribution_points,submitted_by_user_id)
  VALUES(3,v_cycle,'approved',1,1,v_actor) RETURNING id INTO v_dataset;
  INSERT INTO public.project_attribution_rows(dataset_id,project_id,monthly_cycle_id,row_index,scoped_cubid_id,user_id,attribution_points)
  VALUES(v_dataset,3,v_cycle,1,'pay-by-bank-prep-fixture',v_actor,1) RETURNING id INTO v_source_row;
  INSERT INTO public.epoch_project_package_cohort(package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,
    locked_cubid_score,locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash)
  VALUES(v_package,v_source_row,v_actor,repeat('d',64),'valid','eligible',10,20,clock_timestamp(),clock_timestamp()+interval '1 day',repeat('e',64));
  UPDATE public.epoch_project_packages SET status='approved',list_status='valid',funding_status='settled',compliance_status='passed',cubid_status='eligible',
    cohort_count=1,eligible_user_count=1,approved_at=clock_timestamp(),approved_by_user_id=v_actor WHERE id=v_package;
  v_fx_observation:=public.record_epoch_fx_observation(jsonb_build_object('contractVersion','epoch_fx_observation.v1','deploymentEnvironment','local',
    'cycleKey','2026-07','assetKey','stripe_pay_by_bank_eur','sourceKey','pay_by_bank_primary_fixture','sourceRank',1,'rateUsdPerUnit','1.10',
    'observedAt',clock_timestamp(),'freshnessExpiresAt',clock_timestamp()+interval '1 hour','reasonabilityStatus','eligible',
    'evidenceHash',repeat('b',64),'actorUserId',v_actor));
  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object('contractVersion','epoch_fx_snapshot.v1','deploymentEnvironment','local',
    'cycleKey','2026-07','assetKey','stripe_pay_by_bank_eur','method','primary','observationId',v_fx_observation,'preanalysis',jsonb_build_object('fresh',true),
    'evidenceHash',repeat('c',64),'actorUserId',v_actor));
  v_prep_count:=public.prepare_epoch_financial_sources(jsonb_build_object('contractVersion','epoch_financial_prep.v1','deploymentEnvironment','local',
      'packageId',v_package,'actorUserId',v_actor));
  IF v_prep_count<>1
    OR NOT EXISTS(SELECT 1 FROM public.epoch_valuation_source_lots lot JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
      JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id
      WHERE lot.package_id=v_package AND lot.source_kind='stripe_pay_by_bank' AND asset.asset_key='stripe_pay_by_bank_eur'
        AND custody.custody_key='stripe_pay_by_bank_eur_clearing' AND lot.native_atomic_amount=10000 AND lot.gross_exact_usd=110)
    OR NOT EXISTS(SELECT 1 FROM public.epoch_funded_allocation_lock_candidates WHERE package_id=v_package AND source_kind='stripe_pay_by_bank') THEN
    RAISE EXCEPTION 'settled_pay_by_bank_did_not_reach_financial_prep count %, lot %',v_prep_count,
      (SELECT row_to_json(x) FROM(SELECT lot.source_kind,asset.asset_key,custody.custody_key,lot.native_atomic_amount,lot.gross_exact_usd
        FROM public.epoch_valuation_source_lots lot JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
        JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id WHERE lot.package_id=v_package LIMIT 1)x);END IF;
  SELECT * INTO STRICT v_lot FROM public.epoch_valuation_source_lots WHERE package_source_id=v_source.id;
  SELECT * INTO STRICT v_fx FROM public.epoch_fx_snapshots WHERE id=v_lot.fx_snapshot_id;
  IF v_lot.project_id<>3 OR v_lot.monthly_cycle_id<>v_cycle OR v_lot.source_kind<>'stripe_pay_by_bank'
    OR v_lot.rail_key<>'stripe_pay_by_bank' OR v_lot.native_atomic_amount<>v_source.native_atomic_amount
    OR v_lot.source_preliminary_exact_usd<>v_source.preliminary_usd OR v_lot.gross_exact_usd<>110
    OR v_lot.fx_difference_exact_usd<>0 OR v_lot.gross_exact_usd<>v_lot.project_fee_exact_usd+v_lot.base_fee_exact_usd+v_lot.distributable_exact_usd
    OR v_lot.evidence_hash<>encode(extensions.digest(convert_to(v_lot.source_lot_key||':'||v_source.source_evidence_hash||':'||v_fx.evidence_hash,'UTF8'),'sha256'),'hex')
    OR NOT EXISTS(SELECT 1 FROM public.epoch_fx_observations observation WHERE observation.id=v_fx.selected_observation_id
      AND observation.rate_usd_per_unit=v_quote.rate_usd_per_unit AND observation.financial_asset_id=v_lot.financial_asset_id
      AND observation.source_key='pay_by_bank_primary_fixture' AND observation.evidence_hash=repeat('b',64)
      AND observation.observed_at<observation.freshness_expires_at AND v_fx.posted_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.ledger_transactions transaction WHERE transaction.id=v_lot.fee_ledger_transaction_id
      AND transaction.transaction_type='epoch_review_fee_processing' AND transaction.evidence_hash=v_source.source_evidence_hash
      AND transaction.effective_at=(SELECT period.starts_at FROM public.accounting_periods period WHERE period.id=transaction.accounting_period_id))
    OR (SELECT sum(CASE posting.side WHEN 'debit' THEN posting.functional_usd_amount ELSE -posting.functional_usd_amount END)
      FROM public.ledger_postings posting WHERE posting.transaction_id=v_lot.fee_ledger_transaction_id)<>0
    OR NOT EXISTS(SELECT 1 FROM public.ledger_postings posting JOIN public.ledger_accounts account ON account.id=posting.account_id
      WHERE posting.transaction_id=v_lot.fee_ledger_transaction_id
      GROUP BY posting.transaction_id HAVING
        sum(posting.functional_usd_amount) FILTER(WHERE account.account_key='epoch_review_gross_control' AND posting.side='debit')=v_lot.gross_exact_usd
        AND coalesce(sum(posting.functional_usd_amount) FILTER(WHERE account.account_key='epoch_review_project_fee_control' AND posting.side='credit'),0)=v_lot.project_fee_exact_usd
        AND sum(posting.functional_usd_amount) FILTER(WHERE account.account_key='epoch_review_base_fee_control' AND posting.side='credit')=v_lot.base_fee_exact_usd
        AND sum(posting.functional_usd_amount) FILTER(WHERE account.account_key='epoch_review_distributable_control' AND posting.side='credit')=v_lot.distributable_exact_usd)
  THEN RAISE EXCEPTION 'eur_financial_prep_persisted_provenance_or_conservation_failed';END IF;

  v_preview:=public.epoch_allocation_v2_preview_input('2026-07',1.50,'local');
  v_manifest:=public.lock_funded_epoch_allocation_v2(jsonb_build_object(
    'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local','actorUserId',v_actor,
    'cycleKey','2026-07','capMultiple','1.50','selectedPreviewHash',v_preview->>'inputHash'));
  v_manifest_id:=(v_manifest->>'manifestId')::bigint;v_manifest_hash:=v_manifest->>'manifestHash';
  SELECT source_lot_id,source_lot_key,exact_usd,canonical_minor_capacity
  INTO STRICT v_source_lot_id,v_source_lot_key,v_exact,v_funded_minor
  FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id;
  v_initial_minor:=floor(v_funded_minor/2);v_score_minor:=v_funded_minor-v_initial_minor;
  v_topup_minor:=least(v_score_minor,floor(v_initial_minor/2));v_residue_minor:=v_score_minor-v_topup_minor;
  v_artifact:=jsonb_build_object(
    'policy','settled_cubid_redistribution_v2','cycleKey','2026-07','manifestHash',v_manifest_hash,
    'selectedPreviewHash',v_preview->>'inputHash','minorUnitScale',2,'capMultiple','1.50',
    'totals',jsonb_build_object('currentFundedExactUsd',v_exact::text,'currentFundedMinor',v_funded_minor::text,
      'harvestedUnclaimedMinor','0','carryInMinor','0','totalInputMinor',v_funded_minor::text,
      'initialClaimMinor',v_initial_minor::text,'scorePoolMinor',v_score_minor::text,'topUpMinor',v_topup_minor::text,
      'carryOutResidueMinor',v_residue_minor::text,'finalAllocationMinor',(v_initial_minor+v_topup_minor)::text,
      'subMinorExactUsd',(v_exact-v_funded_minor/100)::text),
    'users',jsonb_build_array(jsonb_build_object('userId',v_actor::text,'aggregateInitialExactUsd',(v_exact/2)::text,
      'baselineExactUsd',(v_exact/2)::text,'redistributionCeilingExactUsd',(v_exact*.75)::text,
      'redistributionCeilingMinor',(v_initial_minor+v_topup_minor)::text,'initialClaimMinor',v_initial_minor::text,
      'topUpCapacityMinor',v_topup_minor::text,'topUpMinor',v_topup_minor::text,'finalMinor',(v_initial_minor+v_topup_minor)::text,
      'projectClaims',jsonb_build_array(jsonb_build_object('projectId',3,'theoreticalShareExactUsd',v_exact::text,
        'scoreFactor','0.5','initialClaimExactUsd',(v_exact/2)::text,'scorePoolContributionExactUsd',(v_exact/2)::text)))),
    'sourceDispositions',jsonb_build_array(
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',v_source_lot_key,'userId',v_actor::text,'projectId',3,
        'kind','initial_claim','canonicalMinor',v_initial_minor::text,'exactUsd',(v_exact/2)::text),
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',v_source_lot_key,'userId',NULL,'projectId',3,
        'kind','score_pool','canonicalMinor',v_score_minor::text,'exactUsd',(v_exact/2)::text),
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',v_source_lot_key,'userId',v_actor::text,'projectId',3,
        'kind','top_up','canonicalMinor',v_topup_minor::text,'exactUsd',(v_topup_minor/100)::text),
      jsonb_build_object('sourceLotId',v_source_lot_id::text,'sourceLotKey',v_source_lot_key,'userId',NULL,'projectId',3,
        'kind','carryout_residue','canonicalMinor',v_residue_minor::text,'exactUsd',(v_exact/2-v_topup_minor/100)::text)),
    'invariantChecks',jsonb_build_array(jsonb_build_object('code','canonical_minor_conservation','ok',true),
      jsonb_build_object('code','full_initial_claims_preserved','ok',true),jsonb_build_object('code','topups_cap_limited','ok',true),
      jsonb_build_object('code','source_provenance_conserved','ok',true)),'resultHash',repeat('7',64));
  v_run:=public.record_funded_epoch_allocation_v2(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('7',64),'artifact',v_artifact));
  IF v_run<>public.record_funded_epoch_allocation_v2(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('7',64),'artifact',v_artifact))
    OR (SELECT initial_claim_minor FROM public.epoch_allocation_user_awards WHERE run_id=v_run)<>v_initial_minor
    OR (SELECT top_up_minor FROM public.epoch_allocation_user_awards WHERE run_id=v_run)<>v_topup_minor THEN
    RAISE EXCEPTION 'eur_pay_by_bank_v2_calculation_or_replay_failed';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_allocation_runs run WHERE run.id=v_run AND run.manifest_id=v_manifest_id
      AND run.artifact=v_artifact AND run.current_funded_minor=v_funded_minor
      AND run.harvested_unclaimed_minor=0 AND run.carry_in_minor=0 AND run.funded_minor=v_funded_minor
      AND run.retained_initial_minor=v_initial_minor AND run.score_pool_minor=v_score_minor
      AND run.top_up_minor=v_topup_minor AND run.returned_residue_minor=v_residue_minor
      AND run.final_allocation_minor=v_initial_minor+v_topup_minor)
    OR (SELECT coalesce(sum(disposition.canonical_minor),0) FROM public.epoch_allocation_source_dispositions disposition
      WHERE disposition.run_id=v_run AND disposition.manifest_source_id=(SELECT id FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id)
        AND disposition.disposition_kind IN('initial_claim','score_pool'))<>v_funded_minor
    OR (SELECT coalesce(sum(disposition.exact_usd),0) FROM public.epoch_allocation_source_dispositions disposition
      WHERE disposition.run_id=v_run AND disposition.manifest_source_id=(SELECT id FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id)
        AND disposition.disposition_kind IN('initial_claim','score_pool'))<>v_exact
    OR EXISTS(SELECT 1 FROM jsonb_to_recordset(v_artifact->'sourceDispositions') item(
        "sourceLotId" text,"kind" text,"canonicalMinor" text,"exactUsd" text)
      WHERE NOT EXISTS(SELECT 1 FROM public.epoch_allocation_source_dispositions disposition
        JOIN public.epoch_allocation_manifest_sources source ON source.id=disposition.manifest_source_id
        WHERE disposition.run_id=v_run AND source.source_lot_id=item."sourceLotId"::bigint
          AND disposition.disposition_kind=item."kind" AND disposition.canonical_minor=item."canonicalMinor"::numeric
          AND disposition.exact_usd=item."exactUsd"::numeric))
  THEN RAISE EXCEPTION 'eur_calculator_artifact_persisted_result_mismatch';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.record_funded_epoch_allocation_v2(jsonb_build_object('contractVersion','epoch_funded_allocation_result.v2',
      'deploymentEnvironment','local','actorUserId',v_actor,'manifestId',v_manifest_id,'resultHash',repeat('8',64),'artifact',v_artifact));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%epoch_allocation_result_conflict%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'changed_v2_result_replay_should_fail';END IF;
  v_close:=public.approve_epoch_allocation_close_v2(jsonb_build_object('contractVersion','epoch_allocation_close.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
    'resultHash',repeat('7',64),'rerunResultHash',repeat('7',64)));
  v_close_replay:=public.approve_epoch_allocation_close_v2(jsonb_build_object('contractVersion','epoch_allocation_close.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'runId',v_run,'manifestHash',v_manifest_hash,
    'resultHash',repeat('7',64),'rerunResultHash',repeat('7',64)));
  v_root_hash:=v_close->>'rootHash';
  IF v_close_replay->>'closePackageId'<>v_close->>'closePackageId'
    OR NOT EXISTS(SELECT 1 FROM public.epoch_close_packages close_package
      JOIN public.epoch_close_project_summaries summary ON summary.approval_id=close_package.approval_id
      WHERE close_package.id=(v_close->>'closePackageId')::bigint AND close_package.policy_key='settled_cubid_redistribution_v2'
        AND close_package.current_funded_minor=v_funded_minor AND close_package.production_enabled=false
        AND summary.project_id=3 AND summary.source_count=1) THEN
    RAISE EXCEPTION 'eur_pay_by_bank_close_or_replay_failed';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_close_packages close_package
      JOIN public.epoch_allocation_approvals approval ON approval.id=close_package.approval_id
      JOIN public.epoch_allocation_runs run ON run.id=approval.run_id
      WHERE close_package.id=(v_close->>'closePackageId')::bigint AND close_package.manifest_hash=v_manifest_hash
        AND close_package.result_hash=run.result_hash AND close_package.funded_minor=run.funded_minor
        AND close_package.final_allocation_minor=run.final_allocation_minor
        AND close_package.top_up_minor=run.top_up_minor AND close_package.returned_residue_minor=run.returned_residue_minor)
    OR EXISTS(SELECT 1 FROM public.epoch_close_artifacts artifact
      WHERE artifact.close_package_id=(v_close->>'closePackageId')::bigint
        AND artifact.artifact_hash<>encode(extensions.digest(convert_to(artifact.artifact::text,'UTF8'),'sha256'),'hex'))
    OR v_root_hash<>(SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'artifactKey',artifact.artifact_key,'artifactHash',artifact.artifact_hash) ORDER BY artifact.artifact_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
      FROM public.epoch_close_artifacts artifact WHERE artifact.close_package_id=(v_close->>'closePackageId')::bigint)
  THEN RAISE EXCEPTION 'eur_close_persisted_hash_or_amount_conservation_failed';END IF;

  v_reports:=public.generate_monthly_cycle_reports(jsonb_build_object('contractVersion','monthly_cycle_reports_generate.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId'));
  IF (v_reports->>'artifactCount')::integer<>5 OR (public.generate_monthly_cycle_reports(jsonb_build_object(
    'contractVersion','monthly_cycle_reports_generate.v2','deploymentEnvironment','local','actorUserId',v_actor,
    'closePackageId',v_close->>'closePackageId'))->>'replayed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'monthly_report_generation_or_replay_failed';END IF;
  IF EXISTS(SELECT 1 FROM public.monthly_cycle_report_artifacts report
    WHERE report.close_package_id=(v_close->>'closePackageId')::bigint
      AND (report.artifact->>'rootHash'<>v_root_hash OR report.artifact_hash<>encode(extensions.digest(convert_to(report.artifact_bytes,'UTF8'),'sha256'),'hex')))
  THEN RAISE EXCEPTION 'eur_report_persisted_root_or_bytes_hash_failed';END IF;
  v_publish:=public.prepare_monthly_cycle_report_publication(jsonb_build_object('contractVersion','monthly_cycle_reports_publish.v2',
    'deploymentEnvironment','local','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId','rootHash',v_root_hash));
  IF jsonb_array_length(v_publish->'artifacts')<>5 OR EXISTS(SELECT 1 FROM public.monthly_cycle_report_artifacts
    WHERE close_package_id=(v_close->>'closePackageId')::bigint AND (state<>'generated' OR storage_verified_at IS NOT NULL
      OR artifact_hash<>encode(extensions.digest(pg_catalog.convert_to(artifact_bytes,'UTF8'),'sha256'),'hex'))) THEN
    RAISE EXCEPTION 'monthly_report_storage_prepare_failed';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.prepare_monthly_cycle_report_publication(jsonb_build_object('contractVersion','monthly_cycle_reports_publish.v2',
      'deploymentEnvironment','production','actorUserId',v_actor,'closePackageId',v_close->>'closePackageId','rootHash',v_root_hash));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%monthly_report_publication_runtime_disabled%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'production_monthly_report_publish_should_fail';END IF;
  v_denied:=false;
  BEGIN PERFORM public.apply_monthly_report_retention(v_actor,clock_timestamp()+interval '8 years',10);
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%monthly_report_retention_requires_storage_tombstone%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'monthly_report_retention_bypassed_storage_tombstone';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundpending','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture',
    'providerCreatedAt','2026-07-11T10:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786432000,'payloadSha256',repeat('3',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refund_pending','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','0',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command)
    OR (SELECT funding_status FROM public.epoch_project_packages WHERE id=v_package)<>'unsettled'
    OR (SELECT count(*) FROM public.stripe_pay_by_bank_package_invalidations WHERE command_id=v_command AND reason='refund_pending')<>1
    OR (SELECT root_hash FROM public.epoch_close_packages WHERE id=(v_close->>'closePackageId')::bigint)<>v_root_hash THEN
    RAISE EXCEPTION 'refund_pending_should_invalidate';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundfailed','providerAccountId','acct_testbank','eventType','refund.failed','providerObjectId','re_bankfixture',
    'providerCreatedAt','2026-07-11T11:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786435600,'payloadSha256',repeat('a',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refund_failed','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','0',
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
    'providerCreatedAt','2026-07-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439200,'payloadSha256',repeat('5',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','2500',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT id INTO v_reversal FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_ledger;
  SELECT e.ledger_transaction_id INTO v_residual FROM public.stripe_pay_by_bank_evidence e WHERE command_id=v_command AND evidence_type='refunded' ORDER BY id DESC LIMIT 1;
  IF v_reversal IS NULL OR v_residual IS NULL OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_residual AND side='debit')<>7500
    OR (SELECT available_for_package FROM public.stripe_pay_by_bank_status WHERE command_id=v_command) THEN RAISE EXCEPTION 'partial_refund_conservation_failed';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefunded2','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture2',
    'providerCreatedAt','2026-07-11T13:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786442800,'payloadSha256',repeat('8',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture2',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  SELECT e.ledger_transaction_id INTO v_second_residual FROM public.stripe_pay_by_bank_evidence e
    WHERE command_id=v_command AND provider_refund_id='re_bankfixture2';
  IF v_second_residual IS NULL OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000
    OR NOT EXISTS(SELECT 1 FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_residual) THEN
    RAISE EXCEPTION 'sequential_partial_refund_should_replace_residual';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefunded2replay','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture2',
    'providerCreatedAt','2026-07-11T13:05:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786443100,'payloadSha256',repeat('b',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture2',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefunded2replay')
    OR (SELECT count(*) FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id))<>1
    OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000 THEN
    RAISE EXCEPTION 'same_status_provider_replay_should_be_idempotent';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundedstale','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture4',
    'providerCreatedAt','2026-07-11T13:10:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786443400,'payloadSha256',repeat('c',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture4',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','2500','cumulativeRefundedAmountMinor','2500',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefundedstale')
    OR (SELECT count(*) FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id))<>1
    OR (SELECT native_atomic_amount FROM public.ledger_postings WHERE transaction_id=v_second_residual AND side='debit')<>5000 THEN
    RAISE EXCEPTION 'decreasing_cumulative_refund_should_not_enlarge_residual';END IF;

  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankrefundedfull','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture3',
    'providerCreatedAt','2026-07-11T14:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786446400,'payloadSha256',repeat('9',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture3',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','10000',
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
    'providerCreatedAt','2026-07-11T15:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786450000,'payloadSha256',repeat('f',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
    'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture5',
    'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','5000',
    'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id='evt_bankrefundedafterfull')
    OR EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_evidence e WHERE e.command_id=v_command AND e.evidence_type='refunded'
      AND e.ledger_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id)) THEN
    RAISE EXCEPTION 'stale_refund_after_full_should_not_recreate_residual';END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_bankrefundedafterfull','providerAccountId','acct_testbank','eventType','refund.updated','providerObjectId','re_bankfixture5',
      'providerCreatedAt','2026-07-11T15:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786450001,'payloadSha256',repeat('e',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','refunded','commandId',v_command,
      'providerCheckoutSessionId','cs_test_bankfixture','providerPaymentIntentId','pi_bankfixture','providerChargeId','ch_bankfixture','providerRefundId','re_bankfixture5',
      'providerBalanceTransactionId','txn_bankfixture','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10000','refundAmountMinor','5000','cumulativeRefundedAmountMinor','5000',
      'feeAmountMinor','30','netAmountMinor','9970','balanceStatus','available','paymentMethodType','pay_by_bank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_webhook_dedupe_conflict%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'changed_stale_provider_event_should_conflict';END IF;

  INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,updated_by)
  VALUES(3,'2026-08-01','2026-08-31',1000,111.10,11.11,v_actor) RETURNING id INTO v_terminal_payment;
  PERFORM public.post_project_payment_funding_quote(jsonb_build_object('contractVersion','project_payment_funding_quote.v1','deploymentEnvironment','local',
    'actorUserId',v_actor,'paymentId',v_terminal_payment,'railKey','stripe_pay_by_bank','currencyCode','EUR','rateUsdPerUnit','1.10',
    'sourceKey','local_review_fx','observedAt',clock_timestamp()-interval '1 minute','freshnessExpiresAt',clock_timestamp()+interval '1 day','evidenceHash',repeat('b',64)));
  v_terminal:=public.prepare_stripe_pay_by_bank_command(v_base||jsonb_build_object('paymentId',v_terminal_payment,'expectedAmountMinor','10100'));
  PERFORM public.acknowledge_stripe_pay_by_bank_checkout(jsonb_build_object('commandId',v_terminal,'providerAccountId','acct_testbank',
    'providerCheckoutSessionId','cs_test_bankterminal','capabilityEvidenceHash',repeat('d',64)));
  PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
    'providerEventId','evt_bankexpired','providerAccountId','acct_testbank','eventType','checkout.session.expired','providerObjectId','cs_test_bankterminal',
    'providerCreatedAt','2026-07-12T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786525600,'payloadSha256',repeat('6',64),
    'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','expired','commandId',v_terminal,
    'providerCheckoutSessionId','cs_test_bankterminal','providerPaymentIntentId',NULL,'providerChargeId',NULL,'providerRefundId',NULL,
    'providerBalanceTransactionId',NULL,'currencyCode','EUR','customerCountry','FI','grossAmountMinor','10100','refundAmountMinor',NULL,
    'feeAmountMinor',NULL,'netAmountMinor',NULL,'balanceStatus',NULL,'paymentMethodType',NULL));
  v_denied:=false;
  BEGIN
    PERFORM public.ingest_stripe_pay_by_bank_webhook(jsonb_build_object('contractVersion','stripe_pay_by_bank_webhook.v1','deploymentEnvironment','local',
      'providerEventId','evt_banklate','providerAccountId','acct_testbank','eventType','payment_intent.succeeded','providerObjectId','pi_bankterminal',
      'providerCreatedAt','2026-07-11T12:00:00Z','apiVersion','2026-06-24.dahlia','signatureTimestamp',1786439201,'payloadSha256',repeat('7',64),
      'livemode',false,'observationSource','stripe_sdk_v1','capabilityEvidenceHash',repeat('d',64),'evidenceType','settled_available','commandId',v_terminal,
      'providerCheckoutSessionId','cs_test_bankterminal','providerPaymentIntentId','pi_bankterminal','providerChargeId','ch_bankterminal','providerRefundId',NULL,
      'providerBalanceTransactionId','txn_bankterminal','currencyCode','EUR','customerCountry','FI','grossAmountMinor','10100','refundAmountMinor',NULL,
      'feeAmountMinor','30','netAmountMinor','10070','balanceStatus','available','paymentMethodType','pay_by_bank'));
  EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM LIKE '%stripe_pay_by_bank_terminal_evidence_blocks_settlement%';END;
  IF NOT v_denied THEN RAISE EXCEPTION 'expired_should_block_late_settlement';END IF;
END $$;

ROLLBACK;
