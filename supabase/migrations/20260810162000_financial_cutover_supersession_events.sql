-- Preserve immutable supersession evidence for both same-environment and
-- cross-environment replacements. The prior wrapper could observe only runs
-- that remained active after its renamed inner implementation returned.

ALTER FUNCTION public.activate_financial_cutover(uuid,jsonb)
  RENAME TO activate_financial_cutover_without_complete_supersession_events;

CREATE FUNCTION public.activate_financial_cutover(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(trim(p_command->>'deploymentEnvironment'));
  v_target_run_id bigint:=(p_command->>'runId')::bigint;
  v_prior_active_ids bigint[];
  v_result jsonb;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover-instance',0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover:'||v_environment,0));
  SELECT coalesce(array_agg(run.id ORDER BY run.id),'{}'::bigint[]) INTO v_prior_active_ids
  FROM public.financial_cutover_runs run WHERE run.status='active' AND run.id<>v_target_run_id;

  v_result:=public.activate_financial_cutover_without_complete_supersession_events(p_actor_user_id,p_command);

  INSERT INTO public.financial_cutover_state_events(run_id,event_type,actor_user_id,evidence_hash,detail)
  SELECT run.id,'superseded',p_actor_user_id,p_command->>'evidenceHash',
    jsonb_build_object('supersededByRunId',v_target_run_id,'singletonActiveRun',true)
  FROM public.financial_cutover_runs run
  WHERE run.id=ANY(v_prior_active_ids) AND run.status='superseded'
    AND NOT EXISTS(
      SELECT 1 FROM public.financial_cutover_state_events event
      WHERE event.run_id=run.id AND event.event_type='superseded'
    );
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.activate_financial_cutover_without_complete_supersession_events(uuid,jsonb),
  public.activate_financial_cutover(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.activate_financial_cutover(uuid,jsonb) TO service_role;
