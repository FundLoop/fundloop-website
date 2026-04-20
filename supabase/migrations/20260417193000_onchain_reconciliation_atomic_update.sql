CREATE OR REPLACE FUNCTION public.finalize_onchain_payment_reconciliation(
  p_submission_id bigint,
  p_payment_id bigint,
  p_submission_status text,
  p_last_checked_at timestamp with time zone,
  p_confirmation_count integer,
  p_matched_log_index integer,
  p_failure_code text,
  p_failure_reason text,
  p_submission_confirmed_at timestamp with time zone,
  p_submission_reconciled_at timestamp with time zone,
  p_payment_status_id integer,
  p_payment_confirmed_at timestamp with time zone,
  p_payment_note text,
  p_payment_updated_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'insufficient_privilege'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.onchain_payment_submissions
  SET
    status = p_submission_status,
    last_checked_at = p_last_checked_at,
    confirmation_count = p_confirmation_count,
    matched_log_index = p_matched_log_index,
    failure_code = p_failure_code,
    failure_reason = p_failure_reason,
    confirmed_at = p_submission_confirmed_at,
    reconciled_at = p_submission_reconciled_at
  WHERE id = p_submission_id
    AND payment_id IS NOT DISTINCT FROM p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'onchain_payment_submission_not_found';
  END IF;

  IF p_payment_id IS NOT NULL AND p_payment_status_id IS NOT NULL THEN
    UPDATE public.payments
    SET
      status_id = p_payment_status_id,
      confirmed_at = p_payment_confirmed_at,
      updated_at = p_payment_updated_at,
      notes = CASE
        WHEN p_payment_note IS NULL THEN notes
        ELSE p_payment_note
      END
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment_not_found';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_onchain_payment_reconciliation(
  bigint,
  bigint,
  text,
  timestamp with time zone,
  integer,
  integer,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  text,
  timestamp with time zone
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_onchain_payment_reconciliation(
  bigint,
  bigint,
  text,
  timestamp with time zone,
  integer,
  integer,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  text,
  timestamp with time zone
) TO service_role;
