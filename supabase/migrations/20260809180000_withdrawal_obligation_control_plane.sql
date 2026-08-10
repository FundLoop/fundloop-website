-- Provisional withdrawal obligation control plane for #139.
-- This migration is intentionally local/dev/test only. It creates no provider
-- call, payable accounting conclusion, external transfer, or production value flow.

CREATE TABLE public.withdrawal_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reservation_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_runtime_production_closed CHECK (
    deployment_environment <> 'production' OR (reservation_enabled=false AND production_value_flow_enabled=false)
  ),
  CONSTRAINT withdrawal_runtime_no_value_flow CHECK(production_value_flow_enabled=false)
);

INSERT INTO public.withdrawal_runtime_controls(deployment_environment,reservation_enabled) VALUES
  ('local',true),('development',true),('dev',true),('preview',true),('test',true),('production',false)
ON CONFLICT(deployment_environment) DO NOTHING;

ALTER TABLE public.user_withdrawal_requests DROP CONSTRAINT user_withdrawal_requests_status_check;
ALTER TABLE public.user_withdrawal_requests
  ADD COLUMN requested_minor numeric(78,0),
  ADD COLUMN fee_minor numeric(78,0),
  ADD COLUMN net_minor numeric(78,0),
  ADD COLUMN user_fee_bps integer,
  ADD COLUMN rail_key text,
  ADD COLUMN financial_asset_id bigint REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN destination_hash text,
  ADD COLUMN request_hash text,
  ADD COLUMN queue_for_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN queue_for_cycle_key text,
  ADD COLUMN status_reason text,
  ADD COLUMN production_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN closed_at timestamptz,
  ADD CONSTRAINT user_withdrawal_requests_status_check CHECK(status IN(
    'requested','reserved','queued','held','paid','cancelled','closed'
  )),
  ADD CONSTRAINT user_withdrawal_requests_minor_shape CHECK(
    (requested_minor IS NULL AND fee_minor IS NULL AND net_minor IS NULL AND user_fee_bps IS NULL)
    OR (requested_minor>0 AND fee_minor>=0 AND net_minor>=0 AND requested_minor=fee_minor+net_minor AND user_fee_bps BETWEEN 0 AND 10000)
  ),
  ADD CONSTRAINT user_withdrawal_requests_asset_shape CHECK(
    (financial_asset_id IS NULL AND rail_key IS NULL AND destination_hash IS NULL AND request_hash IS NULL)
    OR (financial_asset_id IS NOT NULL AND rail_key IN('stripe_bank_transfer','base_stablecoin')
      AND destination_hash ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT user_withdrawal_requests_production_disabled CHECK(production_enabled=false);
ALTER TABLE public.user_withdrawal_requests ADD CONSTRAINT user_withdrawal_queue_key CHECK(
  queue_for_cycle_key IS NULL OR queue_for_cycle_key ~ '^\d{4}-(0[1-9]|1[0-2])$'
);

CREATE INDEX user_withdrawal_requests_open_status_idx
ON public.user_withdrawal_requests(user_id,status,requested_at,id)
WHERE status IN('requested','reserved','queued','held');

CREATE TABLE public.user_withdrawal_obligations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_award_control_id bigint UNIQUE REFERENCES public.epoch_provisional_award_controls(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_bookkeeping_credit_id bigint UNIQUE REFERENCES public.monthly_cycle_bookkeeping_credits(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  total_minor numeric(78,0) NOT NULL,
  state text NOT NULL DEFAULT 'available',
  available_at timestamptz NOT NULL DEFAULT now(),
  source_expires_after_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_obligation_one_source CHECK((source_award_control_id IS NOT NULL) <> (source_bookkeeping_credit_id IS NOT NULL)),
  CONSTRAINT withdrawal_obligation_amount CHECK(total_minor>0),
  CONSTRAINT withdrawal_obligation_state CHECK(state IN('available','reserved','queued','held','paid','closed')),
  CONSTRAINT withdrawal_obligation_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT withdrawal_obligation_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX withdrawal_obligations_user_oldest_idx ON public.user_withdrawal_obligations(user_id,available_at,id);

CREATE TABLE public.user_withdrawal_obligation_claims (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  obligation_id bigint NOT NULL REFERENCES public.user_withdrawal_obligations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sequence_no integer NOT NULL,
  claimed_minor numeric(78,0) NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(withdrawal_request_id,sequence_no),
  UNIQUE(withdrawal_request_id,obligation_id),
  CONSTRAINT withdrawal_claim_sequence CHECK(sequence_no>0),
  CONSTRAINT withdrawal_claim_amount CHECK(claimed_minor>0),
  CONSTRAINT withdrawal_claim_status CHECK(status IN('reserved','queued','held','paid','released','closed'))
);
CREATE INDEX withdrawal_claims_obligation_active_idx ON public.user_withdrawal_obligation_claims(obligation_id,status,id)
WHERE status IN('reserved','queued','held','paid','closed');

CREATE FUNCTION public.refresh_withdrawal_obligation_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric(78,0); v_claimed numeric(78,0); v_state text;
BEGIN
  SELECT total_minor INTO v_total FROM public.user_withdrawal_obligations WHERE id=NEW.obligation_id FOR UPDATE;
  SELECT coalesce(sum(claimed_minor),0) INTO v_claimed FROM public.user_withdrawal_obligation_claims
    WHERE obligation_id=NEW.obligation_id AND status<>'released';
  IF v_claimed<v_total THEN v_state:='available';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='held') THEN v_state:='held';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='queued') THEN v_state:='queued';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='reserved') THEN v_state:='reserved';
  ELSIF EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims WHERE obligation_id=NEW.obligation_id AND status='paid') THEN v_state:='paid';
  ELSE v_state:='closed'; END IF;
  UPDATE public.user_withdrawal_obligations SET state=v_state WHERE id=NEW.obligation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER withdrawal_claim_refresh_state AFTER INSERT OR UPDATE OF status ON public.user_withdrawal_obligation_claims
FOR EACH ROW EXECUTE FUNCTION public.refresh_withdrawal_obligation_state();

CREATE TABLE public.payout_inventory_lots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  obligation_id bigint NOT NULL REFERENCES public.user_withdrawal_obligations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_fill_id bigint UNIQUE REFERENCES public.epoch_provisional_award_source_fills(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  legacy_inventory_key text UNIQUE,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  canonical_minor_total numeric(78,0) NOT NULL,
  native_atomic_total numeric(78,0) NOT NULL,
  deterministic_sequence bigint NOT NULL,
  expires_after_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'available',
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_inventory_rail CHECK(rail_key IN('stripe_bank_transfer','base_stablecoin')),
  CONSTRAINT payout_inventory_one_source CHECK((source_fill_id IS NOT NULL) <> (legacy_inventory_key IS NOT NULL)),
  CONSTRAINT payout_inventory_legacy_key CHECK(legacy_inventory_key IS NULL OR legacy_inventory_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT payout_inventory_amount CHECK(canonical_minor_total>0 AND native_atomic_total>0),
  CONSTRAINT payout_inventory_pair FOREIGN KEY(financial_asset_id,custody_account_id)
    REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT payout_inventory_status CHECK(status IN('available','reserved','depleted','expired','closed')),
  CONSTRAINT payout_inventory_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payout_inventory_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX payout_inventory_user_asset_idx ON public.payout_inventory_lots(user_id,financial_asset_id,status,deterministic_sequence,id);
CREATE INDEX payout_inventory_project_asset_idx ON public.payout_inventory_lots(project_id,financial_asset_id,status,deterministic_sequence,id);

CREATE TABLE public.payout_inventory_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  inventory_lot_id bigint NOT NULL REFERENCES public.payout_inventory_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sequence_no integer NOT NULL,
  reserved_minor numeric(78,0) NOT NULL,
  native_atomic_amount numeric(78,0) NOT NULL,
  originating_fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'reserved',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  UNIQUE(withdrawal_request_id,sequence_no),
  UNIQUE(withdrawal_request_id,inventory_lot_id),
  CONSTRAINT payout_reservation_sequence CHECK(sequence_no>0),
  CONSTRAINT payout_reservation_amount CHECK(reserved_minor>0 AND native_atomic_amount>0),
  CONSTRAINT payout_reservation_status CHECK(status IN('reserved','held','consumed','released','expired')),
  CONSTRAINT payout_reservation_release_shape CHECK((status IN('released','expired') AND released_at IS NOT NULL) OR (status NOT IN('released','expired') AND released_at IS NULL))
);
CREATE INDEX payout_inventory_reservations_active_idx ON public.payout_inventory_reservations(inventory_lot_id,status,id)
WHERE status IN('reserved','held','consumed');
CREATE INDEX payout_inventory_reservations_expiry_idx ON public.payout_inventory_reservations(expires_at,id)
WHERE status IN('reserved','held');

CREATE TABLE public.withdrawal_compliance_holds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  hold_sequence integer NOT NULL,
  reason_code text NOT NULL,
  evidence_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  placed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text,
  UNIQUE(withdrawal_request_id,hold_sequence),
  CONSTRAINT withdrawal_hold_reason CHECK(reason_code ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT withdrawal_hold_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT withdrawal_hold_status CHECK(status IN('active','released','reversed')),
  CONSTRAINT withdrawal_hold_resolution CHECK((status='active' AND resolved_at IS NULL AND resolution IS NULL) OR (status<>'active' AND resolved_at IS NOT NULL AND resolution IS NOT NULL))
);
CREATE UNIQUE INDEX withdrawal_holds_one_active_idx ON public.withdrawal_compliance_holds(withdrawal_request_id) WHERE status='active';

CREATE TABLE public.withdrawal_lifecycle_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_lifecycle_type CHECK(event_type IN('created','reserved','queued','held','released','cancelled','expired','retried','paid','closed')),
  CONSTRAINT withdrawal_lifecycle_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE INDEX withdrawal_lifecycle_request_idx ON public.withdrawal_lifecycle_events(withdrawal_request_id,created_at,id);

CREATE TABLE public.payout_execution_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payout_intent_id bigint NOT NULL REFERENCES public.payout_intents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  attempt_no integer NOT NULL,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  destination_hash text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  provider_reference text,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(withdrawal_request_id,attempt_no),
  CONSTRAINT payout_execution_attempt_hashes CHECK(destination_hash ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payout_execution_attempt_status CHECK(status IN('planned','blocked','submitted','confirmed','failed','reconciled')),
  CONSTRAINT payout_execution_attempt_production_disabled CHECK(production_enabled=false)
);

ALTER TABLE public.payout_intents
  ADD COLUMN withdrawal_request_id uuid REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN financial_asset_id bigint REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN native_atomic_amount numeric(78,0),
  ADD COLUMN user_fee_bps integer,
  ADD COLUMN fee_amount_usd numeric(20,6),
  ADD CONSTRAINT payout_intent_withdrawal_shape CHECK(
    withdrawal_request_id IS NULL OR (source_result_id IS NULL AND financial_asset_id IS NOT NULL
      AND native_atomic_amount>=0 AND user_fee_bps BETWEEN 0 AND 10000 AND fee_amount_usd>=0)
  );
CREATE UNIQUE INDEX payout_intents_one_live_withdrawal_idx ON public.payout_intents(withdrawal_request_id)
WHERE withdrawal_request_id IS NOT NULL AND status IN('draft','ready','batched','processing');

CREATE FUNCTION public.prevent_direct_result_payout_intents() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.source_result_id IS NOT NULL AND NEW.withdrawal_request_id IS NULL THEN
    RAISE EXCEPTION 'direct_result_payout_intents_retired';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER payout_intents_withdrawal_only BEFORE INSERT ON public.payout_intents
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_result_payout_intents();

CREATE FUNCTION public.prevent_withdrawal_event_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'withdrawal_evidence_is_append_only'; END; $$;
CREATE TRIGGER withdrawal_lifecycle_append_only BEFORE UPDATE OR DELETE ON public.withdrawal_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.prevent_withdrawal_event_mutation();

CREATE FUNCTION public.withdrawal_runtime_enabled(p_environment text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.withdrawal_runtime_controls c
    WHERE c.deployment_environment=lower(p_environment) AND c.reservation_enabled AND NOT c.production_value_flow_enabled
  );
$$;

CREATE FUNCTION public.prepare_epoch_withdrawal_obligations(p_close_package_id bigint,p_actor_user_id uuid,p_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_close public.epoch_close_packages%ROWTYPE; v_obligations integer; v_inventory integer;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=p_actor_user_id) THEN
    RAISE EXCEPTION 'withdrawal_operator_actor_invalid';
  END IF;
  SELECT * INTO v_close FROM public.epoch_close_packages WHERE id=p_close_package_id FOR UPDATE;
  IF v_close.id IS NULL OR v_close.status<>'payout_readying' OR v_close.production_enabled
    OR NOT EXISTS(SELECT 1 FROM public.epoch_close_root_approvals r WHERE r.close_package_id=v_close.id)
  THEN RAISE EXCEPTION 'withdrawal_close_package_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('withdrawal-prepare:'||v_close.id::text,0));

  INSERT INTO public.user_withdrawal_obligations(source_award_control_id,monthly_cycle_id,user_id,total_minor,state,available_at,
    source_expires_after_cycle_id,evidence_hash)
  SELECT control.id,control.monthly_cycle_id,control.user_id,control.final_award_minor,'available',v_close.created_at,
    (SELECT min(lot.expires_after_cycle_id) FROM public.epoch_provisional_award_source_fills fill
      JOIN public.epoch_allocation_manifest_sources source ON source.id=fill.manifest_source_id
      JOIN public.epoch_valuation_source_lots lot ON lot.id=source.source_lot_id
      WHERE fill.award_control_id=control.id),
    encode(extensions.digest(pg_catalog.convert_to(v_close.root_hash||':obligation:'||control.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_provisional_award_controls control
  WHERE control.approval_id=v_close.approval_id AND control.final_award_minor>0
  ON CONFLICT(source_award_control_id) DO NOTHING;
  GET DIAGNOSTICS v_obligations=ROW_COUNT;

  INSERT INTO public.payout_inventory_lots(obligation_id,source_fill_id,project_id,user_id,monthly_cycle_id,rail_key,
    financial_asset_id,custody_account_id,fx_snapshot_id,canonical_minor_total,native_atomic_total,deterministic_sequence,
    expires_after_cycle_id,evidence_hash)
  SELECT obligation.id,fill.id,fill.project_id,obligation.user_id,obligation.monthly_cycle_id,
    CASE WHEN source.rail_key IN('stripe_bank_transfer','stripe_sandbox') THEN 'stripe_bank_transfer' ELSE 'base_stablecoin' END,
    source.financial_asset_id,source.custody_account_id,source.fx_snapshot_id,fill.canonical_minor,
    greatest(1,floor((fill.canonical_minor::numeric/100)/fx.rate_usd_per_unit*power(10,asset.atomic_scale)))::numeric(78,0),
    source.source_order*1000000+fill.id,lot.expires_after_cycle_id,
    encode(extensions.digest(pg_catalog.convert_to(v_close.root_hash||':inventory:'||fill.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_provisional_award_source_fills fill
  JOIN public.user_withdrawal_obligations obligation ON obligation.source_award_control_id=fill.award_control_id
  JOIN public.epoch_allocation_manifest_sources source ON source.id=fill.manifest_source_id
  JOIN public.epoch_valuation_source_lots lot ON lot.id=source.source_lot_id
  JOIN public.epoch_fx_snapshots fx ON fx.id=source.fx_snapshot_id
  JOIN public.financial_assets asset ON asset.id=source.financial_asset_id
  WHERE fill.approval_id=v_close.approval_id AND fill.fill_kind IN('initial_retained','top_up') AND fill.canonical_minor>0
  ON CONFLICT(source_fill_id) DO NOTHING;
  GET DIAGNOSTICS v_inventory=ROW_COUNT;
  RETURN jsonb_build_object('closePackageId',v_close.id,'obligationsCreated',v_obligations,'inventoryLotsCreated',v_inventory,'noPayoutExecuted',true);
END; $$;

CREATE FUNCTION public.reserve_withdrawal_inventory(p_request_id uuid,p_now timestamptz DEFAULT clock_timestamp())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_need numeric(78,0); v_remaining numeric(78,0); v_lot record; v_take numeric(78,0); v_native numeric(78,0); v_seq integer:=0;
BEGIN
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.net_minor IS NULL OR v_request.net_minor=0 THEN RETURN true; END IF;
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
    WHERE lot.user_id=v_request.user_id AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key
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

CREATE FUNCTION public.create_user_withdrawal_request_v2(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment'); v_route public.user_payout_routes%ROWTYPE;
  v_asset public.financial_assets%ROWTYPE; v_existing public.user_withdrawal_requests%ROWTYPE; v_request public.user_withdrawal_requests%ROWTYPE;
  v_key text:=btrim(p_command->>'idempotencyKey'); v_hash text; v_amount numeric(78,0); v_fee_bps integer; v_fee numeric(78,0); v_net numeric(78,0);
  v_destination_hash text; v_rail text; v_available numeric(78,0); v_remaining numeric(78,0); v_obligation record; v_take numeric(78,0); v_seq integer:=0;
  v_reserved boolean; v_cycle_id bigint; v_intent_id bigint; v_native numeric(78,0); v_status text;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(v_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  IF p_command->>'contractVersion'<>'withdrawal_request.v2'
    OR v_key IS NULL OR length(v_key)<8 OR length(v_key)>128 THEN RAISE EXCEPTION 'withdrawal_request_contract_invalid'; END IF;
  v_amount:=(p_command->>'requestedMinor')::numeric; v_fee_bps:=(p_command->>'userFeeBps')::integer;
  IF v_amount<=0 OR v_amount<>trunc(v_amount) OR v_fee_bps NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'withdrawal_request_amount_invalid'; END IF;
  SELECT * INTO v_route FROM public.user_payout_routes WHERE id=(p_command->>'payoutRouteId')::bigint AND user_id=p_actor_user_id AND status='active' FOR UPDATE;
  IF v_route.id IS NULL THEN RAISE EXCEPTION 'active_payout_route_required'; END IF;
  v_rail:=CASE v_route.rail WHEN 'fiat_stub' THEN 'stripe_bank_transfer' WHEN 'evm' THEN 'base_stablecoin' ELSE NULL END;
  IF v_rail IS NULL THEN RAISE EXCEPTION 'withdrawal_rail_not_supported'; END IF;
  IF (v_rail='stripe_bank_transfer' AND v_amount<1000) OR (v_rail='base_stablecoin' AND v_amount<500) THEN RAISE EXCEPTION 'withdrawal_minimum_not_met'; END IF;
  SELECT * INTO v_asset FROM public.financial_assets WHERE asset_key=p_command->>'assetKey' AND NOT production_enabled;
  IF v_asset.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.user_id=p_actor_user_id AND lot.financial_asset_id=v_asset.id AND lot.rail_key=v_rail)
  THEN RAISE EXCEPTION 'withdrawal_asset_not_eligible'; END IF;
  v_destination_hash:=encode(extensions.digest(pg_catalog.convert_to(v_route.destination::text,'UTF8'),'sha256'),'hex');
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('contractVersion','withdrawal_request.v2','payoutRouteId',v_route.id,
    'requestedMinor',v_amount::text,'userFeeBps',v_fee_bps,'assetKey',v_asset.asset_key,'destinationHash',v_destination_hash)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('withdrawal:'||p_actor_user_id::text||':'||v_key,0));
  SELECT * INTO v_existing FROM public.user_withdrawal_requests WHERE user_id=p_actor_user_id AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'withdrawal_idempotency_conflict'; END IF;
    RETURN jsonb_build_object('requestId',v_existing.id,'status',v_existing.status,'requestedMinor',v_existing.requested_minor::text,
      'feeMinor',v_existing.fee_minor::text,'netMinor',v_existing.net_minor::text,'assetKey',v_asset.asset_key,'railKey',v_existing.rail_key,
      'payoutIntentId',(SELECT id FROM public.payout_intents WHERE withdrawal_request_id=v_existing.id ORDER BY id DESC LIMIT 1),'noPayoutExecuted',true);
  END IF;
  SELECT coalesce(sum(obligation.total_minor-coalesce((SELECT sum(claim.claimed_minor) FROM public.user_withdrawal_obligation_claims claim
    WHERE claim.obligation_id=obligation.id AND claim.status IN('reserved','queued','held','paid','closed')),0)),0)
  INTO v_available FROM public.user_withdrawal_obligations obligation WHERE obligation.user_id=p_actor_user_id AND obligation.state IN('available','reserved','queued','held');
  IF v_available<v_amount THEN RAISE EXCEPTION 'withdrawal_available_amount_insufficient'; END IF;
  v_fee:=floor(v_amount*v_fee_bps/10000); v_net:=v_amount-v_fee;
  INSERT INTO public.user_withdrawal_requests(user_id,payout_route_id,status,requested_usd_amount,currency_code,idempotency_key,
    requested_minor,fee_minor,net_minor,user_fee_bps,rail_key,financial_asset_id,destination_hash,request_hash)
  VALUES(p_actor_user_id,v_route.id,'requested',v_amount/100,'USD',v_key,v_amount,v_fee,v_net,v_fee_bps,v_rail,v_asset.id,v_destination_hash,v_hash)
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
      UPDATE public.user_withdrawal_requests SET status='queued',
        queue_for_cycle_id=(SELECT id FROM public.monthly_cycles WHERE period_start>(SELECT period_start FROM public.monthly_cycles WHERE id=v_cycle_id) ORDER BY period_start LIMIT 1),
        queue_for_cycle_key=to_char((SELECT period_start FROM public.monthly_cycles WHERE id=v_cycle_id)+interval '1 month','YYYY-MM'),
        status_reason='eligible_inventory_depleted' WHERE id=v_request.id;
      v_status:='queued'; v_intent_id:=NULL;
    END IF;
  END IF;
  INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,actor_user_id,evidence)
  VALUES(v_request.id,CASE v_status WHEN 'reserved' THEN 'reserved' WHEN 'queued' THEN 'queued' ELSE 'closed' END,'requested',v_status,p_actor_user_id,
    jsonb_build_object('requestHash',v_hash,'feeBps',v_fee_bps,'noProviderCall',true));
  RETURN jsonb_build_object('requestId',v_request.id,'status',v_status,'requestedMinor',v_amount::text,'feeMinor',v_fee::text,'netMinor',v_net::text,
    'assetKey',v_asset.asset_key,'railKey',v_rail,'payoutIntentId',v_intent_id,'noPayoutExecuted',true);
END; $$;

CREATE FUNCTION public.manage_user_withdrawal_request(p_actor_user_id uuid,p_request_id uuid,p_action text,p_reason text,p_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_from text; v_reserved boolean; v_intent numeric(78,0);
BEGIN
  IF NOT public.withdrawal_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id AND user_id=p_actor_user_id FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'withdrawal_request_not_found'; END IF;
  v_from:=v_request.status;
  IF p_action='cancel' THEN
    IF v_from NOT IN('requested','reserved','queued','held') THEN RAISE EXCEPTION 'withdrawal_request_not_cancellable'; END IF;
    UPDATE public.payout_inventory_reservations SET status='released',released_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id AND status IN('reserved','held');
    UPDATE public.user_withdrawal_obligation_claims SET status='released',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id AND status IN('reserved','queued','held');
    UPDATE public.withdrawal_compliance_holds SET status='reversed',resolved_at=clock_timestamp(),resolution='withdrawal_cancelled'
      WHERE withdrawal_request_id=v_request.id AND status='active';
    UPDATE public.payout_intents SET status='cancelled',status_reason='withdrawal_cancelled' WHERE withdrawal_request_id=v_request.id AND status IN('draft','ready');
    UPDATE public.user_withdrawal_requests SET status='cancelled',status_reason=coalesce(nullif(p_reason,''),'user_cancelled'),closed_at=clock_timestamp() WHERE id=v_request.id;
  ELSIF p_action='retry' THEN
    IF v_from<>'queued' THEN RAISE EXCEPTION 'withdrawal_request_not_queued'; END IF;
    v_reserved:=public.reserve_withdrawal_inventory(v_request.id);
    IF NOT v_reserved THEN RETURN jsonb_build_object('requestId',v_request.id,'status','queued','noPayoutExecuted',true); END IF;
    SELECT sum(native_atomic_amount) INTO v_intent FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request.id AND status='reserved';
    INSERT INTO public.payout_intents(monthly_cycle_id,user_id,payout_route_id,rail,currency_code,amount_usd,status,idempotency_key,
      created_by_user_id,updated_by_user_id,withdrawal_request_id,financial_asset_id,native_atomic_amount,user_fee_bps,fee_amount_usd)
    SELECT min(o.monthly_cycle_id),v_request.user_id,v_request.payout_route_id,r.rail,'USD',v_request.net_minor/100,'draft','withdrawal:'||v_request.id::text,
      v_request.user_id,v_request.user_id,v_request.id,v_request.financial_asset_id,v_intent,v_request.user_fee_bps,v_request.fee_minor/100
    FROM public.user_withdrawal_obligation_claims c JOIN public.user_withdrawal_obligations o ON o.id=c.obligation_id
    JOIN public.user_payout_routes r ON r.id=v_request.payout_route_id WHERE c.withdrawal_request_id=v_request.id GROUP BY r.rail;
    UPDATE public.user_withdrawal_obligation_claims SET status='reserved',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id AND status='queued';
    UPDATE public.user_withdrawal_requests SET status='reserved',queue_for_cycle_id=NULL,queue_for_cycle_key=NULL,status_reason=NULL WHERE id=v_request.id;
  ELSE RAISE EXCEPTION 'withdrawal_action_invalid'; END IF;
  INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,actor_user_id,evidence)
  VALUES(v_request.id,CASE p_action WHEN 'cancel' THEN 'cancelled' ELSE 'retried' END,v_from,CASE p_action WHEN 'cancel' THEN 'cancelled' ELSE 'reserved' END,
    p_actor_user_id,jsonb_build_object('reason',coalesce(p_reason,''),'noProviderCall',true));
  RETURN jsonb_build_object('requestId',v_request.id,'status',CASE p_action WHEN 'cancel' THEN 'cancelled' ELSE 'reserved' END,'noPayoutExecuted',true);
END; $$;

CREATE FUNCTION public.place_withdrawal_compliance_hold(p_actor_user_id uuid,p_request_id uuid,p_reason_code text,p_evidence_hash text,p_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_sequence integer;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(p_environment) OR p_reason_code !~ '^[a-z][a-z0-9:_-]*$' OR p_evidence_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'withdrawal_hold_contract_invalid'; END IF;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.status NOT IN('reserved','queued') THEN RAISE EXCEPTION 'withdrawal_request_not_holdable'; END IF;
  SELECT coalesce(max(hold_sequence),0)+1 INTO v_sequence FROM public.withdrawal_compliance_holds WHERE withdrawal_request_id=v_request.id;
  INSERT INTO public.withdrawal_compliance_holds(withdrawal_request_id,hold_sequence,reason_code,evidence_hash,actor_user_id)
  VALUES(v_request.id,v_sequence,p_reason_code,p_evidence_hash,p_actor_user_id);
  UPDATE public.user_withdrawal_requests SET status='held',status_reason=p_reason_code WHERE id=v_request.id;
  UPDATE public.user_withdrawal_obligation_claims SET status='held',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id AND status IN('reserved','queued');
  UPDATE public.payout_inventory_reservations SET status='held' WHERE withdrawal_request_id=v_request.id AND status='reserved';
  INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,actor_user_id,evidence)
  VALUES(v_request.id,'held',v_request.status,'held',p_actor_user_id,jsonb_build_object('reasonCode',p_reason_code));
  RETURN jsonb_build_object('requestId',v_request.id,'status','held','holdSequence',v_sequence,'noPayoutExecuted',true);
END; $$;

CREATE FUNCTION public.expire_withdrawal_inventory_reservations(p_now timestamptz,p_environment text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request record; v_count integer:=0;
BEGIN
  IF NOT public.withdrawal_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'withdrawal_runtime_disabled'; END IF;
  FOR v_request IN SELECT request.* FROM public.user_withdrawal_requests request
    WHERE request.status='reserved' AND EXISTS(SELECT 1 FROM public.payout_inventory_reservations reservation
      WHERE reservation.withdrawal_request_id=request.id AND reservation.status='reserved' AND reservation.expires_at<=p_now)
    FOR UPDATE OF request
  LOOP
    UPDATE public.payout_inventory_reservations SET status='expired',released_at=p_now WHERE withdrawal_request_id=v_request.id AND status='reserved' AND expires_at<=p_now;
    UPDATE public.user_withdrawal_obligation_claims SET status='queued',updated_at=p_now WHERE withdrawal_request_id=v_request.id AND status='reserved';
    UPDATE public.payout_intents SET status='cancelled',status_reason='reservation_expired_requeued' WHERE withdrawal_request_id=v_request.id AND status IN('draft','ready');
    UPDATE public.user_withdrawal_requests SET status='queued',status_reason='reservation_expired_requeued' WHERE id=v_request.id;
    INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,evidence)
    VALUES(v_request.id,'expired','reserved','queued',jsonb_build_object('timelyRequestPreserved',true));
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE VIEW public.user_withdrawal_asset_inventory WITH (security_invoker=true) AS
SELECT lot.user_id,asset.asset_key,asset.symbol,lot.rail_key,lot.project_id,
  sum(lot.canonical_minor_total-coalesce((SELECT sum(r.reserved_minor) FROM public.payout_inventory_reservations r
    WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0))::numeric(78,0) AS available_minor,
  count(*)::integer AS lot_count,min(lot.monthly_cycle_id) AS oldest_cycle_id
FROM public.payout_inventory_lots lot JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
WHERE lot.status IN('available','reserved') GROUP BY lot.user_id,asset.asset_key,asset.symbol,lot.rail_key,lot.project_id;

CREATE VIEW public.user_withdrawal_obligation_balances WITH (security_invoker=true) AS
SELECT obligation.id,obligation.user_id,obligation.monthly_cycle_id,obligation.total_minor,obligation.state,
  (obligation.total_minor-coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status<>'released'),0))::numeric(78,0) AS available_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='reserved'),0)::numeric(78,0) AS reserved_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='queued'),0)::numeric(78,0) AS queued_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='held'),0)::numeric(78,0) AS held_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='paid'),0)::numeric(78,0) AS paid_minor,
  coalesce(sum(claim.claimed_minor) FILTER(WHERE claim.status='closed'),0)::numeric(78,0) AS closed_minor
FROM public.user_withdrawal_obligations obligation LEFT JOIN public.user_withdrawal_obligation_claims claim ON claim.obligation_id=obligation.id
GROUP BY obligation.id;

ALTER TABLE public.user_withdrawal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_withdrawal_obligation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_compliance_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_execution_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.withdrawal_runtime_controls,public.user_withdrawal_obligations,public.user_withdrawal_obligation_claims,
  public.payout_inventory_lots,public.payout_inventory_reservations,public.withdrawal_compliance_holds,
  public.withdrawal_lifecycle_events,public.payout_execution_attempts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.user_withdrawal_obligations,public.user_withdrawal_obligation_claims,public.payout_inventory_lots,
  public.payout_inventory_reservations,public.withdrawal_compliance_holds,public.withdrawal_lifecycle_events,
  public.payout_execution_attempts,public.user_withdrawal_asset_inventory,public.user_withdrawal_obligation_balances TO authenticated,service_role;

CREATE POLICY withdrawal_obligations_self_select ON public.user_withdrawal_obligations FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY withdrawal_claims_self_select ON public.user_withdrawal_obligation_claims FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.user_withdrawal_requests request WHERE request.id=withdrawal_request_id AND request.user_id=auth.uid()));
CREATE POLICY payout_inventory_self_select ON public.payout_inventory_lots FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY financial_assets_withdrawal_self_select ON public.financial_assets FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.payout_inventory_lots lot WHERE lot.financial_asset_id=financial_assets.id AND lot.user_id=auth.uid()));
CREATE POLICY payout_reservations_self_select ON public.payout_inventory_reservations FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.user_withdrawal_requests request WHERE request.id=withdrawal_request_id AND request.user_id=auth.uid()));
CREATE POLICY withdrawal_holds_self_select ON public.withdrawal_compliance_holds FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.user_withdrawal_requests request WHERE request.id=withdrawal_request_id AND request.user_id=auth.uid()));
CREATE POLICY withdrawal_events_self_select ON public.withdrawal_lifecycle_events FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.user_withdrawal_requests request WHERE request.id=withdrawal_request_id AND request.user_id=auth.uid()));
CREATE POLICY payout_attempts_self_select ON public.payout_execution_attempts FOR SELECT USING(EXISTS(
  SELECT 1 FROM public.user_withdrawal_requests request WHERE request.id=withdrawal_request_id AND request.user_id=auth.uid()));
GRANT SELECT ON public.financial_assets TO authenticated;

REVOKE ALL ON FUNCTION public.create_user_withdrawal_request(uuid,bigint,text) FROM service_role;
REVOKE ALL ON FUNCTION public.prepare_epoch_withdrawal_obligations(bigint,uuid,text),public.reserve_withdrawal_inventory(uuid,timestamptz),
  public.create_user_withdrawal_request_v2(uuid,jsonb),public.manage_user_withdrawal_request(uuid,uuid,text,text,text),
  public.place_withdrawal_compliance_hold(uuid,uuid,text,text,text),public.expire_withdrawal_inventory_reservations(timestamptz,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_withdrawal_inventory(uuid,timestamptz) FROM service_role;
GRANT EXECUTE ON FUNCTION public.prepare_epoch_withdrawal_obligations(bigint,uuid,text),public.create_user_withdrawal_request_v2(uuid,jsonb),
  public.manage_user_withdrawal_request(uuid,uuid,text,text,text),public.place_withdrawal_compliance_hold(uuid,uuid,text,text,text),
  public.expire_withdrawal_inventory_reservations(timestamptz,text) TO service_role;
