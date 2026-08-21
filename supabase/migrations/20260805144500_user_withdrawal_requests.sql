CREATE TABLE public.user_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  payout_route_id bigint NOT NULL REFERENCES public.user_payout_routes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'requested',
  requested_usd_amount numeric(20, 6) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  idempotency_key text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_withdrawal_requests_status_check CHECK (status IN ('requested')),
  CONSTRAINT user_withdrawal_requests_positive_amount_check CHECK (requested_usd_amount > 0),
  CONSTRAINT user_withdrawal_requests_currency_check CHECK (currency_code = 'USD'),
  CONSTRAINT user_withdrawal_requests_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE TABLE public.user_withdrawal_request_credits (
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
  bookkeeping_credit_id bigint NOT NULL REFERENCES public.monthly_cycle_bookkeeping_credits(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  reserved_usd_amount numeric(20, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (withdrawal_request_id, bookkeeping_credit_id),
  CONSTRAINT user_withdrawal_request_credits_one_reservation UNIQUE (bookkeeping_credit_id),
  CONSTRAINT user_withdrawal_request_credits_positive_amount_check CHECK (reserved_usd_amount > 0)
);

CREATE INDEX user_withdrawal_requests_user_requested
ON public.user_withdrawal_requests (user_id, requested_at DESC);

CREATE TRIGGER set_user_withdrawal_requests_updated_at
BEFORE UPDATE ON public.user_withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_withdrawal_request_credits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_withdrawal_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_withdrawal_request_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_withdrawal_requests TO authenticated;
GRANT SELECT ON TABLE public.user_withdrawal_request_credits TO authenticated;
GRANT ALL ON TABLE public.user_withdrawal_requests TO service_role;
GRANT ALL ON TABLE public.user_withdrawal_request_credits TO service_role;

CREATE POLICY user_withdrawal_requests_self_select
ON public.user_withdrawal_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY user_withdrawal_request_credits_self_select
ON public.user_withdrawal_request_credits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_withdrawal_requests request
    WHERE request.id = user_withdrawal_request_credits.withdrawal_request_id
      AND request.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_user_withdrawal_request(
  p_actor_user_id uuid,
  p_payout_route_id bigint,
  p_idempotency_key text
)
RETURNS TABLE (
  request_id uuid,
  payout_route_id bigint,
  status text,
  requested_usd_amount numeric,
  currency_code text,
  credit_count integer,
  requested_at timestamptz,
  no_payout_executed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing public.user_withdrawal_requests%ROWTYPE;
  created public.user_withdrawal_requests%ROWTYPE;
  credit_ids bigint[];
  total_amount numeric(20, 6);
  selected_count integer;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_idempotency_key';
  END IF;

  -- Serialize retries for the same actor and key so concurrent requests return
  -- the first committed request instead of racing the unique constraint.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_actor_user_id::text || ':' || btrim(p_idempotency_key), 0)
  );

  SELECT * INTO existing
  FROM public.user_withdrawal_requests
  WHERE user_id = p_actor_user_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT count(*)::integer INTO selected_count
    FROM public.user_withdrawal_request_credits WHERE withdrawal_request_id = existing.id;
    RETURN QUERY SELECT existing.id, existing.payout_route_id, existing.status,
      existing.requested_usd_amount, existing.currency_code, selected_count, existing.requested_at, true;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_payout_routes route
    WHERE route.id = p_payout_route_id
      AND route.user_id = p_actor_user_id
      AND route.status = 'active'
      AND route.is_default = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'active_default_payout_route_required';
  END IF;

  SELECT array_agg(locked.id ORDER BY locked.id), sum(locked.usd_equivalent_amount), count(*)::integer
  INTO credit_ids, total_amount, selected_count
  FROM (
    SELECT credit.id, credit.usd_equivalent_amount
    FROM public.monthly_cycle_bookkeeping_credits credit
    WHERE credit.user_id = p_actor_user_id
      AND credit.status = 'credited'
      AND credit.payment_status = 'not_paid'
      AND credit.usd_equivalent_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.user_withdrawal_request_credits reservation
        WHERE reservation.bookkeeping_credit_id = credit.id
      )
    ORDER BY credit.id
    FOR UPDATE OF credit
  ) locked;

  IF selected_count IS NULL OR selected_count = 0 OR total_amount IS NULL OR total_amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'no_eligible_credited_earnings';
  END IF;

  INSERT INTO public.user_withdrawal_requests (
    user_id, payout_route_id, status, requested_usd_amount, currency_code, idempotency_key
  ) VALUES (
    p_actor_user_id, p_payout_route_id, 'requested', total_amount, 'USD', p_idempotency_key
  ) RETURNING * INTO created;

  INSERT INTO public.user_withdrawal_request_credits (
    withdrawal_request_id, bookkeeping_credit_id, reserved_usd_amount
  )
  SELECT created.id, credit.id, credit.usd_equivalent_amount
  FROM public.monthly_cycle_bookkeeping_credits credit
  WHERE credit.id = ANY(credit_ids);

  RETURN QUERY SELECT created.id, created.payout_route_id, created.status,
    created.requested_usd_amount, created.currency_code, selected_count, created.requested_at, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_withdrawal_request(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_withdrawal_request(uuid, bigint, text) TO service_role;
