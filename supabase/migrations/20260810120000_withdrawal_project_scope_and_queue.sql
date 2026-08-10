-- Close #139 validation gaps without enabling payout execution or production value flow.

ALTER TABLE public.user_withdrawal_requests
  ADD COLUMN project_id bigint REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.user_withdrawal_requests
  ADD CONSTRAINT user_withdrawal_requests_project_scoped_v3 CHECK(
    request_hash IS NULL OR project_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.reserve_withdrawal_inventory(p_request_id uuid,p_now timestamptz DEFAULT clock_timestamp())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_need numeric(78,0); v_remaining numeric(78,0); v_lot record; v_take numeric(78,0); v_native numeric(78,0); v_seq integer:=0;
BEGIN
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.net_minor IS NULL OR v_request.net_minor=0 THEN RETURN true; END IF;
  IF v_request.project_id IS NULL THEN RAISE EXCEPTION 'withdrawal_project_scope_required'; END IF;
  v_need:=v_request.net_minor; v_remaining:=v_need;
  FOR v_lot IN
    SELECT lot.*,asset.atomic_scale,fx.rate_usd_per_unit,
      lot.canonical_minor_total-coalesce((SELECT sum(r.reserved_minor) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0) AS available_minor,
      lot.native_atomic_total-coalesce((SELECT sum(r.native_atomic_amount) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0) AS available_native
    FROM public.payout_inventory_lots lot
    JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
    JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id
    WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
      AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key
      AND lot.status IN('available','reserved')
      AND EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims claim
        WHERE claim.withdrawal_request_id=v_request.id AND claim.obligation_id=lot.obligation_id AND claim.status IN('queued','reserved','held'))
    ORDER BY lot.monthly_cycle_id,lot.deterministic_sequence,lot.id FOR UPDATE OF lot
  LOOP
    EXIT WHEN v_remaining=0;
    IF v_lot.available_minor<=0 OR v_lot.available_native<=0 THEN CONTINUE; END IF;
    v_take:=least(v_remaining,v_lot.available_minor);
    v_native:=ceil((v_take::numeric/100)/v_lot.rate_usd_per_unit*power(10,v_lot.atomic_scale));
    IF v_native>v_lot.available_native THEN
      v_take:=floor(v_lot.available_native/power(10,v_lot.atomic_scale)*v_lot.rate_usd_per_unit*100);
      IF v_take<=0 THEN CONTINUE; END IF;
      v_native:=ceil((v_take::numeric/100)/v_lot.rate_usd_per_unit*power(10,v_lot.atomic_scale));
    END IF;
    v_seq:=v_seq+1;
    INSERT INTO public.payout_inventory_reservations(withdrawal_request_id,inventory_lot_id,sequence_no,reserved_minor,
      native_atomic_amount,originating_fx_snapshot_id,reserved_at,expires_at)
    VALUES(v_request.id,v_lot.id,v_seq,v_take,v_native,v_lot.fx_snapshot_id,p_now,p_now+interval '48 hours');
    v_remaining:=v_remaining-v_take;
  END LOOP;
  IF v_remaining>0 THEN
    DELETE FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request.id AND status='reserved';
    RETURN false;
  END IF;
  RETURN true;
END; $$;

CREATE FUNCTION public.create_user_withdrawal_request_v3(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment'); v_route public.user_payout_routes%ROWTYPE;
  v_asset public.financial_assets%ROWTYPE; v_existing public.user_withdrawal_requests%ROWTYPE; v_request public.user_withdrawal_requests%ROWTYPE;
  v_key text:=btrim(p_command->>'idempotencyKey'); v_hash text; v_amount numeric(78,0); v_fee_bps integer; v_fee numeric(78,0); v_net numeric(78,0);
  v_project_id bigint; v_destination_hash text; v_rail text; v_available numeric(78,0); v_remaining numeric(78,0); v_obligation record; v_take numeric(78,0); v_seq integer:=0;
  v_reserved boolean; v_cycle_id bigint; v_queue_origin_cycle_id bigint; v_queue_cycle_id bigint; v_queue_cycle_key text; v_intent_id bigint; v_native numeric(78,0); v_status text;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(v_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  IF p_command->>'contractVersion'<>'withdrawal_request.v3'
    OR v_key IS NULL OR length(v_key)<8 OR length(v_key)>128 THEN RAISE EXCEPTION 'withdrawal_request_contract_invalid'; END IF;
  v_amount:=(p_command->>'requestedMinor')::numeric; v_fee_bps:=(p_command->>'userFeeBps')::integer;
  v_project_id:=(p_command->>'projectId')::bigint;
  IF v_amount<=0 OR v_amount<>trunc(v_amount) OR v_fee_bps NOT BETWEEN 0 AND 10000 OR v_project_id<=0
  THEN RAISE EXCEPTION 'withdrawal_request_amount_invalid'; END IF;
  SELECT * INTO v_route FROM public.user_payout_routes WHERE id=(p_command->>'payoutRouteId')::bigint AND user_id=p_actor_user_id AND status='active' FOR UPDATE;
  IF v_route.id IS NULL THEN RAISE EXCEPTION 'active_payout_route_required'; END IF;
  v_rail:=CASE v_route.rail WHEN 'fiat_stub' THEN 'stripe_bank_transfer' WHEN 'evm' THEN 'base_stablecoin' ELSE NULL END;
  IF v_rail IS NULL THEN RAISE EXCEPTION 'withdrawal_rail_not_supported'; END IF;
  IF (v_rail='stripe_bank_transfer' AND v_amount<1000) OR (v_rail='base_stablecoin' AND v_amount<500) THEN RAISE EXCEPTION 'withdrawal_minimum_not_met'; END IF;
  SELECT * INTO v_asset FROM public.financial_assets WHERE asset_key=p_command->>'assetKey' AND NOT production_enabled;
  IF v_asset.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.payout_inventory_lots lot
    WHERE lot.user_id=p_actor_user_id AND lot.project_id=v_project_id AND lot.financial_asset_id=v_asset.id AND lot.rail_key=v_rail)
  THEN RAISE EXCEPTION 'withdrawal_asset_not_eligible'; END IF;
  v_destination_hash:=encode(extensions.digest(pg_catalog.convert_to(v_route.destination::text,'UTF8'),'sha256'),'hex');
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('contractVersion','withdrawal_request.v3','payoutRouteId',v_route.id,
    'requestedMinor',v_amount::text,'userFeeBps',v_fee_bps,'projectId',v_project_id,'assetKey',v_asset.asset_key,'destinationHash',v_destination_hash)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('withdrawal:'||p_actor_user_id::text||':'||v_key,0));
  SELECT * INTO v_existing FROM public.user_withdrawal_requests WHERE user_id=p_actor_user_id AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'withdrawal_idempotency_conflict'; END IF;
    RETURN jsonb_build_object('requestId',v_existing.id,'status',v_existing.status,'requestedMinor',v_existing.requested_minor::text,
      'feeMinor',v_existing.fee_minor::text,'netMinor',v_existing.net_minor::text,'projectId',v_existing.project_id,'assetKey',v_asset.asset_key,'railKey',v_existing.rail_key,
      'payoutIntentId',(SELECT id FROM public.payout_intents WHERE withdrawal_request_id=v_existing.id ORDER BY id DESC LIMIT 1),'noPayoutExecuted',true);
  END IF;
  SELECT coalesce(sum(obligation.total_minor-coalesce((SELECT sum(claim.claimed_minor) FROM public.user_withdrawal_obligation_claims claim
    WHERE claim.obligation_id=obligation.id AND claim.status IN('reserved','queued','held','paid','closed')),0)),0)
  INTO v_available FROM public.user_withdrawal_obligations obligation WHERE obligation.user_id=p_actor_user_id AND obligation.state IN('available','reserved','queued','held');
  IF v_available<v_amount THEN RAISE EXCEPTION 'withdrawal_available_amount_insufficient'; END IF;
  v_fee:=floor(v_amount*v_fee_bps/10000); v_net:=v_amount-v_fee;
  INSERT INTO public.user_withdrawal_requests(user_id,payout_route_id,status,requested_usd_amount,currency_code,idempotency_key,
    requested_minor,fee_minor,net_minor,user_fee_bps,rail_key,financial_asset_id,project_id,destination_hash,request_hash)
  VALUES(p_actor_user_id,v_route.id,'requested',v_amount/100,'USD',v_key,v_amount,v_fee,v_net,v_fee_bps,v_rail,v_asset.id,v_project_id,v_destination_hash,v_hash)
  RETURNING * INTO v_request;
  v_remaining:=v_amount;
  FOR v_obligation IN
    SELECT obligation.*,obligation.total_minor-coalesce((SELECT sum(claim.claimed_minor) FROM public.user_withdrawal_obligation_claims claim
      WHERE claim.obligation_id=obligation.id AND claim.status IN('reserved','queued','held','paid','closed')),0) AS unclaimed_minor
    FROM public.user_withdrawal_obligations obligation
    WHERE obligation.user_id=p_actor_user_id AND obligation.state IN('available','reserved','queued','held')
    ORDER BY obligation.available_at,obligation.id FOR UPDATE OF obligation
  LOOP
    EXIT WHEN v_remaining=0;
    IF v_obligation.unclaimed_minor<=0 THEN CONTINUE; END IF;
    v_take:=least(v_remaining,v_obligation.unclaimed_minor); v_seq:=v_seq+1;
    INSERT INTO public.user_withdrawal_obligation_claims(withdrawal_request_id,obligation_id,sequence_no,claimed_minor,status)
    VALUES(v_request.id,v_obligation.id,v_seq,v_take,'queued');
    v_remaining:=v_remaining-v_take;
  END LOOP;
  IF v_remaining<>0 THEN RAISE EXCEPTION 'withdrawal_concurrent_credit_reservation_failed'; END IF;
  SELECT min(obligation.monthly_cycle_id) INTO v_cycle_id FROM public.user_withdrawal_obligation_claims claim
    JOIN public.user_withdrawal_obligations obligation ON obligation.id=claim.obligation_id WHERE claim.withdrawal_request_id=v_request.id;
  IF v_net=0 THEN
    UPDATE public.user_withdrawal_obligation_claims SET status='closed',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id;
    UPDATE public.user_withdrawal_requests SET status='closed',status_reason='fee_consumed_full_request',closed_at=clock_timestamp() WHERE id=v_request.id;
    v_status:='closed'; v_intent_id:=NULL;
  ELSE
    v_reserved:=public.reserve_withdrawal_inventory(v_request.id);
    IF v_reserved THEN
      SELECT sum(native_atomic_amount) INTO v_native FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request.id AND status='reserved';
      UPDATE public.user_withdrawal_obligation_claims SET status='reserved',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id;
      UPDATE public.user_withdrawal_requests SET status='reserved' WHERE id=v_request.id;
      INSERT INTO public.payout_intents(monthly_cycle_id,source_result_id,user_id,payout_route_id,rail,currency_code,amount_usd,status,idempotency_key,
        created_by_user_id,updated_by_user_id,withdrawal_request_id,financial_asset_id,native_atomic_amount,user_fee_bps,fee_amount_usd)
      VALUES(v_cycle_id,NULL,p_actor_user_id,v_route.id,v_route.rail,'USD',v_net/100,'draft','withdrawal:'||v_request.id::text,
        p_actor_user_id,p_actor_user_id,v_request.id,v_asset.id,v_native,v_fee_bps,v_fee/100) RETURNING id INTO v_intent_id;
      v_status:='reserved';
    ELSE
      SELECT cycle.id INTO v_queue_origin_cycle_id FROM public.epoch_shadow_states state
        JOIN public.monthly_cycles cycle ON cycle.id=state.monthly_cycle_id
        WHERE state.current_stage<>'closed' AND NOT state.production_enabled
        ORDER BY cycle.period_start DESC,cycle.id DESC LIMIT 1;
      IF v_queue_origin_cycle_id IS NULL THEN v_queue_origin_cycle_id:=v_cycle_id; END IF;
      SELECT cycle.id,to_char(cycle.period_start,'YYYY-MM') INTO v_queue_cycle_id,v_queue_cycle_key
        FROM public.monthly_cycles cycle
        WHERE cycle.period_start>(SELECT period_start FROM public.monthly_cycles WHERE id=v_queue_origin_cycle_id)
        ORDER BY cycle.period_start,cycle.id LIMIT 1;
      IF v_queue_cycle_key IS NULL THEN
        SELECT to_char(period_start+interval '1 month','YYYY-MM') INTO v_queue_cycle_key FROM public.monthly_cycles WHERE id=v_queue_origin_cycle_id;
      END IF;
      UPDATE public.user_withdrawal_requests SET status='queued',queue_for_cycle_id=v_queue_cycle_id,
        queue_for_cycle_key=v_queue_cycle_key,status_reason='eligible_inventory_depleted' WHERE id=v_request.id;
      v_status:='queued'; v_intent_id:=NULL;
    END IF;
  END IF;
  INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,actor_user_id,evidence)
  VALUES(v_request.id,CASE v_status WHEN 'reserved' THEN 'reserved' WHEN 'queued' THEN 'queued' ELSE 'closed' END,'requested',v_status,p_actor_user_id,
    jsonb_build_object('requestHash',v_hash,'projectId',v_project_id,'feeBps',v_fee_bps,'noProviderCall',true));
  RETURN jsonb_build_object('requestId',v_request.id,'status',v_status,'requestedMinor',v_amount::text,'feeMinor',v_fee::text,'netMinor',v_net::text,
    'projectId',v_project_id,'assetKey',v_asset.asset_key,'railKey',v_rail,'payoutIntentId',v_intent_id,'noPayoutExecuted',true);
END; $$;

REVOKE ALL ON FUNCTION public.create_user_withdrawal_request_v2(uuid,jsonb) FROM service_role;
REVOKE ALL ON FUNCTION public.create_user_withdrawal_request_v3(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_withdrawal_request_v3(uuid,jsonb) TO service_role;
