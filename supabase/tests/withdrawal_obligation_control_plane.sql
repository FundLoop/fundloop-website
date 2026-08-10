BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE
  v_actor uuid; v_other uuid; v_cycle bigint; v_next_cycle bigint; v_project bigint; v_other_project bigint; v_run bigint; v_result bigint;
  v_credit bigint; v_obligation bigint; v_stripe_asset bigint; v_stripe_custody bigint; v_base_asset bigint; v_base_custody bigint;
  v_stripe_fx bigint; v_base_fx bigint; v_stripe_route bigint; v_base_route bigint; v_request jsonb; v_request_id uuid; v_replay jsonb;
  v_failed boolean; v_index integer; v_claims numeric; v_intents integer;
BEGIN
  SELECT user_id INTO v_actor FROM public.users WHERE email='maya@fundloop.example.com';
  SELECT user_id INTO v_other FROM public.users WHERE user_id<>v_actor ORDER BY created_at,user_id LIMIT 1;
  SELECT id INTO v_project FROM public.projects ORDER BY id LIMIT 1;
  SELECT id INTO v_other_project FROM public.projects WHERE id<>v_project ORDER BY id LIMIT 1;
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status) VALUES
    ('2026-10',2026,10,'2026-10-01','2026-10-31','open'),('2026-11',2026,11,'2026-11-01','2026-11-30','open')
  ON CONFLICT(cycle_key) DO UPDATE SET status=excluded.status;
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key='2026-10';
  SELECT id INTO v_next_cycle FROM public.monthly_cycles WHERE cycle_key='2026-11';
  SELECT id INTO v_stripe_asset FROM public.financial_assets WHERE asset_key='stripe_sandbox_usd';
  SELECT id INTO v_stripe_custody FROM public.financial_custody_accounts WHERE asset_id=v_stripe_asset ORDER BY id LIMIT 1;
  INSERT INTO public.financial_assets(asset_key,rail_key,symbol,atomic_scale,classification_metadata)
    VALUES('base_review_usdc','base_review','USDC',6,'{"purpose":"withdrawal_local_fixture"}')
    ON CONFLICT(asset_key) DO UPDATE SET rail_key=excluded.rail_key RETURNING id INTO v_base_asset;
  INSERT INTO public.financial_custody_accounts(custody_key,asset_id,provider_key,external_reference_hash,classification_metadata)
    VALUES('base_review_usdc_custody',v_base_asset,'base_review',repeat('b',64),'{"purpose":"withdrawal_local_fixture"}')
    ON CONFLICT(custody_key) DO UPDATE SET asset_id=excluded.asset_id RETURNING id INTO v_base_custody;
  INSERT INTO public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id,version,method,rate_usd_per_unit,status,stablecoin_peg_status,
    preanalysis,reviewed_by_user_id,posted_at,evidence_hash,deployment_environment)
  VALUES(v_cycle,v_stripe_asset,1,'manual_after_exhaustion',1,'posted','within_band','{"fixture":true}',v_actor,clock_timestamp(),repeat('c',64),'local')
  RETURNING id INTO v_stripe_fx;
  INSERT INTO public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id,version,method,rate_usd_per_unit,status,stablecoin_peg_status,
    preanalysis,reviewed_by_user_id,posted_at,evidence_hash,deployment_environment)
  VALUES(v_cycle,v_base_asset,1,'manual_after_exhaustion',1,'posted','within_band','{"fixture":true}',v_actor,clock_timestamp(),repeat('d',64),'local')
  RETURNING id INTO v_base_fx;
  INSERT INTO public.user_payout_routes(user_id,rail,label,currency_code,destination,is_default,status,created_by_user_id)
  VALUES(v_actor,'fiat_stub','Stripe review bank','USD','{"bank":"hashed-fixture"}',true,'active',v_actor) RETURNING id INTO v_stripe_route;
  INSERT INTO public.user_payout_routes(user_id,rail,label,currency_code,destination,is_default,status,created_by_user_id)
  VALUES(v_actor,'evm','Base review wallet','USDC','{"address":"0x0000000000000000000000000000000000000001"}',false,'active',v_actor) RETURNING id INTO v_base_route;
  INSERT INTO public.zkas_runs(month,status,usd_pool,monthly_cycle_id,created_by_user_id) VALUES('2026-10','draft',400,v_cycle,v_actor) RETURNING id INTO v_run;

  FOR v_index IN 1..20 LOOP
    INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,output_row_hash,monthly_cycle_id)
      VALUES(v_run,'withdrawal-user-'||v_index,true,10,20,md5(v_index::text)||md5((v_index+100)::text),v_cycle) RETURNING id INTO v_result;
    INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,usd_equivalent_amount,
      idempotency_key,credited_by_user_id) VALUES(v_cycle,v_run,v_result,v_actor,20,'withdrawal-credit-'||v_index,v_actor) RETURNING id INTO v_credit;
    INSERT INTO public.user_withdrawal_obligations(source_bookkeeping_credit_id,monthly_cycle_id,user_id,total_minor,state,available_at,
      source_expires_after_cycle_id,evidence_hash)
      VALUES(v_credit,v_cycle,v_actor,2000,'available','2026-10-01T00:00:00Z'::timestamptz+make_interval(secs=>v_index),v_cycle,
        encode(extensions.digest(convert_to('obligation-'||v_index,'UTF8'),'sha256'),'hex')) RETURNING id INTO v_obligation;
    INSERT INTO public.payout_inventory_lots(obligation_id,legacy_inventory_key,project_id,user_id,monthly_cycle_id,rail_key,
      financial_asset_id,custody_account_id,fx_snapshot_id,canonical_minor_total,native_atomic_total,deterministic_sequence,
      expires_after_cycle_id,evidence_hash)
    VALUES(v_obligation,'legacy:stripe:'||v_index,v_project,v_actor,v_cycle,'stripe_bank_transfer',v_stripe_asset,v_stripe_custody,
      v_stripe_fx,CASE WHEN v_index=20 THEN 100 ELSE 2000 END,CASE WHEN v_index=20 THEN 100 ELSE 2000 END,v_index,v_cycle,
      encode(extensions.digest(convert_to('stripe-inventory-'||v_index,'UTF8'),'sha256'),'hex'));
    INSERT INTO public.payout_inventory_lots(obligation_id,legacy_inventory_key,project_id,user_id,monthly_cycle_id,rail_key,
      financial_asset_id,custody_account_id,fx_snapshot_id,canonical_minor_total,native_atomic_total,deterministic_sequence,
      expires_after_cycle_id,evidence_hash)
    VALUES(v_obligation,'legacy:base:'||v_index,v_project,v_actor,v_cycle,'base_stablecoin',v_base_asset,v_base_custody,
      v_base_fx,2000,20000000,v_index,v_cycle,
      encode(extensions.digest(convert_to('base-inventory-'||v_index,'UTF8'),'sha256'),'hex'));
  END LOOP;

  -- Production and literal staging fail closed.
  v_failed:=false; BEGIN PERFORM public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3',
    'deploymentEnvironment','production','payoutRouteId',v_stripe_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','prod-denied-1'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%withdrawal_runtime_disabled%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'production withdrawal was accepted'; END IF;

  -- Stripe minimum and exact oldest-first partial claim.
  v_failed:=false; BEGIN PERFORM public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3',
    'deploymentEnvironment','local','payoutRouteId',v_stripe_route,'requestedMinor',999,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-small-1'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%withdrawal_minimum_not_met%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Stripe sub-$10 request was accepted'; END IF;
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_stripe_route,'requestedMinor',2500,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-partial-1'));
  v_request_id:=(v_request->>'requestId')::uuid;
  SELECT sum(claimed_minor) INTO v_claims FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id;
  IF v_request->>'status'<>'reserved' OR v_claims<>2500 OR (SELECT count(*) FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id)<>2
    OR (SELECT claimed_minor FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id ORDER BY sequence_no LIMIT 1)<>2000
    OR (SELECT claimed_minor FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id ORDER BY sequence_no OFFSET 1 LIMIT 1)<>500
    OR (SELECT sum(native_atomic_amount) FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request_id)<>2500
    OR (SELECT count(*) FROM public.payout_intents WHERE withdrawal_request_id=v_request_id AND source_result_id IS NULL)<>1
  THEN RAISE EXCEPTION 'partial oldest-first or exact inventory reservation failed'; END IF;
  v_replay:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_stripe_route,'requestedMinor',2500,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-partial-1'));
  IF v_replay->>'requestId'<>v_request->>'requestId' THEN RAISE EXCEPTION 'idempotent replay changed request'; END IF;
  v_failed:=false; BEGIN PERFORM public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3',
    'deploymentEnvironment','local','payoutRouteId',v_stripe_route,'requestedMinor',2600,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-partial-1'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%withdrawal_idempotency_conflict%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed idempotent request was accepted'; END IF;

  -- The chosen project is part of the immutable request snapshot and cannot borrow same-asset inventory from another project.
  v_failed:=false; BEGIN PERFORM public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3',
    'deploymentEnvironment','local','payoutRouteId',v_stripe_route,'requestedMinor',1000,'projectId',v_other_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','wrong-project-1'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%withdrawal_asset_not_eligible%'; END;
  IF NOT v_failed OR EXISTS(
    SELECT 1 FROM public.payout_inventory_reservations reservation
    JOIN public.user_withdrawal_requests request ON request.id=reservation.withdrawal_request_id
    JOIN public.payout_inventory_lots lot ON lot.id=reservation.inventory_lot_id
    WHERE lot.project_id<>request.project_id
  ) THEN RAISE EXCEPTION 'project-scoped withdrawal borrowed cross-project inventory'; END IF;

  -- Base minimum, 100% fee snapshot, and zero provider-backed intent for zero net.
  v_failed:=false; BEGIN PERFORM public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3',
    'deploymentEnvironment','local','payoutRouteId',v_base_route,'requestedMinor',499,'projectId',v_project,'assetKey','base_review_usdc','userFeeBps',0,'idempotencyKey','base-small-1'));
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%withdrawal_minimum_not_met%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Base sub-$5 request was accepted'; END IF;
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_base_route,'requestedMinor',500,'projectId',v_project,'assetKey','base_review_usdc','userFeeBps',10000,'idempotencyKey','base-full-fee-1'));
  IF v_request->>'status'<>'closed' OR v_request->>'feeMinor'<>'500' OR v_request->>'netMinor'<>'0'
    OR EXISTS(SELECT 1 FROM public.payout_intents WHERE withdrawal_request_id=(v_request->>'requestId')::uuid)
  THEN RAISE EXCEPTION '100 percent fee snapshot did not close safely'; END IF;

  -- A held request preserves claims and reservations, then cancellation releases both.
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_base_route,'requestedMinor',500,'projectId',v_project,'assetKey','base_review_usdc','userFeeBps',0,'idempotencyKey','base-hold-1'));
  v_request_id:=(v_request->>'requestId')::uuid;
  PERFORM public.place_withdrawal_compliance_hold(v_other,v_request_id,'review_required',repeat('e',64),'local');
  IF (SELECT status FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'held'
    OR NOT EXISTS(SELECT 1 FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request_id AND status='held')
    OR (SELECT sum(native_atomic_amount) FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request_id)<>5000000
  THEN RAISE EXCEPTION 'compliance hold was not atomic'; END IF;
  PERFORM public.manage_user_withdrawal_request(v_actor,v_request_id,'cancel','user_cancelled','local');
  IF EXISTS(SELECT 1 FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request_id AND status IN('reserved','held'))
    OR EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id AND status IN('reserved','queued','held'))
    OR EXISTS(SELECT 1 FROM public.withdrawal_compliance_holds WHERE withdrawal_request_id=v_request_id AND status='active')
  THEN RAISE EXCEPTION 'cancellation left active reservations'; END IF;

  -- Reservation expiry requeues the timely claim and removes the live intent.
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_stripe_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-expiry-1'));
  v_request_id:=(v_request->>'requestId')::uuid;
  v_index:=public.expire_withdrawal_inventory_reservations(clock_timestamp()+interval '49 hours','local');
  IF v_index<1
    OR (SELECT status FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'queued'
    OR NOT EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id AND status='queued')
    OR EXISTS(SELECT 1 FROM public.payout_intents WHERE withdrawal_request_id=v_request_id AND status IN('draft','ready','batched','processing'))
  THEN RAISE EXCEPTION 'timely request did not survive reservation expiry status=% claims=% intents=%',
    (SELECT status FROM public.user_withdrawal_requests WHERE id=v_request_id),
    (SELECT string_agg(status,',') FROM public.user_withdrawal_obligation_claims WHERE withdrawal_request_id=v_request_id),
    (SELECT string_agg(status::text,',') FROM public.payout_intents WHERE withdrawal_request_id=v_request_id); END IF;

  -- Depleted selected-asset inventory queues without an unbacked intent.
  UPDATE public.epoch_shadow_states SET monthly_cycle_id=v_cycle,current_stage='payout_readying',updated_at=clock_timestamp()
  WHERE id=(SELECT id FROM public.epoch_shadow_states WHERE current_stage<>'closed' ORDER BY updated_at DESC,id DESC LIMIT 1);
  UPDATE public.payout_inventory_lots SET status='closed' WHERE user_id=v_actor AND financial_asset_id=v_stripe_asset AND legacy_inventory_key<>'legacy:stripe:20';
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_stripe_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','stripe-queue-1'));
  v_request_id:=(v_request->>'requestId')::uuid;
  IF v_request->>'status'<>'queued' OR EXISTS(SELECT 1 FROM public.payout_intents WHERE withdrawal_request_id=v_request_id)
    OR EXISTS(SELECT 1 FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request_id)
    OR (SELECT queue_for_cycle_id FROM public.user_withdrawal_requests WHERE id=v_request_id)<>v_next_cycle
    OR (SELECT queue_for_cycle_key FROM public.user_withdrawal_requests WHERE id=v_request_id)<>'2026-11'
  THEN RAISE EXCEPTION 'depleted inventory created an unbacked liability'; END IF;

  -- Queue derivation follows the current processing epoch, not an old obligation source cycle.
  UPDATE public.epoch_shadow_states SET monthly_cycle_id=v_next_cycle,current_stage='payout_readying',updated_at=clock_timestamp()
  WHERE id=(SELECT id FROM public.epoch_shadow_states WHERE current_stage<>'closed' ORDER BY updated_at DESC,id DESC LIMIT 1);
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
    VALUES('2026-12',2026,12,'2026-12-01','2026-12-31','open') ON CONFLICT(cycle_key) DO NOTHING;
  v_request:=public.create_user_withdrawal_request_v3(v_actor,jsonb_build_object('contractVersion','withdrawal_request.v3','deploymentEnvironment','local',
    'payoutRouteId',v_stripe_route,'requestedMinor',1000,'projectId',v_project,'assetKey','stripe_sandbox_usd','userFeeBps',0,'idempotencyKey','current-epoch-queue-1'));
  IF v_request->>'status'<>'queued' OR (SELECT queue_for_cycle_key FROM public.user_withdrawal_requests WHERE id=(v_request->>'requestId')::uuid)<>'2026-12'
  THEN RAISE EXCEPTION 'queue target followed source cycle instead of current processing epoch'; END IF;

  -- Direct result-based intent creation is retired.
  v_failed:=false; BEGIN INSERT INTO public.payout_intents(monthly_cycle_id,source_result_id,user_id,amount_usd,status,idempotency_key)
    VALUES(v_cycle,v_result,v_actor,1,'draft','legacy-direct-intent');
  EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%direct_result_payout_intents_retired%'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'direct result payout intent was accepted'; END IF;

  -- Browser/service roles cannot bypass typed commands or mutate control tables.
  v_failed:=false; BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM public.create_user_withdrawal_request_v3(v_actor,'{}');
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated could execute withdrawal RPC'; END IF;
  v_failed:=false; BEGIN EXECUTE 'SET LOCAL ROLE service_role'; INSERT INTO public.payout_inventory_reservations(
    withdrawal_request_id,inventory_lot_id,sequence_no,reserved_minor,native_atomic_amount,originating_fx_snapshot_id,expires_at)
    SELECT v_request_id,id,99,1,1,fx_snapshot_id,clock_timestamp()+interval '1 hour' FROM public.payout_inventory_lots LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END; RESET ROLE;
  IF NOT v_failed THEN RAISE EXCEPTION 'service role direct reservation write was accepted'; END IF;

  -- Every minor unit remains in exactly one obligation state and other users see none.
  IF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_balances balance
    WHERE total_minor<>available_minor+reserved_minor+queued_minor+held_minor+paid_minor+closed_minor)
    OR NOT EXISTS(SELECT 1 FROM public.user_withdrawal_asset_inventory WHERE user_id=v_actor AND project_id=v_project)
  THEN RAISE EXCEPTION 'withdrawal obligation state conservation failed'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  IF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_balances) OR EXISTS(SELECT 1 FROM public.user_withdrawal_asset_inventory)
  THEN RAISE EXCEPTION 'cross-user withdrawal inventory leaked'; END IF;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub','',true);

  SELECT count(*) INTO v_intents FROM public.payout_intents WHERE withdrawal_request_id IS NOT NULL AND status IN('draft','ready','batched','processing');
  IF v_intents<>(SELECT count(DISTINCT withdrawal_request_id) FROM public.payout_intents WHERE withdrawal_request_id IS NOT NULL AND status IN('draft','ready','batched','processing'))
  THEN RAISE EXCEPTION 'multiple live payout intents exist'; END IF;
END $$;

ROLLBACK;
