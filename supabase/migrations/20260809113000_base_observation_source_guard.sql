ALTER FUNCTION public.reconcile_base_intake_v2_receipt(jsonb)
  RENAME TO reconcile_base_intake_v2_receipt_trusted_internal;

REVOKE ALL ON FUNCTION public.reconcile_base_intake_v2_receipt_trusted_internal(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.reconcile_base_intake_v2_receipt(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_command->>'observationSource' IS DISTINCT FROM 'trusted_viem_v1' THEN
    RAISE EXCEPTION 'base_intake_v2_trusted_observation_required';
  END IF;
  RETURN public.reconcile_base_intake_v2_receipt_trusted_internal(p_command);
END
$$;

REVOKE ALL ON FUNCTION public.reconcile_base_intake_v2_receipt(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_base_intake_v2_receipt(jsonb) TO service_role;
