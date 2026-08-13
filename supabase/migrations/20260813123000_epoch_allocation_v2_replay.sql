-- Preserve exact successful v2 calculations as idempotent replays after the
-- manifest has advanced from locked to calculated.

ALTER FUNCTION public.record_funded_epoch_allocation_v2(jsonb)
  RENAME TO record_funded_epoch_allocation_v2_once;

CREATE FUNCTION public.record_funded_epoch_allocation_v2(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing public.epoch_allocation_runs%ROWTYPE;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_result.v2'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_allocation_runtime_disabled';
  END IF;
  SELECT run.* INTO v_existing FROM public.epoch_allocation_runs run
  WHERE run.manifest_id=(p_command->>'manifestId')::bigint;
  IF FOUND THEN
    IF v_existing.result_hash<>p_command->>'resultHash' THEN
      RAISE EXCEPTION 'epoch_allocation_result_conflict';
    END IF;
    RETURN v_existing.id;
  END IF;
  RETURN public.record_funded_epoch_allocation_v2_once(p_command);
END; $$;

REVOKE ALL ON FUNCTION public.record_funded_epoch_allocation_v2_once(jsonb),
  public.record_funded_epoch_allocation_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_funded_epoch_allocation_v2(jsonb) TO service_role;
