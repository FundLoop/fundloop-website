-- Close Stripe Connect fee conservation and provider/local commit recovery gaps.

ALTER TABLE public.stripe_connect_payout_commands
  ADD COLUMN user_fee_provider_minor numeric(78,0) NOT NULL DEFAULT 0,
  ADD CONSTRAINT stripe_connect_payout_fee_provider_amount CHECK(user_fee_provider_minor>=0);

CREATE TABLE public.stripe_connect_fee_inventory_reservations (
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  inventory_lot_id bigint NOT NULL REFERENCES public.payout_inventory_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  command_id bigint REFERENCES public.stripe_connect_payout_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reserved_minor numeric(78,0) NOT NULL,
  native_atomic_amount numeric(78,0) NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(withdrawal_request_id,inventory_lot_id),
  CHECK(reserved_minor>0 AND native_atomic_amount>0),
  CHECK(status IN('reserved','held','consumed','released'))
);
CREATE INDEX stripe_connect_fee_inventory_active_idx
  ON public.stripe_connect_fee_inventory_reservations(inventory_lot_id,status,withdrawal_request_id)
  WHERE status IN('reserved','held','consumed');

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions)
VALUES
  ('stripe_user_fee_control','debit','user_selected_fee_withheld_review','["user"]'),
  ('stripe_user_fee_revenue','credit','user_selected_fee_revenue_review','["user"]')
ON CONFLICT(account_key) DO NOTHING;

CREATE FUNCTION public.reserve_stripe_connect_fee_inventory() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request public.user_withdrawal_requests%ROWTYPE;
  v_remaining numeric(78,0):=NEW.user_fee_minor;
  v_existing_minor numeric(78,0);
  v_existing_native numeric(78,0);
  v_lot record;
  v_take numeric(78,0);
  v_native numeric(78,0);
BEGIN
  IF NEW.user_fee_minor=0 THEN RETURN NEW; END IF;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=NEW.withdrawal_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.project_id IS NULL THEN RAISE EXCEPTION 'stripe_connect_fee_request_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payout-inventory:'||v_request.user_id::text||':'||v_request.project_id::text||':'||v_request.financial_asset_id::text,0));

  UPDATE public.stripe_connect_fee_inventory_reservations
    SET command_id=NEW.id,status='reserved'
  WHERE withdrawal_request_id=NEW.withdrawal_request_id AND status='held';
  SELECT coalesce(sum(reserved_minor),0),coalesce(sum(native_atomic_amount),0)
    INTO v_existing_minor,v_existing_native
  FROM public.stripe_connect_fee_inventory_reservations
  WHERE withdrawal_request_id=NEW.withdrawal_request_id AND status IN('reserved','held','consumed');
  IF v_existing_minor>0 THEN
    IF v_existing_minor<>NEW.user_fee_minor OR v_existing_native<=0 THEN RAISE EXCEPTION 'stripe_connect_fee_inventory_mismatch'; END IF;
    UPDATE public.stripe_connect_payout_commands SET user_fee_provider_minor=v_existing_native WHERE id=NEW.id;
    RETURN NEW;
  END IF;

  FOR v_lot IN
    SELECT lot.id,asset.atomic_scale,fx.rate_usd_per_unit,
      lot.canonical_minor_total-coalesce((SELECT sum(r.reserved_minor) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)
        -coalesce((SELECT sum(f.reserved_minor) FROM public.stripe_connect_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','held','consumed')),0) AS available_minor,
      lot.native_atomic_total-coalesce((SELECT sum(r.native_atomic_amount) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)
        -coalesce((SELECT sum(f.native_atomic_amount) FROM public.base_payout_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','consumed')),0)
        -coalesce((SELECT sum(f.native_atomic_amount) FROM public.stripe_connect_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','held','consumed')),0) AS available_native
    FROM public.payout_inventory_lots lot
    JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
    JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id
    WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
      AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key
      AND lot.status IN('available','reserved')
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
    INSERT INTO public.stripe_connect_fee_inventory_reservations(
      withdrawal_request_id,inventory_lot_id,command_id,reserved_minor,native_atomic_amount)
    VALUES(NEW.withdrawal_request_id,v_lot.id,NEW.id,v_take,v_native);
    v_remaining:=v_remaining-v_take;
  END LOOP;
  IF v_remaining<>0 THEN RAISE EXCEPTION 'stripe_connect_user_fee_inventory_unavailable'; END IF;
  SELECT sum(native_atomic_amount) INTO v_existing_native FROM public.stripe_connect_fee_inventory_reservations
    WHERE withdrawal_request_id=NEW.withdrawal_request_id AND status='reserved';
  UPDATE public.stripe_connect_payout_commands SET user_fee_provider_minor=v_existing_native WHERE id=NEW.id;
  RETURN NEW;
END; $$;
CREATE TRIGGER stripe_connect_payout_fee_inventory_after_insert
AFTER INSERT ON public.stripe_connect_payout_commands FOR EACH ROW EXECUTE FUNCTION public.reserve_stripe_connect_fee_inventory();

CREATE FUNCTION public.sync_stripe_connect_fee_inventory_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status='held' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.stripe_connect_fee_inventory_reservations SET status='held'
      WHERE withdrawal_request_id=NEW.id AND status='reserved';
  ELSIF NEW.status IN('cancelled','closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.stripe_connect_fee_inventory_reservations SET status='released'
      WHERE withdrawal_request_id=NEW.id AND status IN('reserved','held');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stripe_connect_fee_inventory_request_status
AFTER UPDATE OF status ON public.user_withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.sync_stripe_connect_fee_inventory_status();

CREATE FUNCTION public.post_stripe_connect_fee_ledger_legs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user_id uuid;v_reserved_minor numeric(78,0);v_reserved_native numeric(78,0);v_sequence integer;
BEGIN
  IF NEW.status<>'reconciled' OR OLD.status='reconciled' OR NEW.user_fee_minor=0 THEN RETURN NEW; END IF;
  SELECT account.user_id INTO v_user_id FROM public.stripe_connect_accounts account WHERE account.id=NEW.stripe_connect_account_id;
  SELECT coalesce(sum(reserved_minor),0),coalesce(sum(native_atomic_amount),0)
    INTO v_reserved_minor,v_reserved_native FROM public.stripe_connect_fee_inventory_reservations
    WHERE withdrawal_request_id=NEW.withdrawal_request_id AND status IN('reserved','held');
  IF v_reserved_minor<>NEW.user_fee_minor OR v_reserved_native<>NEW.user_fee_provider_minor THEN
    RAISE EXCEPTION 'stripe_connect_fee_inventory_mismatch';
  END IF;
  SELECT coalesce(max(sequence_no),0) INTO v_sequence FROM public.ledger_postings WHERE transaction_id=NEW.ledger_transaction_id;
  INSERT INTO public.ledger_postings(transaction_id,sequence_no,account_id,side,functional_usd_amount,user_id)
  VALUES
    (NEW.ledger_transaction_id,v_sequence+1,(SELECT id FROM public.ledger_accounts WHERE account_key='stripe_user_fee_control'),'debit',NEW.user_fee_minor/100,v_user_id),
    (NEW.ledger_transaction_id,v_sequence+2,(SELECT id FROM public.ledger_accounts WHERE account_key='stripe_user_fee_revenue'),'credit',NEW.user_fee_minor/100,v_user_id);
  UPDATE public.stripe_connect_fee_inventory_reservations SET status='consumed'
    WHERE withdrawal_request_id=NEW.withdrawal_request_id AND status IN('reserved','held');
  RETURN NEW;
END; $$;
CREATE TRIGGER stripe_connect_payout_fee_ledger_before_reconcile
BEFORE UPDATE OF status ON public.stripe_connect_payout_commands FOR EACH ROW EXECUTE FUNCTION public.post_stripe_connect_fee_ledger_legs();

ALTER FUNCTION public.prepare_stripe_connect_payout(uuid,bigint,text) RENAME TO prepare_stripe_connect_payout_once;
REVOKE ALL ON FUNCTION public.prepare_stripe_connect_payout_once(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.prepare_stripe_connect_payout(p_actor_user_id uuid,p_payout_intent_id bigint,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_connect_payout_commands%ROWTYPE;v_account public.stripe_connect_accounts%ROWTYPE;
BEGIN
  IF NOT public.stripe_connect_runtime_enabled(p_environment,'payout') THEN RAISE EXCEPTION 'stripe_connect_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=p_actor_user_id) THEN RAISE EXCEPTION 'stripe_connect_operator_invalid'; END IF;
  SELECT command.* INTO v_command FROM public.stripe_connect_payout_commands command
    JOIN public.payout_intents intent ON intent.id=command.payout_intent_id
    WHERE command.payout_intent_id=p_payout_intent_id AND intent.status='processing'
      AND command.status IN('prepared','transferred','submitted','in_transit')
    ORDER BY command.attempt_no DESC LIMIT 1 FOR UPDATE OF command;
  IF v_command.id IS NULL THEN RETURN public.prepare_stripe_connect_payout_once(p_actor_user_id,p_payout_intent_id,p_environment); END IF;
  SELECT * INTO v_account FROM public.stripe_connect_accounts WHERE id=v_command.stripe_connect_account_id;
  RETURN jsonb_build_object('commandId',v_command.id,'attemptId',v_command.payout_execution_attempt_id,
    'providerAccountId',v_account.provider_account_id,'currencyCode',lower(v_command.currency_code),
    'grossMinor',v_command.gross_minor::text,'feeMinor',v_command.user_fee_minor::text,
    'canonicalNetMinor',v_command.net_minor::text,'netMinor',v_command.provider_payout_minor::text,
    'existingTransferId',coalesce(v_command.provider_transfer_id,''),
    'transferIdempotencyKey',v_command.idempotency_key||':transfer','payoutIdempotencyKey',v_command.idempotency_key||':payout',
    'resumed',true);
END; $$;

CREATE OR REPLACE FUNCTION public.record_stripe_connect_payout_submission(p_command_id bigint,p_transfer_id text,p_payout_id text,p_provider_request_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_connect_payout_commands%ROWTYPE;
BEGIN
  SELECT * INTO v_command FROM public.stripe_connect_payout_commands WHERE id=p_command_id FOR UPDATE;
  IF v_command.id IS NULL THEN RAISE EXCEPTION 'stripe_connect_payout_command_unavailable'; END IF;
  IF p_transfer_id!~'^tr_[A-Za-z0-9]+$' OR p_payout_id!~'^po_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'stripe_connect_provider_reference_invalid'; END IF;
  IF v_command.status IN('submitted','in_transit','reconciled') THEN
    IF v_command.provider_transfer_id<>p_transfer_id OR v_command.provider_payout_id<>p_payout_id THEN RAISE EXCEPTION 'stripe_connect_provider_reference_conflict'; END IF;
    RETURN jsonb_build_object('commandId',p_command_id,'status',v_command.status,'providerPayoutId',p_payout_id,'replayed',true);
  END IF;
  IF v_command.status NOT IN('prepared','transferred') THEN RAISE EXCEPTION 'stripe_connect_payout_command_unavailable'; END IF;
  UPDATE public.stripe_connect_payout_commands SET provider_transfer_id=p_transfer_id,provider_payout_id=p_payout_id,
    provider_request_id=nullif(p_provider_request_id,''),status='submitted',submitted_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=p_command_id;
  UPDATE public.payout_execution_attempts SET status='submitted',provider_reference=p_payout_id WHERE id=v_command.payout_execution_attempt_id;
  RETURN jsonb_build_object('commandId',p_command_id,'status','submitted','providerPayoutId',p_payout_id);
END; $$;

CREATE OR REPLACE FUNCTION public.reserve_withdrawal_inventory(p_request_id uuid,p_now timestamptz DEFAULT clock_timestamp())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_need numeric(78,0); v_remaining numeric(78,0); v_lot record; v_take numeric(78,0); v_native numeric(78,0); v_seq integer:=0;
BEGIN
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.net_minor IS NULL OR v_request.net_minor=0 THEN RETURN true; END IF;
  IF v_request.project_id IS NULL THEN RAISE EXCEPTION 'withdrawal_project_scope_required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payout-inventory:'||v_request.user_id::text||':'||v_request.project_id::text||':'||v_request.financial_asset_id::text,0));
  v_need:=v_request.net_minor; v_remaining:=v_need;
  FOR v_lot IN
    SELECT lot.*,asset.atomic_scale,fx.rate_usd_per_unit,
      lot.canonical_minor_total-coalesce((SELECT sum(r.reserved_minor) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)
        -coalesce((SELECT sum(f.reserved_minor) FROM public.stripe_connect_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','held','consumed')),0) AS available_minor,
      lot.native_atomic_total-coalesce((SELECT sum(r.native_atomic_amount) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)
        -coalesce((SELECT sum(f.native_atomic_amount) FROM public.base_payout_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','consumed')),0)
        -coalesce((SELECT sum(f.native_atomic_amount) FROM public.stripe_connect_fee_inventory_reservations f
        WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','held','consumed')),0) AS available_native
    FROM public.payout_inventory_lots lot JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
    JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id
    WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
      AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key AND lot.status IN('available','reserved')
      AND EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims claim WHERE claim.withdrawal_request_id=v_request.id
        AND claim.obligation_id=lot.obligation_id AND claim.status IN('queued','reserved','held'))
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
    INSERT INTO public.payout_inventory_reservations(withdrawal_request_id,inventory_lot_id,sequence_no,reserved_minor,native_atomic_amount,originating_fx_snapshot_id,reserved_at,expires_at)
    VALUES(v_request.id,v_lot.id,v_seq,v_take,v_native,v_lot.fx_snapshot_id,p_now,p_now+interval '48 hours');
    v_remaining:=v_remaining-v_take;
  END LOOP;
  IF v_remaining>0 THEN DELETE FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request.id AND status='reserved'; RETURN false; END IF;
  RETURN true;
END; $$;

ALTER TABLE public.stripe_connect_fee_inventory_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_connect_fee_inventory_reservations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.stripe_connect_fee_inventory_reservations TO service_role;
REVOKE ALL ON FUNCTION public.prepare_stripe_connect_payout(uuid,bigint,text),
  public.record_stripe_connect_payout_submission(bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_stripe_connect_payout(uuid,bigint,text),
  public.record_stripe_connect_payout_submission(bigint,text,text,text) TO service_role;
