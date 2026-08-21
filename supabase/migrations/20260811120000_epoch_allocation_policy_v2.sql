-- Corrected settled Cubid redistribution policy for Goal #134.
-- This migration is additive, preserves v1 artifacts, and remains local/dev/test only.

ALTER TABLE public.user_withdrawal_obligations
  ADD COLUMN harvested_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN claim_window_closed_at timestamptz,
  ADD CONSTRAINT withdrawal_obligation_harvest_amount CHECK(harvested_minor>=0 AND harvested_minor<=total_minor);

CREATE FUNCTION public.prevent_harvested_obligation_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric(78,0); v_harvested numeric(78,0); v_claimed numeric(78,0);
BEGIN
  SELECT total_minor,harvested_minor INTO v_total,v_harvested
  FROM public.user_withdrawal_obligations WHERE id=NEW.obligation_id FOR UPDATE;
  SELECT coalesce(sum(claimed_minor),0) INTO v_claimed
  FROM public.user_withdrawal_obligation_claims
  WHERE obligation_id=NEW.obligation_id AND status<>'released' AND id IS DISTINCT FROM NEW.id;
  IF v_claimed+(CASE WHEN NEW.status='released' THEN 0 ELSE NEW.claimed_minor END)>v_total-v_harvested
  THEN RAISE EXCEPTION 'withdrawal_obligation_claim_window_closed'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER withdrawal_claim_harvest_guard BEFORE INSERT OR UPDATE OF claimed_minor,status
ON public.user_withdrawal_obligation_claims FOR EACH ROW EXECUTE FUNCTION public.prevent_harvested_obligation_claim();

CREATE OR REPLACE VIEW public.user_withdrawal_obligation_balances WITH (security_invoker=true) AS
SELECT obligation.id,obligation.user_id,obligation.monthly_cycle_id,obligation.total_minor,obligation.state,
  (obligation.total_minor-obligation.harvested_minor-coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status<>'released'),0))::numeric(78,0) AS available_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='reserved'),0)::numeric(78,0) AS reserved_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='queued'),0)::numeric(78,0) AS queued_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='held'),0)::numeric(78,0) AS held_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='paid'),0)::numeric(78,0) AS paid_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='closed'),0)::numeric(78,0) AS closed_minor,
  obligation.harvested_minor,obligation.claim_window_closed_at
FROM public.user_withdrawal_obligations obligation
LEFT JOIN public.user_withdrawal_obligation_claims claim ON claim.obligation_id=obligation.id
GROUP BY obligation.id;

CREATE OR REPLACE FUNCTION public.refresh_withdrawal_obligation_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric(78,0); v_harvested numeric(78,0); v_claimed numeric(78,0); v_state text;
BEGIN
  SELECT total_minor,harvested_minor INTO v_total,v_harvested
  FROM public.user_withdrawal_obligations WHERE id=NEW.obligation_id FOR UPDATE;
  SELECT coalesce(sum(claimed_minor),0) INTO v_claimed FROM public.user_withdrawal_obligation_claims
    WHERE obligation_id=NEW.obligation_id AND status<>'released';
  IF v_claimed<v_total-v_harvested THEN v_state:='available';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='held') THEN v_state:='held';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='queued') THEN v_state:='queued';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='reserved') THEN v_state:='reserved';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='paid') THEN v_state:='paid';
  ELSE v_state:='closed'; END IF;
  UPDATE public.user_withdrawal_obligations SET state=v_state WHERE id=NEW.obligation_id;
  RETURN NEW;
END; $$;

-- Keep harvested value out of both the aggregate availability check and the
-- oldest-first obligation allocator. The claim guard remains the final
-- concurrency boundary, but valid newer obligations are no longer shadowed by a
-- harvested older obligation.
CREATE OR REPLACE FUNCTION public.create_user_withdrawal_request_v3(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment'); v_route public.user_payout_routes%ROWTYPE;
  v_asset public.financial_assets%ROWTYPE; v_existing public.user_withdrawal_requests%ROWTYPE; v_request public.user_withdrawal_requests%ROWTYPE;
  v_key text:=btrim(p_command->>'idempotencyKey'); v_hash text; v_amount numeric(78,0); v_fee_bps integer; v_fee numeric(78,0); v_net numeric(78,0);
  v_project_id bigint; v_destination_hash text; v_rail text; v_currency text; v_available numeric(78,0); v_remaining numeric(78,0); v_obligation record; v_take numeric(78,0); v_seq integer:=0;
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
  v_currency:=CASE WHEN v_asset.symbol IN('USD','CAD') THEN v_asset.symbol ELSE 'USD' END;
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
  SELECT coalesce(sum(obligation.total_minor-obligation.harvested_minor-coalesce((SELECT sum(claim.claimed_minor)
    FROM public.user_withdrawal_obligation_claims claim WHERE claim.obligation_id=obligation.id
      AND claim.status IN('reserved','queued','held','paid','closed')),0)),0)
  INTO v_available FROM public.user_withdrawal_obligations obligation
  WHERE obligation.user_id=p_actor_user_id AND obligation.state IN('available','reserved','queued','held')
    AND EXISTS(SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.obligation_id=obligation.id AND lot.user_id=p_actor_user_id
      AND lot.project_id=v_project_id AND lot.financial_asset_id=v_asset.id AND lot.rail_key=v_rail AND lot.status IN('available','reserved'));
  IF v_available<v_amount THEN RAISE EXCEPTION 'withdrawal_available_amount_insufficient'; END IF;
  v_fee:=floor(v_amount*v_fee_bps/10000); v_net:=v_amount-v_fee;
  INSERT INTO public.user_withdrawal_requests(user_id,payout_route_id,status,requested_usd_amount,currency_code,idempotency_key,
    requested_minor,fee_minor,net_minor,user_fee_bps,rail_key,financial_asset_id,project_id,destination_hash,request_hash)
  VALUES(p_actor_user_id,v_route.id,'requested',v_amount/100,v_currency,v_key,v_amount,v_fee,v_net,v_fee_bps,v_rail,v_asset.id,v_project_id,v_destination_hash,v_hash)
  RETURNING * INTO v_request;
  v_remaining:=v_amount;
  FOR v_obligation IN
    SELECT obligation.*,obligation.total_minor-obligation.harvested_minor-coalesce((SELECT sum(claim.claimed_minor)
      FROM public.user_withdrawal_obligation_claims claim WHERE claim.obligation_id=obligation.id
        AND claim.status IN('reserved','queued','held','paid','closed')),0) AS unclaimed_minor
    FROM public.user_withdrawal_obligations obligation
    WHERE obligation.user_id=p_actor_user_id AND obligation.state IN('available','reserved','queued','held')
      AND obligation.total_minor-obligation.harvested_minor-coalesce((SELECT sum(claim.claimed_minor)
        FROM public.user_withdrawal_obligation_claims claim WHERE claim.obligation_id=obligation.id
          AND claim.status IN('reserved','queued','held','paid','closed')),0)>0
      AND EXISTS(SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.obligation_id=obligation.id AND lot.user_id=p_actor_user_id
        AND lot.project_id=v_project_id AND lot.financial_asset_id=v_asset.id AND lot.rail_key=v_rail AND lot.status IN('available','reserved'))
    ORDER BY obligation.available_at,obligation.id FOR UPDATE OF obligation
  LOOP
    EXIT WHEN v_remaining=0;
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
      VALUES(v_cycle_id,NULL,p_actor_user_id,v_route.id,v_route.rail,v_currency,v_net/100,'draft','withdrawal:'||v_request.id::text,
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

CREATE TABLE public.epoch_redistribution_pool_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_lot_key text NOT NULL UNIQUE,
  target_monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_kind text NOT NULL,
  predecessor_pool_source_id bigint UNIQUE REFERENCES public.epoch_redistribution_pool_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_disposition_id bigint UNIQUE REFERENCES public.epoch_allocation_source_dispositions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_obligation_id bigint REFERENCES public.user_withdrawal_obligations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_inventory_lot_id bigint REFERENCES public.payout_inventory_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_award_fill_id bigint REFERENCES public.epoch_provisional_award_source_fills(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_amount numeric(78,0) NOT NULL,
  exact_usd numeric(38,18) NOT NULL,
  canonical_minor numeric(78,0) NOT NULL,
  minor_unit_scale smallint NOT NULL DEFAULT 2,
  source_order numeric(78,0) NOT NULL,
  state text NOT NULL DEFAULT 'ready_for_lock',
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_redistribution_source_kind CHECK(origin_kind IN('harvested_unclaimed','carryforward_residue')),
  CONSTRAINT epoch_redistribution_source_origin CHECK(
    (origin_kind='harvested_unclaimed' AND predecessor_pool_source_id IS NULL AND origin_obligation_id IS NOT NULL
      AND origin_inventory_lot_id IS NOT NULL AND origin_award_fill_id IS NOT NULL)
    OR (origin_kind='carryforward_residue' AND origin_disposition_id IS NOT NULL)
  ),
  CONSTRAINT epoch_redistribution_source_amount CHECK(native_atomic_amount>0 AND exact_usd>0 AND canonical_minor>=0),
  CONSTRAINT epoch_redistribution_source_scale CHECK(minor_unit_scale BETWEEN 0 AND 18),
  CONSTRAINT epoch_redistribution_source_state CHECK(state IN('ready_for_lock','reserved','carried_forward')),
  CONSTRAINT epoch_redistribution_source_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_redistribution_source_production_closed CHECK(production_enabled=false)
);
CREATE UNIQUE INDEX epoch_redistribution_harvest_once_idx
ON public.epoch_redistribution_pool_sources(target_monthly_cycle_id,origin_inventory_lot_id)
WHERE origin_kind='harvested_unclaimed';
CREATE INDEX epoch_redistribution_source_target_idx
ON public.epoch_redistribution_pool_sources(target_monthly_cycle_id,state,source_order,id);

ALTER TABLE public.epoch_allocation_manifests
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN selected_preview_hash text,
  ADD COLUMN current_funded_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN harvested_unclaimed_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN carry_in_minor numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE public.epoch_allocation_manifests DROP CONSTRAINT epoch_allocation_manifest_policy;
ALTER TABLE public.epoch_allocation_manifests ADD CONSTRAINT epoch_allocation_manifest_policy
  CHECK(policy_key IN('settled_cubid_redistribution_v1','settled_cubid_redistribution_v2'));
ALTER TABLE public.epoch_allocation_manifests ADD CONSTRAINT epoch_allocation_manifest_v2_shape CHECK(
  policy_key<>'settled_cubid_redistribution_v2' OR (
    cap_multiple BETWEEN 1 AND 10 AND cap_multiple=round(cap_multiple,2)
    AND selected_preview_hash ~ '^[0-9a-f]{64}$'
    AND funded_minor=current_funded_minor+harvested_unclaimed_minor+carry_in_minor
  )
);

CREATE TABLE public.epoch_allocation_manifest_pool_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manifest_id bigint NOT NULL REFERENCES public.epoch_allocation_manifests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  pool_source_id bigint NOT NULL UNIQUE REFERENCES public.epoch_redistribution_pool_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_lot_key text NOT NULL,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_kind text NOT NULL,
  origin_cycle_key text NOT NULL,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_amount numeric(78,0) NOT NULL,
  exact_usd numeric(38,18) NOT NULL,
  canonical_minor_capacity numeric(78,0) NOT NULL,
  source_order numeric(78,0) NOT NULL,
  evidence_hash text NOT NULL,
  UNIQUE(manifest_id,source_lot_key),
  CONSTRAINT epoch_allocation_pool_source_amount CHECK(native_atomic_amount>0 AND exact_usd>0 AND canonical_minor_capacity>=0),
  CONSTRAINT epoch_allocation_pool_source_kind CHECK(origin_kind IN('harvested_unclaimed','carryforward_residue')),
  CONSTRAINT epoch_allocation_pool_source_cycle CHECK(origin_cycle_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT epoch_allocation_pool_source_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_allocation_manifest_pool_order_idx
ON public.epoch_allocation_manifest_pool_sources(manifest_id,source_order,id);

ALTER TABLE public.epoch_allocation_runs
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN current_funded_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN harvested_unclaimed_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN carry_in_minor numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE public.epoch_allocation_runs DROP CONSTRAINT epoch_allocation_run_policy;
ALTER TABLE public.epoch_allocation_runs DROP CONSTRAINT epoch_allocation_run_amounts;
ALTER TABLE public.epoch_allocation_runs ADD CONSTRAINT epoch_allocation_run_policy
  CHECK(policy_key IN('settled_cubid_redistribution_v1','settled_cubid_redistribution_v2'));
ALTER TABLE public.epoch_allocation_runs ADD CONSTRAINT epoch_allocation_run_amounts CHECK(
  funded_minor>=0 AND retained_initial_minor>=0 AND score_pool_minor>=0 AND overlap_pool_minor>=0
  AND top_up_minor>=0 AND returned_residue_minor>=0 AND final_allocation_minor>=0
  AND final_allocation_minor+returned_residue_minor=funded_minor
  AND (
    (policy_key='settled_cubid_redistribution_v1' AND top_up_minor+returned_residue_minor=score_pool_minor+overlap_pool_minor)
    OR (policy_key='settled_cubid_redistribution_v2' AND overlap_pool_minor=0 AND cap_multiple BETWEEN 1 AND 10
      AND funded_minor=current_funded_minor+harvested_unclaimed_minor+carry_in_minor
      AND top_up_minor+returned_residue_minor=score_pool_minor+harvested_unclaimed_minor+carry_in_minor)
  )
);

ALTER TABLE public.epoch_allocation_user_awards
  ADD COLUMN policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1',
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN initial_claim_minor numeric(78,0),
  ADD COLUMN top_up_capacity_minor numeric(78,0);
ALTER TABLE public.epoch_allocation_user_awards DROP CONSTRAINT epoch_allocation_award_amounts;
ALTER TABLE public.epoch_allocation_user_awards ADD CONSTRAINT epoch_allocation_award_amounts CHECK(
  aggregate_initial_exact_usd>=0 AND baseline_exact_usd>=0 AND minor_unit_cap>=0
  AND retained_initial_minor>=0 AND top_up_minor>=0 AND final_minor=retained_initial_minor+top_up_minor
  AND (
    (policy_key='settled_cubid_redistribution_v1' AND exact_cap_usd=3*baseline_exact_usd AND final_minor<=minor_unit_cap)
    OR (policy_key='settled_cubid_redistribution_v2' AND cap_multiple BETWEEN 1 AND 10
      AND initial_claim_minor=retained_initial_minor AND initial_claim_minor>=0 AND top_up_capacity_minor>=0
      AND top_up_capacity_minor=greatest(minor_unit_cap-initial_claim_minor,0) AND top_up_minor<=top_up_capacity_minor)
  )
);

ALTER TABLE public.epoch_allocation_source_dispositions
  ALTER COLUMN manifest_source_id DROP NOT NULL,
  ADD COLUMN manifest_pool_source_id bigint REFERENCES public.epoch_allocation_manifest_pool_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1';
ALTER TABLE public.epoch_allocation_source_dispositions DROP CONSTRAINT epoch_allocation_disposition_kind;
ALTER TABLE public.epoch_allocation_source_dispositions DROP CONSTRAINT epoch_allocation_disposition_user_shape;
ALTER TABLE public.epoch_allocation_source_dispositions ADD CONSTRAINT epoch_allocation_disposition_one_source
  CHECK((manifest_source_id IS NOT NULL) <> (manifest_pool_source_id IS NOT NULL));
ALTER TABLE public.epoch_allocation_source_dispositions ADD CONSTRAINT epoch_allocation_disposition_kind CHECK(
  (policy_key='settled_cubid_redistribution_v1' AND disposition_kind IN('initial_retained','score_pool','overlap_pool','top_up','returned_residue'))
  OR (policy_key='settled_cubid_redistribution_v2' AND disposition_kind IN('initial_claim','score_pool','harvested_pool','carryin_pool','top_up','carryout_residue'))
);
ALTER TABLE public.epoch_allocation_source_dispositions ADD CONSTRAINT epoch_allocation_disposition_user_shape CHECK(
  (disposition_kind IN('initial_retained','initial_claim','top_up') AND user_id IS NOT NULL)
  OR (disposition_kind IN('score_pool','overlap_pool','harvested_pool','carryin_pool','returned_residue','carryout_residue') AND user_id IS NULL)
);

CREATE FUNCTION public.epoch_allocation_v2_preview_input(p_cycle_key text,p_cap_multiple numeric,p_environment text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_target public.monthly_cycles%ROWTYPE; v_origin public.monthly_cycles%ROWTYPE;
  v_project_sources jsonb; v_cohort jsonb; v_pool_sources jsonb; v_input jsonb; v_hash text;
BEGIN
  IF NOT public.epoch_allocation_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  IF p_cap_multiple<1 OR p_cap_multiple>10 OR p_cap_multiple<>round(p_cap_multiple,2) THEN
    RAISE EXCEPTION 'epoch_allocation_v2_cap_multiple_invalid'; END IF;
  SELECT * INTO v_target FROM public.monthly_cycles WHERE cycle_key=p_cycle_key;
  SELECT * INTO v_origin FROM public.monthly_cycles WHERE period_start=(v_target.period_start-interval '3 months')::date;
  IF v_target.id IS NULL OR v_origin.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_v2_harvest_epoch_missing'; END IF;
  IF clock_timestamp()<((v_target.period_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles') THEN
    RAISE EXCEPTION 'epoch_allocation_v2_claim_window_open'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sourceLotId',lot.id::text,'sourceLotKey',lot.source_lot_key,'projectId',lot.project_id,'projectKey',project.slug,
    'exactUsd',lot.distributable_exact_usd::text,'minorUnitScale',lot.canonical_minor_unit_scale,
    'sourceOrder',lot.deterministic_source_order::text,'railKey',lot.rail_key,'assetKey',asset.asset_key,
    'custodyKey',custody.custody_key,'nativeAtomicAmount',lot.native_atomic_amount::text,
    'fxSnapshotId',lot.fx_snapshot_id::text,'evidenceHash',lot.evidence_hash
  ) ORDER BY lot.deterministic_source_order,lot.source_lot_key),'[]'::jsonb) INTO v_project_sources
  FROM public.epoch_valuation_source_lots lot
  JOIN public.epoch_project_packages package ON package.id=lot.package_id
  JOIN public.projects project ON project.id=lot.project_id
  JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
  JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id
  WHERE lot.monthly_cycle_id=v_target.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
    AND package.canonical_cycle_id=v_target.id AND package.status IN('approved','silent_approved')
    AND package.funding_status='settled' AND package.compliance_status='passed' AND package.cubid_status='eligible';
  IF jsonb_array_length(v_project_sources)=0 THEN RAISE EXCEPTION 'epoch_allocation_v2_project_sources_missing'; END IF;

  SELECT coalesce(jsonb_agg(row_value ORDER BY (row_value->>'projectId')::bigint,row_value->>'userId'),'[]'::jsonb) INTO v_cohort
  FROM (
    SELECT DISTINCT jsonb_build_object('projectId',lot.project_id,'projectKey',project.slug,'userId',cohort.user_id::text,
      'projectPseudonym',cohort.project_pseudonym,'lockedScore',cohort.locked_cubid_score::text,
      'lockedMaximumScore',cohort.locked_max_cubid_score::text,'cubidEvidenceHash',cohort.evidence_hash) row_value
    FROM public.epoch_valuation_source_lots lot
    JOIN public.epoch_project_packages package ON package.id=lot.package_id
    JOIN public.projects project ON project.id=lot.project_id
    JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
    WHERE lot.monthly_cycle_id=v_target.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND package.canonical_cycle_id=v_target.id AND package.status IN('approved','silent_approved')
  ) rows;

  WITH inventory AS (
    SELECT obligation.id obligation_id,balance.available_minor,lot.id inventory_lot_id,lot.source_fill_id,lot.project_id,lot.rail_key,
      lot.financial_asset_id,lot.custody_account_id,lot.fx_snapshot_id,lot.native_atomic_total,lot.canonical_minor_total,
      lot.deterministic_sequence,fill.exact_usd,
      greatest(0,lot.canonical_minor_total-coalesce((SELECT sum(reserved_minor) FROM public.payout_inventory_reservations reservation
        WHERE reservation.inventory_lot_id=lot.id AND reservation.status IN('reserved','held','consumed')),0)) available_inventory_minor
    FROM public.user_withdrawal_obligations obligation
    JOIN public.user_withdrawal_obligation_balances balance ON balance.id=obligation.id
    JOIN public.payout_inventory_lots lot ON lot.obligation_id=obligation.id
    JOIN public.epoch_provisional_award_source_fills fill ON fill.id=lot.source_fill_id
    WHERE obligation.monthly_cycle_id=v_origin.id AND balance.available_minor>0 AND lot.status IN('available','reserved')
  ), ordered AS (
    SELECT inventory.*,coalesce(sum(available_inventory_minor) OVER(PARTITION BY obligation_id ORDER BY deterministic_sequence DESC,inventory_lot_id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior_newest_minor
    FROM inventory WHERE available_inventory_minor>0
  ), harvested AS (
    SELECT ordered.*,least(available_inventory_minor,greatest(0,available_minor-prior_newest_minor)) harvest_minor
    FROM ordered
  ), candidates AS (
    SELECT jsonb_build_object('sourceLotId','harvest:'||v_target.id::text||':'||harvested.inventory_lot_id::text,
      'sourceLotKey','harvest:'||v_target.cycle_key||':'||harvested.inventory_lot_id::text,'projectId',harvested.project_id,
      'exactUsd',(harvested.exact_usd*harvested.harvest_minor/harvested.canonical_minor_total)::text,'minorUnitScale',2,
      'canonicalMinorCapacity',harvested.harvest_minor::text,
      'sourceOrder',(900000000000000000::numeric+harvested.deterministic_sequence)::text,'railKey',harvested.rail_key,
      'assetKey',asset.asset_key,'custodyKey',custody.custody_key,
      'nativeAtomicAmount',greatest(1,floor(harvested.native_atomic_total*harvested.harvest_minor/harvested.canonical_minor_total))::text,
      'fxSnapshotId',harvested.fx_snapshot_id::text,'evidenceHash',encode(extensions.digest(convert_to(
        'harvest:'||v_target.cycle_key||':'||harvested.inventory_lot_id::text||':'||harvested.harvest_minor::text,'UTF8'),'sha256'),'hex'),
      'originKind','harvested_unclaimed','originCycleKey',v_origin.cycle_key) row_value
    FROM harvested JOIN public.financial_assets asset ON asset.id=harvested.financial_asset_id
    JOIN public.financial_custody_accounts custody ON custody.id=harvested.custody_account_id
    WHERE harvested.harvest_minor>0
    UNION ALL
    SELECT jsonb_build_object('sourceLotId',pool.id::text,'sourceLotKey',pool.source_lot_key,'projectId',pool.project_id,
      'exactUsd',pool.exact_usd::text,'minorUnitScale',pool.minor_unit_scale,'sourceOrder',pool.source_order::text,
      'canonicalMinorCapacity',pool.canonical_minor::text,
      'railKey',pool.rail_key,'assetKey',asset.asset_key,'custodyKey',custody.custody_key,
      'nativeAtomicAmount',pool.native_atomic_amount::text,'fxSnapshotId',pool.fx_snapshot_id::text,'evidenceHash',pool.evidence_hash,
      'originKind','carryforward_residue','originCycleKey',origin.cycle_key) row_value
    FROM public.epoch_redistribution_pool_sources pool
    JOIN public.monthly_cycles origin ON origin.id=pool.origin_monthly_cycle_id
    JOIN public.financial_assets asset ON asset.id=pool.financial_asset_id
    JOIN public.financial_custody_accounts custody ON custody.id=pool.custody_account_id
    WHERE pool.target_monthly_cycle_id=v_target.id AND pool.origin_kind='carryforward_residue' AND pool.state='ready_for_lock'
  ) SELECT coalesce(jsonb_agg(row_value ORDER BY row_value->>'sourceOrder',row_value->>'sourceLotKey'),'[]'::jsonb) INTO v_pool_sources FROM candidates;

  -- Bind deterministic canonical capacities into the preview itself. Current
  -- project sources use largest remainder; harvested and carried sources retain
  -- their already-authoritative canonical obligation/residue amount.
  WITH source_rows AS (
    SELECT item.value row_value,(item.value->>'exactUsd')::numeric*100 exact_minor
    FROM jsonb_array_elements(v_project_sources) AS item(value)
  ), ranked AS (
    SELECT source_rows.*,floor(exact_minor) base_minor,
      row_number() OVER(ORDER BY exact_minor-floor(exact_minor) DESC,row_value->>'sourceLotKey') remainder_rank,
      floor(sum(exact_minor) OVER())-sum(floor(exact_minor)) OVER() residual_units
    FROM source_rows
  ), enriched AS (
    SELECT row_value||jsonb_build_object('canonicalMinorCapacity',
      (base_minor+CASE WHEN remainder_rank<=residual_units THEN 1 ELSE 0 END)::numeric(78,0)::text) row_value
    FROM ranked
  )
  SELECT coalesce(jsonb_agg(row_value ORDER BY row_value->>'sourceOrder',row_value->>'sourceLotKey'),'[]'::jsonb)
  INTO v_project_sources FROM enriched;

  v_input:=jsonb_build_object('policy','settled_cubid_redistribution_v2','cycleKey',v_target.cycle_key,'minorUnitScale',2,
    'capMultiple',to_char(p_cap_multiple,'FM90.00'),'projectSources',v_project_sources,'redistributionSources',v_pool_sources,'cohort',v_cohort);
  v_hash:=encode(extensions.digest(convert_to(v_input::text,'UTF8'),'sha256'),'hex');
  RETURN v_input||jsonb_build_object('inputHash',v_hash,'originCycleKey',v_origin.cycle_key);
END; $$;

CREATE FUNCTION public.lock_funded_epoch_allocation_v2(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle public.monthly_cycles%ROWTYPE; v_preview jsonb; v_manifest jsonb; v_manifest_id bigint; v_hash text;
  v_version integer; v_funded_exact numeric(38,18); v_funded_minor numeric(78,0); v_current_minor numeric(78,0);
  v_harvest_minor numeric(78,0); v_carry_minor numeric(78,0); v_pool jsonb; v_existing public.epoch_allocation_manifests%ROWTYPE;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_lock.v2'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  IF nullif(p_command->>'actorUserId','') IS NULL OR (p_command->>'selectedPreviewHash') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'epoch_allocation_v2_selection_invalid'; END IF;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key=p_command->>'cycleKey' FOR UPDATE;
  IF v_cycle.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_cycle_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-allocation-v2:'||v_cycle.id::text,0));
  SELECT * INTO v_existing FROM public.epoch_allocation_manifests
  WHERE monthly_cycle_id=v_cycle.id AND policy_key='settled_cubid_redistribution_v2' ORDER BY version DESC LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.cap_multiple<>(p_command->>'capMultiple')::numeric
      OR v_existing.selected_preview_hash<>p_command->>'selectedPreviewHash'
    THEN RAISE EXCEPTION 'epoch_allocation_v2_selection_conflict'; END IF;
    RETURN jsonb_build_object('manifestId',v_existing.id,'manifestHash',v_existing.manifest_hash,'manifest',v_existing.manifest);
  END IF;
  v_preview:=public.epoch_allocation_v2_preview_input(v_cycle.cycle_key,(p_command->>'capMultiple')::numeric,p_command->>'deploymentEnvironment');
  IF v_preview->>'inputHash'<>p_command->>'selectedPreviewHash' THEN RAISE EXCEPTION 'epoch_allocation_v2_preview_stale'; END IF;

  -- Serialize claim creation against harvest and recheck the locked obligation
  -- balances before reserving any harvested source.
  PERFORM 1 FROM public.user_withdrawal_obligations obligation
  JOIN public.payout_inventory_lots inventory ON inventory.obligation_id=obligation.id
  WHERE inventory.id IN(
    SELECT split_part(item.value->>'sourceLotId',':',3)::bigint
    FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value)
    WHERE item.value->>'originKind'='harvested_unclaimed'
  ) ORDER BY obligation.id FOR UPDATE OF obligation;
  IF EXISTS(
    SELECT 1 FROM (
      SELECT obligation.id,sum((item.value->>'canonicalMinorCapacity')::numeric) harvest_minor
      FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value)
      JOIN public.payout_inventory_lots inventory ON inventory.id=split_part(item.value->>'sourceLotId',':',3)::bigint
      JOIN public.user_withdrawal_obligations obligation ON obligation.id=inventory.obligation_id
      WHERE item.value->>'originKind'='harvested_unclaimed' GROUP BY obligation.id
    ) expected JOIN public.user_withdrawal_obligation_balances balance ON balance.id=expected.id
    WHERE expected.harvest_minor>balance.available_minor
  ) THEN RAISE EXCEPTION 'epoch_allocation_v2_harvest_balance_changed'; END IF;

  FOR v_pool IN SELECT value FROM jsonb_array_elements(v_preview->'redistributionSources')
  LOOP
    IF v_pool->>'originKind'='harvested_unclaimed' THEN
      INSERT INTO public.epoch_redistribution_pool_sources(source_lot_key,target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,
        origin_obligation_id,origin_inventory_lot_id,origin_award_fill_id,project_id,rail_key,financial_asset_id,custody_account_id,
        fx_snapshot_id,native_atomic_amount,exact_usd,canonical_minor,minor_unit_scale,source_order,evidence_hash)
      SELECT v_pool->>'sourceLotKey',v_cycle.id,obligation.monthly_cycle_id,'harvested_unclaimed',obligation.id,inventory.id,inventory.source_fill_id,
        inventory.project_id,inventory.rail_key,inventory.financial_asset_id,inventory.custody_account_id,inventory.fx_snapshot_id,
        (v_pool->>'nativeAtomicAmount')::numeric,(v_pool->>'exactUsd')::numeric,
        (v_pool->>'canonicalMinorCapacity')::numeric,2,(v_pool->>'sourceOrder')::numeric,v_pool->>'evidenceHash'
      FROM public.payout_inventory_lots inventory JOIN public.user_withdrawal_obligations obligation ON obligation.id=inventory.obligation_id
      WHERE inventory.id=split_part(v_pool->>'sourceLotId',':',3)::bigint
      ON CONFLICT(target_monthly_cycle_id,origin_inventory_lot_id) WHERE origin_kind='harvested_unclaimed' DO NOTHING;
    END IF;
  END LOOP;

  SELECT coalesce(sum((item.value->>'exactUsd')::numeric),0),coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric),0)
  INTO v_funded_exact,v_current_minor FROM jsonb_array_elements(v_preview->'projectSources') AS item(value);
  SELECT coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric) FILTER(WHERE item.value->>'originKind'='harvested_unclaimed'),0),
    coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric) FILTER(WHERE item.value->>'originKind'='carryforward_residue'),0)
  INTO v_harvest_minor,v_carry_minor FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value);
  v_funded_exact:=v_funded_exact+coalesce((SELECT sum((item.value->>'exactUsd')::numeric)
    FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value)),0);
  v_funded_minor:=v_current_minor+v_harvest_minor+v_carry_minor;
  v_manifest:=(v_preview-'inputHash'-'originCycleKey')||jsonb_build_object('selectedPreviewHash',v_preview->>'inputHash');
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  SELECT coalesce(max(version),0)+1 INTO v_version FROM public.epoch_allocation_manifests WHERE monthly_cycle_id=v_cycle.id;
  INSERT INTO public.epoch_allocation_manifests(monthly_cycle_id,version,policy_key,minor_unit_scale,funded_exact_usd,funded_minor,
    manifest,manifest_hash,actor_user_id,deployment_environment,cap_multiple,selected_preview_hash,current_funded_minor,
    harvested_unclaimed_minor,carry_in_minor)
  VALUES(v_cycle.id,v_version,'settled_cubid_redistribution_v2',2,v_funded_exact,v_funded_minor,v_manifest,v_hash,
    (p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment'),(p_command->>'capMultiple')::numeric,
    v_preview->>'inputHash',v_current_minor,v_harvest_minor,v_carry_minor) RETURNING id INTO v_manifest_id;

  INSERT INTO public.epoch_allocation_manifest_sources(manifest_id,source_lot_id,source_lot_key,project_id,source_position,rail_key,
    financial_asset_id,custody_account_id,native_atomic_amount,fx_snapshot_id,exact_usd,canonical_minor_capacity,source_order,evidence_hash)
  SELECT v_manifest_id,lot.id,lot.source_lot_key,lot.project_id,lot.source_position,lot.rail_key,lot.financial_asset_id,lot.custody_account_id,
    lot.native_atomic_amount,lot.fx_snapshot_id,lot.distributable_exact_usd,(item.value->>'canonicalMinorCapacity')::numeric,
    lot.deterministic_source_order,lot.evidence_hash
  FROM jsonb_array_elements(v_preview->'projectSources') AS item(value)
  JOIN public.epoch_valuation_source_lots lot ON lot.source_lot_key=item.value->>'sourceLotKey';
  INSERT INTO public.epoch_allocation_manifest_cohort(manifest_id,project_id,user_id,project_pseudonym,locked_cubid_score,locked_max_cubid_score,cubid_evidence_hash)
  SELECT v_manifest_id,(item.value->>'projectId')::bigint,(item.value->>'userId')::uuid,item.value->>'projectPseudonym',
    (item.value->>'lockedScore')::numeric,(item.value->>'lockedMaximumScore')::numeric,item.value->>'cubidEvidenceHash'
  FROM jsonb_array_elements(v_preview->'cohort') AS item(value);
  INSERT INTO public.epoch_allocation_manifest_pool_sources(manifest_id,pool_source_id,source_lot_key,project_id,origin_kind,origin_cycle_key,
    rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,native_atomic_amount,exact_usd,canonical_minor_capacity,source_order,evidence_hash)
  SELECT v_manifest_id,pool.id,pool.source_lot_key,pool.project_id,pool.origin_kind,origin.cycle_key,pool.rail_key,pool.financial_asset_id,
    pool.custody_account_id,pool.fx_snapshot_id,pool.native_atomic_amount,pool.exact_usd,pool.canonical_minor,pool.source_order,pool.evidence_hash
  FROM public.epoch_redistribution_pool_sources pool JOIN public.monthly_cycles origin ON origin.id=pool.origin_monthly_cycle_id
  WHERE pool.source_lot_key IN(SELECT item.value->>'sourceLotKey'
    FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value));

  UPDATE public.epoch_valuation_source_lots SET state='reserved',reserved_exact_usd=distributable_exact_usd
  WHERE id IN(SELECT source_lot_id FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id);
  UPDATE public.epoch_redistribution_pool_sources SET state='reserved'
  WHERE id IN(SELECT pool_source_id FROM public.epoch_allocation_manifest_pool_sources WHERE manifest_id=v_manifest_id);
  WITH harvested AS (
    SELECT source.origin_obligation_id,sum(source.canonical_minor) amount
    FROM public.epoch_redistribution_pool_sources source
    JOIN public.epoch_allocation_manifest_pool_sources manifest_source ON manifest_source.pool_source_id=source.id
    WHERE manifest_source.manifest_id=v_manifest_id AND source.origin_kind='harvested_unclaimed'
    GROUP BY source.origin_obligation_id
  ) UPDATE public.user_withdrawal_obligations obligation
    SET harvested_minor=obligation.harvested_minor+harvested.amount,claim_window_closed_at=clock_timestamp()
  FROM harvested WHERE obligation.id=harvested.origin_obligation_id;
  RETURN jsonb_build_object('manifestId',v_manifest_id,'manifestHash',v_hash,'manifest',v_manifest);
END; $$;

CREATE FUNCTION public.record_funded_epoch_allocation_v2(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_manifest public.epoch_allocation_manifests%ROWTYPE; v_artifact jsonb:=p_command->'artifact'; v_run_id bigint;
  v_existing public.epoch_allocation_runs%ROWTYPE; v_user jsonb; v_row jsonb; v_position integer:=0; v_next_cycle bigint;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_result.v2'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  SELECT * INTO v_manifest FROM public.epoch_allocation_manifests WHERE id=(p_command->>'manifestId')::bigint FOR UPDATE;
  IF v_manifest.policy_key<>'settled_cubid_redistribution_v2' OR v_manifest.status<>'locked' THEN RAISE EXCEPTION 'epoch_allocation_v2_manifest_not_locked'; END IF;
  SELECT * INTO v_existing FROM public.epoch_allocation_runs WHERE manifest_id=v_manifest.id;
  IF FOUND THEN
    IF v_existing.result_hash<>p_command->>'resultHash' THEN RAISE EXCEPTION 'epoch_allocation_result_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  IF v_artifact->>'policy'<>'settled_cubid_redistribution_v2' OR v_artifact->>'manifestHash'<>v_manifest.manifest_hash
    OR v_artifact->>'selectedPreviewHash'<>v_manifest.selected_preview_hash OR (v_artifact->>'capMultiple')::numeric<>v_manifest.cap_multiple
    OR v_artifact->>'resultHash'<>p_command->>'resultHash'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_artifact->'invariantChecks') check_row WHERE NOT (check_row->>'ok')::boolean)
  THEN RAISE EXCEPTION 'epoch_allocation_v2_artifact_invalid'; END IF;
  INSERT INTO public.epoch_allocation_runs(manifest_id,policy_key,result_hash,artifact,funded_minor,retained_initial_minor,score_pool_minor,
    overlap_pool_minor,top_up_minor,returned_residue_minor,final_allocation_minor,actor_user_id,deployment_environment,cap_multiple,
    current_funded_minor,harvested_unclaimed_minor,carry_in_minor)
  VALUES(v_manifest.id,'settled_cubid_redistribution_v2',p_command->>'resultHash',v_artifact,
    (v_artifact->'totals'->>'totalInputMinor')::numeric,(v_artifact->'totals'->>'initialClaimMinor')::numeric,
    (v_artifact->'totals'->>'scorePoolMinor')::numeric,0,(v_artifact->'totals'->>'topUpMinor')::numeric,
    (v_artifact->'totals'->>'carryOutResidueMinor')::numeric,(v_artifact->'totals'->>'finalAllocationMinor')::numeric,
    (p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment'),v_manifest.cap_multiple,
    (v_artifact->'totals'->>'currentFundedMinor')::numeric,(v_artifact->'totals'->>'harvestedUnclaimedMinor')::numeric,
    (v_artifact->'totals'->>'carryInMinor')::numeric) RETURNING id INTO v_run_id;
  FOR v_user IN SELECT value FROM jsonb_array_elements(v_artifact->'users') LOOP
    INSERT INTO public.epoch_allocation_user_awards(run_id,user_id,aggregate_initial_exact_usd,baseline_exact_usd,exact_cap_usd,
      minor_unit_cap,retained_initial_minor,top_up_minor,final_minor,project_claims,policy_key,cap_multiple,initial_claim_minor,top_up_capacity_minor)
    VALUES(v_run_id,(v_user->>'userId')::uuid,(v_user->>'aggregateInitialExactUsd')::numeric,(v_user->>'baselineExactUsd')::numeric,
      (v_user->>'redistributionCeilingExactUsd')::numeric,(v_user->>'redistributionCeilingMinor')::numeric,
      (v_user->>'initialClaimMinor')::numeric,(v_user->>'topUpMinor')::numeric,(v_user->>'finalMinor')::numeric,v_user->'projectClaims',
      'settled_cubid_redistribution_v2',v_manifest.cap_multiple,(v_user->>'initialClaimMinor')::numeric,(v_user->>'topUpCapacityMinor')::numeric);
  END LOOP;
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_artifact->'sourceDispositions') LOOP
    v_position:=v_position+1;
    INSERT INTO public.epoch_allocation_source_dispositions(run_id,manifest_source_id,manifest_pool_source_id,user_id,disposition_kind,
      canonical_minor,exact_usd,stable_position,policy_key)
    SELECT v_run_id,project_source.id,NULL,nullif(v_row->>'userId','')::uuid,v_row->>'kind',(v_row->>'canonicalMinor')::numeric,
      (v_row->>'exactUsd')::numeric,v_position,'settled_cubid_redistribution_v2'
    FROM public.epoch_allocation_manifest_sources project_source
    WHERE project_source.manifest_id=v_manifest.id AND project_source.source_lot_key=v_row->>'sourceLotKey'
    UNION ALL
    SELECT v_run_id,NULL,pool_source.id,nullif(v_row->>'userId','')::uuid,v_row->>'kind',(v_row->>'canonicalMinor')::numeric,
      (v_row->>'exactUsd')::numeric,v_position,'settled_cubid_redistribution_v2'
    FROM public.epoch_allocation_manifest_pool_sources pool_source
    WHERE pool_source.manifest_id=v_manifest.id AND pool_source.source_lot_key=v_row->>'sourceLotKey';
    IF NOT FOUND THEN RAISE EXCEPTION 'epoch_allocation_v2_source_unknown'; END IF;
  END LOOP;
  SELECT id INTO v_next_cycle FROM public.monthly_cycles WHERE period_start>(SELECT period_start FROM public.monthly_cycles WHERE id=v_manifest.monthly_cycle_id)
  ORDER BY period_start LIMIT 1;
  IF EXISTS(SELECT 1 FROM public.epoch_allocation_source_dispositions WHERE run_id=v_run_id AND disposition_kind='carryout_residue') AND v_next_cycle IS NULL
  THEN RAISE EXCEPTION 'epoch_allocation_v2_carry_target_missing'; END IF;
  INSERT INTO public.epoch_redistribution_pool_sources(source_lot_key,target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,
    predecessor_pool_source_id,origin_disposition_id,project_id,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,native_atomic_amount,
    exact_usd,canonical_minor,minor_unit_scale,source_order,evidence_hash)
  SELECT 'carry:'||v_next_cycle::text||':'||disposition.id::text,v_next_cycle,v_manifest.monthly_cycle_id,'carryforward_residue',
    manifest_pool.pool_source_id,disposition.id,coalesce(project_source.project_id,manifest_pool.project_id),coalesce(project_source.rail_key,manifest_pool.rail_key),
    coalesce(project_source.financial_asset_id,manifest_pool.financial_asset_id),coalesce(project_source.custody_account_id,manifest_pool.custody_account_id),
    coalesce(project_source.fx_snapshot_id,manifest_pool.fx_snapshot_id),greatest(1,floor(coalesce(project_source.native_atomic_amount,manifest_pool.native_atomic_amount)
      *disposition.canonical_minor/greatest(1,coalesce(project_source.canonical_minor_capacity,manifest_pool.canonical_minor_capacity)))),
    disposition.exact_usd,disposition.canonical_minor,2,900000000000000000::numeric+disposition.stable_position,
    encode(extensions.digest(convert_to('carry:'||v_run_id::text||':'||disposition.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_allocation_source_dispositions disposition
  LEFT JOIN public.epoch_allocation_manifest_sources project_source ON project_source.id=disposition.manifest_source_id
  LEFT JOIN public.epoch_allocation_manifest_pool_sources manifest_pool ON manifest_pool.id=disposition.manifest_pool_source_id
  WHERE disposition.run_id=v_run_id AND disposition.disposition_kind='carryout_residue' AND disposition.exact_usd>0;
  UPDATE public.epoch_allocation_manifests SET status='calculated',calculated_at=clock_timestamp() WHERE id=v_manifest.id;
  RETURN v_run_id;
END; $$;

CREATE VIEW public.epoch_allocation_operator_view_v2 WITH(security_invoker=true) AS
SELECT cycle.cycle_key,manifest.id manifest_id,manifest.status,manifest.manifest_hash,manifest.selected_preview_hash,manifest.cap_multiple,
  manifest.current_funded_minor,manifest.harvested_unclaimed_minor,manifest.carry_in_minor,manifest.funded_minor,
  run.id run_id,run.result_hash,run.retained_initial_minor initial_claim_minor,run.score_pool_minor,run.top_up_minor,
  run.returned_residue_minor carry_out_residue_minor,run.final_allocation_minor,count(award.id) user_count,
  bool_and(NOT manifest.production_enabled AND (run.id IS NULL OR NOT run.production_enabled)) provisional_only,
  manifest.locked_at,manifest.calculated_at
FROM public.epoch_allocation_manifests manifest JOIN public.monthly_cycles cycle ON cycle.id=manifest.monthly_cycle_id
LEFT JOIN public.epoch_allocation_runs run ON run.manifest_id=manifest.id
LEFT JOIN public.epoch_allocation_user_awards award ON award.run_id=run.id
WHERE manifest.policy_key='settled_cubid_redistribution_v2'
GROUP BY cycle.cycle_key,manifest.id,run.id;

ALTER TABLE public.epoch_redistribution_pool_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_allocation_manifest_pool_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.epoch_redistribution_pool_sources,public.epoch_allocation_manifest_pool_sources,
  public.epoch_allocation_operator_view_v2 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_redistribution_pool_sources,public.epoch_allocation_manifest_pool_sources,
  public.epoch_allocation_operator_view_v2 TO service_role;
REVOKE ALL ON FUNCTION public.epoch_allocation_v2_preview_input(text,numeric,text),public.lock_funded_epoch_allocation_v2(jsonb),
  public.record_funded_epoch_allocation_v2(jsonb),public.prevent_harvested_obligation_claim() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.epoch_allocation_v2_preview_input(text,numeric,text),public.lock_funded_epoch_allocation_v2(jsonb),
  public.record_funded_epoch_allocation_v2(jsonb) TO service_role;

ALTER TABLE public.epoch_provisional_award_controls
  ADD COLUMN policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1',
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN initial_claim_minor numeric(78,0),
  ADD COLUMN redistribution_ceiling_minor numeric(78,0);
ALTER TABLE public.epoch_provisional_award_controls DROP CONSTRAINT epoch_provisional_award_amounts;
ALTER TABLE public.epoch_provisional_award_controls ADD CONSTRAINT epoch_provisional_award_amounts CHECK(
  retained_initial_minor>=0 AND redistribution_top_up_minor>=0
  AND final_award_minor=retained_initial_minor+redistribution_top_up_minor
  AND (
    (policy_key='settled_cubid_redistribution_v1' AND final_award_minor<=minor_unit_cap)
    OR (policy_key='settled_cubid_redistribution_v2' AND cap_multiple BETWEEN 1 AND 10
      AND initial_claim_minor=retained_initial_minor AND redistribution_ceiling_minor=minor_unit_cap
      AND redistribution_top_up_minor<=greatest(redistribution_ceiling_minor-initial_claim_minor,0))
  )
);

ALTER TABLE public.epoch_provisional_award_source_fills
  ALTER COLUMN manifest_source_id DROP NOT NULL,
  ADD COLUMN manifest_pool_source_id bigint REFERENCES public.epoch_allocation_manifest_pool_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1';
ALTER TABLE public.epoch_provisional_award_source_fills DROP CONSTRAINT epoch_award_source_fill_kind;
ALTER TABLE public.epoch_provisional_award_source_fills DROP CONSTRAINT epoch_award_source_fill_shape;
ALTER TABLE public.epoch_provisional_award_source_fills ADD CONSTRAINT epoch_award_source_fill_one_source
  CHECK((manifest_source_id IS NOT NULL) <> (manifest_pool_source_id IS NOT NULL));
ALTER TABLE public.epoch_provisional_award_source_fills ADD CONSTRAINT epoch_award_source_fill_kind CHECK(
  (policy_key='settled_cubid_redistribution_v1' AND fill_kind IN('initial_retained','top_up','returned_residue'))
  OR (policy_key='settled_cubid_redistribution_v2' AND fill_kind IN('initial_claim','top_up','carryout_residue'))
);
ALTER TABLE public.epoch_provisional_award_source_fills ADD CONSTRAINT epoch_award_source_fill_shape CHECK(
  (fill_kind IN('initial_retained','initial_claim','top_up') AND award_control_id IS NOT NULL AND user_id IS NOT NULL)
  OR (fill_kind IN('returned_residue','carryout_residue') AND award_control_id IS NULL AND user_id IS NULL)
);

ALTER TABLE public.epoch_close_project_summaries
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN harvested_unclaimed_minor numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE public.epoch_close_packages
  ADD COLUMN policy_key text NOT NULL DEFAULT 'settled_cubid_redistribution_v1',
  ADD COLUMN cap_multiple numeric(4,2),
  ADD COLUMN current_funded_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN harvested_unclaimed_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN carry_in_minor numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE public.epoch_close_packages DROP CONSTRAINT epoch_close_package_amounts;
ALTER TABLE public.epoch_close_packages ADD CONSTRAINT epoch_close_package_amounts CHECK(
  user_count>=0 AND funded_minor>=0 AND final_allocation_minor>=0 AND redistribution_pool_minor>=0
  AND top_up_minor>=0 AND returned_residue_minor>=0 AND final_allocation_minor+returned_residue_minor=funded_minor
  AND top_up_minor+returned_residue_minor=redistribution_pool_minor
  AND (policy_key='settled_cubid_redistribution_v1' OR (policy_key='settled_cubid_redistribution_v2'
    AND cap_multiple BETWEEN 1 AND 10 AND funded_minor=current_funded_minor+harvested_unclaimed_minor+carry_in_minor))
);

CREATE FUNCTION public.approve_epoch_allocation_close_v2(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_run public.epoch_allocation_runs%ROWTYPE; v_manifest public.epoch_allocation_manifests%ROWTYPE;
  v_cycle public.monthly_cycles%ROWTYPE; v_state public.epoch_shadow_states%ROWTYPE; v_period public.accounting_periods%ROWTYPE;
  v_approval public.epoch_allocation_approvals%ROWTYPE; v_existing public.epoch_close_packages%ROWTYPE; v_disposition record;
  v_award_control_id bigint; v_ledger_id bigint; v_close_id bigint; v_artifact record; v_hash text; v_root_hash text;
  v_environment text:=lower(p_command->>'deploymentEnvironment');
BEGIN
  IF p_command->>'contractVersion'<>'epoch_allocation_close.v2' OR NOT public.epoch_close_runtime_enabled(v_environment)
    OR nullif(p_command->>'actorUserId','') IS NULL THEN RAISE EXCEPTION 'epoch_close_runtime_disabled'; END IF;
  SELECT * INTO v_run FROM public.epoch_allocation_runs WHERE id=(p_command->>'runId')::bigint FOR UPDATE;
  SELECT * INTO v_manifest FROM public.epoch_allocation_manifests WHERE id=v_run.manifest_id FOR UPDATE;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id=v_manifest.monthly_cycle_id;
  IF v_run.policy_key<>'settled_cubid_redistribution_v2' OR v_manifest.policy_key<>v_run.policy_key OR v_manifest.status<>'calculated'
    OR v_manifest.manifest_hash<>p_command->>'manifestHash' OR v_run.result_hash<>p_command->>'resultHash'
    OR v_run.result_hash<>p_command->>'rerunResultHash' OR v_run.production_enabled THEN RAISE EXCEPTION 'epoch_close_approved_result_mismatch'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-close-v2:'||v_run.id::text,0));
  SELECT package.* INTO v_existing FROM public.epoch_close_packages package
  JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id WHERE approval.run_id=v_run.id;
  IF FOUND THEN RETURN jsonb_build_object('closePackageId',v_existing.id,'rootHash',v_existing.root_hash,'status',v_existing.status); END IF;
  SELECT state.* INTO v_state FROM public.epoch_shadow_states state WHERE state.monthly_cycle_id=v_cycle.id FOR UPDATE;
  SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_state.accounting_period_id;
  IF v_state.id IS NULL OR v_state.current_stage<>'reviewing' OR v_state.is_paused OR v_state.production_enabled
    OR v_period.status<>'open' OR v_period.production_enabled THEN RAISE EXCEPTION 'epoch_close_state_not_reviewing'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_sources source
    LEFT JOIN public.epoch_allocation_source_dispositions disposition ON disposition.manifest_source_id=source.id
      AND disposition.run_id=v_run.id AND disposition.disposition_kind IN('initial_claim','top_up','carryout_residue')
    WHERE source.manifest_id=v_manifest.id GROUP BY source.id,source.exact_usd
    HAVING coalesce(sum(disposition.exact_usd),0)<>source.exact_usd
  ) OR EXISTS(
    SELECT 1 FROM public.epoch_allocation_manifest_pool_sources source
    LEFT JOIN public.epoch_allocation_source_dispositions disposition ON disposition.manifest_pool_source_id=source.id
      AND disposition.run_id=v_run.id AND disposition.disposition_kind IN('top_up','carryout_residue')
    WHERE source.manifest_id=v_manifest.id GROUP BY source.id,source.exact_usd
    HAVING coalesce(sum(disposition.exact_usd),0)<>source.exact_usd
  ) THEN RAISE EXCEPTION 'epoch_close_exact_source_conservation_failed'; END IF;

  INSERT INTO public.epoch_allocation_approvals(run_id,manifest_hash,result_hash,rerun_result_hash,actor_user_id,deployment_environment)
  VALUES(v_run.id,v_manifest.manifest_hash,v_run.result_hash,p_command->>'rerunResultHash',(p_command->>'actorUserId')::uuid,v_environment)
  RETURNING * INTO v_approval;
  INSERT INTO public.epoch_provisional_award_controls(approval_id,run_award_id,monthly_cycle_id,user_id,retained_initial_minor,
    redistribution_top_up_minor,final_award_minor,minor_unit_cap,approved_result_hash,policy_key,cap_multiple,initial_claim_minor,
    redistribution_ceiling_minor)
  SELECT v_approval.id,award.id,v_cycle.id,award.user_id,award.initial_claim_minor,award.top_up_minor,award.final_minor,
    award.minor_unit_cap,v_run.result_hash,v_run.policy_key,v_run.cap_multiple,award.initial_claim_minor,award.minor_unit_cap
  FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id;

  FOR v_disposition IN
    SELECT disposition.*,coalesce(project_source.project_id,pool_source.project_id) project_id,
      coalesce(project_source.source_lot_key,pool_source.source_lot_key) source_lot_key
    FROM public.epoch_allocation_source_dispositions disposition
    LEFT JOIN public.epoch_allocation_manifest_sources project_source ON project_source.id=disposition.manifest_source_id
    LEFT JOIN public.epoch_allocation_manifest_pool_sources pool_source ON pool_source.id=disposition.manifest_pool_source_id
    WHERE disposition.run_id=v_run.id AND disposition.disposition_kind IN('initial_claim','top_up','carryout_residue')
      AND disposition.exact_usd>0 ORDER BY disposition.stable_position,disposition.id
  LOOP
    v_award_control_id:=NULL;
    IF v_disposition.user_id IS NOT NULL THEN SELECT id INTO v_award_control_id FROM public.epoch_provisional_award_controls
      WHERE approval_id=v_approval.id AND user_id=v_disposition.user_id; END IF;
    v_hash:=encode(extensions.digest(convert_to(v_run.result_hash||':'||v_disposition.id::text||':'||v_disposition.disposition_kind,'UTF8'),'sha256'),'hex');
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
      'idempotencyKey','epoch-close-v2:'||v_run.id::text||':disposition:'||v_disposition.id::text,
      'periodKey',v_period.period_key,'transactionType',CASE WHEN v_disposition.disposition_kind='carryout_residue'
        THEN 'epoch_returned_residue' ELSE 'epoch_provisional_award' END,'evidenceHash',v_hash,'actorType','operator',
      'actorUserId',p_command->>'actorUserId','effectiveAt',v_period.starts_at,
      'postings',CASE WHEN v_disposition.disposition_kind='carryout_residue' THEN jsonb_build_array(
        jsonb_build_object('accountKey','epoch_returned_residue_control','side','debit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id)
      ) ELSE jsonb_build_array(
        jsonb_build_object('accountKey','epoch_provisional_award_control','side','debit','functionalUsdAmount',v_disposition.exact_usd::text,'userId',v_disposition.user_id),
        jsonb_build_object('accountKey','epoch_allocated_source_control','side','credit','functionalUsdAmount',v_disposition.exact_usd::text,'projectId',v_disposition.project_id)
      ) END));
    INSERT INTO public.epoch_provisional_award_source_fills(award_control_id,approval_id,manifest_source_id,manifest_pool_source_id,
      disposition_id,project_id,user_id,fill_kind,canonical_minor,exact_usd,ledger_transaction_id,policy_key)
    VALUES(v_award_control_id,v_approval.id,v_disposition.manifest_source_id,v_disposition.manifest_pool_source_id,v_disposition.id,
      v_disposition.project_id,v_disposition.user_id,v_disposition.disposition_kind,v_disposition.canonical_minor,v_disposition.exact_usd,
      v_ledger_id,'settled_cubid_redistribution_v2');
  END LOOP;

  INSERT INTO public.epoch_close_project_summaries(approval_id,monthly_cycle_id,project_id,funded_minor,cohort_count,
    theoretical_share_exact_usd,initial_claim_exact_usd,score_pool_contribution_exact_usd,source_count,cap_multiple,harvested_unclaimed_minor)
  SELECT v_approval.id,v_cycle.id,project.id,
    coalesce((SELECT sum(source.canonical_minor_capacity) FROM public.epoch_allocation_manifest_sources source
      WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id),0),
    (SELECT count(*) FROM public.epoch_allocation_manifest_cohort cohort WHERE cohort.manifest_id=v_manifest.id AND cohort.project_id=project.id),
    coalesce((SELECT sum((claim->>'theoreticalShareExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    coalesce((SELECT sum((claim->>'initialClaimExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    coalesce((SELECT sum((claim->>'scorePoolContributionExactUsd')::numeric) FROM public.epoch_allocation_user_awards award,
      jsonb_array_elements(award.project_claims) claim WHERE award.run_id=v_run.id AND (claim->>'projectId')::bigint=project.id),0),
    (SELECT count(*) FROM public.epoch_allocation_manifest_sources source WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id),
    v_run.cap_multiple,v_run.harvested_unclaimed_minor
  FROM public.projects project WHERE EXISTS(SELECT 1 FROM public.epoch_allocation_manifest_sources source
    WHERE source.manifest_id=v_manifest.id AND source.project_id=project.id);

  INSERT INTO public.epoch_close_packages(approval_id,monthly_cycle_id,shadow_state_id,manifest_hash,result_hash,root_hash,status,user_count,
    funded_minor,final_allocation_minor,redistribution_pool_minor,top_up_minor,returned_residue_minor,policy_key,cap_multiple,
    current_funded_minor,harvested_unclaimed_minor,carry_in_minor)
  VALUES(v_approval.id,v_cycle.id,v_state.id,v_manifest.manifest_hash,v_run.result_hash,repeat('0',64),'root_review_required',
    (SELECT count(*) FROM public.epoch_provisional_award_controls WHERE approval_id=v_approval.id),v_run.funded_minor,v_run.final_allocation_minor,
    v_run.score_pool_minor+v_run.harvested_unclaimed_minor+v_run.carry_in_minor,v_run.top_up_minor,v_run.returned_residue_minor,
    v_run.policy_key,v_run.cap_multiple,v_run.current_funded_minor,v_run.harvested_unclaimed_minor,v_run.carry_in_minor) RETURNING id INTO v_close_id;

  FOR v_artifact IN SELECT * FROM (VALUES
    ('trial_balance','operator',jsonb_build_object('runId',v_run.id,'provisionalOnly',true)),
    ('custody','operator',jsonb_build_object('manifestHash',v_manifest.manifest_hash,'sourceCount',
      (SELECT count(*) FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest.id),
      'poolSourceCount',(SELECT count(*) FROM public.epoch_allocation_manifest_pool_sources WHERE manifest_id=v_manifest.id))),
    ('project_funds','project_aggregate',(SELECT coalesce(jsonb_agg(to_jsonb(summary)-'id'-'approval_id'-'created_at' ORDER BY summary.project_id),'[]'::jsonb)
      FROM public.epoch_close_project_summaries summary WHERE summary.approval_id=v_approval.id)),
    ('fees','operator',jsonb_build_object('currentFundedMinor',v_run.current_funded_minor::text)),
    ('fx','operator',jsonb_build_object('manifestHash',v_manifest.manifest_hash)),
    ('carryover','operator',jsonb_build_object('carryInMinor',v_run.carry_in_minor::text,'carryOutMinor',v_run.returned_residue_minor::text)),
    ('initial_claims','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,
      'initialClaimMinor',award.initial_claim_minor::text,'redistributionCeilingMinor',award.minor_unit_cap::text) ORDER BY award.user_id),'[]'::jsonb)
      FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('redistribution_pool','public_aggregate',jsonb_build_object('capMultiple',to_char(v_run.cap_multiple,'FM90.00'),
      'scorePoolMinor',v_run.score_pool_minor::text,'harvestedUnclaimedMinor',v_run.harvested_unclaimed_minor::text,
      'carryInMinor',v_run.carry_in_minor::text,'poolMinor',(v_run.score_pool_minor+v_run.harvested_unclaimed_minor+v_run.carry_in_minor)::text)),
    ('top_ups','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',award.user_id,'topUpMinor',award.top_up_minor::text)
      ORDER BY award.user_id),'[]'::jsonb) FROM public.epoch_allocation_user_awards award WHERE award.run_id=v_run.id)),
    ('returned_residue','operator',jsonb_build_object('carryOutResidueMinor',v_run.returned_residue_minor::text)),
    ('provisional_awards','user_private',(SELECT coalesce(jsonb_agg(jsonb_build_object('userId',control.user_id,
      'finalAwardMinor',control.final_award_minor::text,'capMultiple',to_char(control.cap_multiple,'FM90.00')) ORDER BY control.user_id),'[]'::jsonb)
      FROM public.epoch_provisional_award_controls control WHERE control.approval_id=v_approval.id)),
    ('exceptions','operator',jsonb_build_object('overlapPoolMinor','0','productionValueFlow',false))
  ) artifact_rows(artifact_key,audience,artifact)
  LOOP
    v_hash:=encode(extensions.digest(convert_to(v_artifact.artifact::text,'UTF8'),'sha256'),'hex');
    INSERT INTO public.epoch_close_artifacts(close_package_id,artifact_key,audience,artifact,artifact_hash)
    VALUES(v_close_id,v_artifact.artifact_key,v_artifact.audience,v_artifact.artifact,v_hash);
  END LOOP;
  SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object('artifactKey',artifact_key,'artifactHash',artifact_hash)
    ORDER BY artifact_key),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') INTO v_root_hash
  FROM public.epoch_close_artifacts WHERE close_package_id=v_close_id;
  UPDATE public.epoch_close_packages SET root_hash=v_root_hash WHERE id=v_close_id;
  RETURN jsonb_build_object('closePackageId',v_close_id,'approvalId',v_approval.id,'rootHash',v_root_hash,'status','root_review_required');
END; $$;

CREATE OR REPLACE VIEW public.epoch_close_operator_view WITH(security_invoker=true) AS
SELECT cycle.cycle_key,package.id close_package_id,package.status,package.root_hash,package.manifest_hash,package.result_hash,
  package.user_count,package.funded_minor,package.final_allocation_minor,package.redistribution_pool_minor,package.top_up_minor,
  package.returned_residue_minor,approval.actor_user_id,approval.approved_at,
  count(artifact.id) artifact_count,bool_and(NOT package.production_enabled) provisional_only,root_approval.approved_at root_approved_at,
  package.policy_key,package.cap_multiple,package.current_funded_minor,package.harvested_unclaimed_minor,package.carry_in_minor
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
JOIN public.epoch_allocation_approvals approval ON approval.id=package.approval_id
LEFT JOIN public.epoch_close_root_approvals root_approval ON root_approval.close_package_id=package.id
LEFT JOIN public.epoch_close_artifacts artifact ON artifact.close_package_id=package.id
GROUP BY cycle.cycle_key,package.id,approval.id,root_approval.id;

CREATE OR REPLACE VIEW public.epoch_close_public_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,package.status,
  CASE WHEN package.user_count>=3 THEN package.root_hash ELSE NULL END root_hash,
  CASE WHEN package.user_count>=3 THEN package.funded_minor ELSE NULL END::numeric(78,0) funded_minor,
  CASE WHEN package.user_count>=3 THEN package.final_allocation_minor ELSE NULL END::numeric(78,0) final_allocation_minor,
  CASE WHEN package.user_count>=3 THEN package.redistribution_pool_minor ELSE NULL END::numeric(78,0) redistribution_pool_minor,
  CASE WHEN package.user_count>=3 THEN package.top_up_minor ELSE NULL END::numeric(78,0) top_up_minor,
  CASE WHEN package.user_count>=3 THEN package.returned_residue_minor ELSE NULL END::numeric(78,0) returned_residue_minor,
  CASE WHEN package.user_count>=3 THEN package.user_count ELSE NULL END published_user_count,package.created_at,
  CASE WHEN package.user_count>=3 THEN package.cap_multiple ELSE NULL END cap_multiple,
  CASE WHEN package.user_count>=3 THEN package.harvested_unclaimed_minor ELSE NULL END::numeric(78,0) harvested_unclaimed_minor
FROM public.epoch_close_packages package JOIN public.monthly_cycles cycle ON cycle.id=package.monthly_cycle_id
WHERE NOT package.production_enabled AND package.status='payout_readying';

CREATE OR REPLACE VIEW public.epoch_close_public_project_view WITH(security_barrier=true) AS
SELECT cycle.cycle_key,project.slug project_slug,
  CASE WHEN summary.cohort_count>=3 THEN package.root_hash ELSE NULL END root_hash,package.status,
  CASE WHEN summary.cohort_count>=3 THEN summary.funded_minor ELSE NULL END::numeric(78,0) funded_minor,
  CASE WHEN summary.cohort_count>=3 THEN summary.cohort_count ELSE NULL END published_cohort_count,
  CASE WHEN summary.cohort_count>=3 THEN summary.source_count ELSE NULL END source_count,package.created_at,
  CASE WHEN summary.cohort_count>=3 THEN summary.cap_multiple ELSE NULL END cap_multiple,
  CASE WHEN summary.cohort_count>=3 THEN summary.harvested_unclaimed_minor ELSE NULL END::numeric(78,0) harvested_unclaimed_minor
FROM public.epoch_close_project_summaries summary
JOIN public.epoch_close_packages package ON package.approval_id=summary.approval_id
JOIN public.monthly_cycles cycle ON cycle.id=summary.monthly_cycle_id
JOIN public.projects project ON project.id=summary.project_id
WHERE NOT package.production_enabled AND package.status='payout_readying';

CREATE OR REPLACE FUNCTION public.read_epoch_close_scope(p_actor_user_id uuid,p_scope text,p_cycle_key text,p_project_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle_id bigint; v_result jsonb;
BEGIN
  SELECT id INTO v_cycle_id FROM public.monthly_cycles WHERE cycle_key=p_cycle_key;
  IF p_scope='user' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('cycleKey',p_cycle_key,'rootHash',package.root_hash,'status',package.status,
      'initialClaimMinor',control.initial_claim_minor::text,'topUpMinor',control.redistribution_top_up_minor::text,
      'finalAwardMinor',control.final_award_minor::text,'redistributionCeilingMinor',control.redistribution_ceiling_minor::text,
      'capMultiple',to_char(control.cap_multiple,'FM90.00'),'harvestedUnclaimedMinor',package.harvested_unclaimed_minor::text,
      'payableStatus',control.payable_status,'ownershipStatus',control.ownership_status,'assetEligibilityStatus',control.asset_eligibility_status)),'[]'::jsonb)
    INTO v_result FROM public.epoch_provisional_award_controls control
    JOIN public.epoch_allocation_approvals approval ON approval.id=control.approval_id
    JOIN public.epoch_close_packages package ON package.approval_id=approval.id
    WHERE control.monthly_cycle_id=v_cycle_id AND control.user_id=p_actor_user_id;
  ELSIF p_scope='project' THEN
    IF p_project_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.participants participant
      WHERE participant.project_id=p_project_id AND participant.user_id=p_actor_user_id AND participant.is_admin)
    THEN RAISE EXCEPTION 'epoch_close_project_forbidden'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('cycleKey',p_cycle_key,'projectId',summary.project_id,'rootHash',package.root_hash,
      'status',package.status,'fundedMinor',summary.funded_minor::text,'cohortCount',summary.cohort_count,
      'theoreticalShareExactUsd',summary.theoretical_share_exact_usd::text,'initialClaimExactUsd',summary.initial_claim_exact_usd::text,
      'scorePoolContributionExactUsd',summary.score_pool_contribution_exact_usd::text,'sourceCount',summary.source_count,
      'capMultiple',to_char(summary.cap_multiple,'FM90.00'),'harvestedUnclaimedMinor',summary.harvested_unclaimed_minor::text)),'[]'::jsonb)
    INTO v_result FROM public.epoch_close_project_summaries summary
    JOIN public.epoch_close_packages package ON package.approval_id=summary.approval_id
    WHERE summary.monthly_cycle_id=v_cycle_id AND summary.project_id=p_project_id;
  ELSE RAISE EXCEPTION 'epoch_close_scope_invalid'; END IF;
  RETURN coalesce(v_result,'[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.prepare_epoch_withdrawal_obligations(p_close_package_id bigint,p_actor_user_id uuid,p_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_close public.epoch_close_packages%ROWTYPE; v_obligations integer; v_inventory integer;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=p_actor_user_id) THEN
    RAISE EXCEPTION 'withdrawal_operator_actor_invalid';
  END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=p_close_package_id FOR UPDATE;
  IF v_close.id IS NULL OR v_close.status<>'payout_readying' OR v_close.production_enabled
    OR NOT EXISTS(SELECT 1 FROM public.epoch_close_root_approvals root_approval WHERE root_approval.close_package_id=v_close.id)
  THEN RAISE EXCEPTION 'withdrawal_close_package_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('withdrawal-prepare:'||v_close.id::text,0));

  INSERT INTO public.user_withdrawal_obligations(source_award_control_id,monthly_cycle_id,user_id,total_minor,state,available_at,
    source_expires_after_cycle_id,evidence_hash)
  SELECT control.id,control.monthly_cycle_id,control.user_id,control.final_award_minor,'available',v_close.created_at,
    CASE WHEN control.policy_key='settled_cubid_redistribution_v2' THEN (
      SELECT expiry.id FROM public.monthly_cycles origin
      JOIN public.monthly_cycles expiry ON expiry.period_start=(origin.period_start+interval '3 months')::date
      WHERE origin.id=control.monthly_cycle_id
    ) ELSE (
      SELECT min(lot.expires_after_cycle_id) FROM public.epoch_provisional_award_source_fills fill
      JOIN public.epoch_allocation_manifest_sources source ON source.id=fill.manifest_source_id
      JOIN public.epoch_valuation_source_lots lot ON lot.id=source.source_lot_id
      WHERE fill.award_control_id=control.id
    ) END,
    encode(extensions.digest(pg_catalog.convert_to(v_close.root_hash||':obligation:'||control.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_provisional_award_controls control
  WHERE control.approval_id=v_close.approval_id AND control.final_award_minor>0
  ON CONFLICT(source_award_control_id) DO NOTHING;
  GET DIAGNOSTICS v_obligations=ROW_COUNT;

  INSERT INTO public.payout_inventory_lots(obligation_id,source_fill_id,project_id,user_id,monthly_cycle_id,rail_key,
    financial_asset_id,custody_account_id,fx_snapshot_id,canonical_minor_total,native_atomic_total,deterministic_sequence,
    expires_after_cycle_id,evidence_hash)
  SELECT obligation.id,fill.id,fill.project_id,obligation.user_id,obligation.monthly_cycle_id,
    CASE WHEN coalesce(project_source.rail_key,pool_source.rail_key) IN('stripe_bank_transfer','stripe_sandbox')
      THEN 'stripe_bank_transfer' ELSE 'base_stablecoin' END,
    coalesce(project_source.financial_asset_id,pool_source.financial_asset_id),
    coalesce(project_source.custody_account_id,pool_source.custody_account_id),
    coalesce(project_source.fx_snapshot_id,pool_source.fx_snapshot_id),fill.canonical_minor,
    greatest(1,floor(coalesce(project_source.native_atomic_amount,pool_source.native_atomic_amount)
      *fill.exact_usd/coalesce(project_source.exact_usd,pool_source.exact_usd)))::numeric(78,0),
    coalesce(project_source.source_order,pool_source.source_order)*1000000+fill.id,
    obligation.source_expires_after_cycle_id,
    encode(extensions.digest(pg_catalog.convert_to(v_close.root_hash||':inventory:'||fill.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_provisional_award_source_fills fill
  JOIN public.user_withdrawal_obligations obligation ON obligation.source_award_control_id=fill.award_control_id
  LEFT JOIN public.epoch_allocation_manifest_sources project_source ON project_source.id=fill.manifest_source_id
  LEFT JOIN public.epoch_allocation_manifest_pool_sources pool_source ON pool_source.id=fill.manifest_pool_source_id
  WHERE fill.approval_id=v_close.approval_id AND fill.fill_kind IN('initial_retained','initial_claim','top_up')
    AND fill.canonical_minor>0
  ON CONFLICT(source_fill_id) DO NOTHING;
  GET DIAGNOSTICS v_inventory=ROW_COUNT;
  RETURN jsonb_build_object('closePackageId',v_close.id,'obligationsCreated',v_obligations,
    'inventoryLotsCreated',v_inventory,'noPayoutExecuted',true);
END; $$;

REVOKE ALL ON FUNCTION public.approve_epoch_allocation_close_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.approve_epoch_allocation_close_v2(jsonb) TO service_role;
