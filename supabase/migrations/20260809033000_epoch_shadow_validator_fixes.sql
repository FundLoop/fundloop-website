CREATE TABLE public.epoch_stage_gate_requirements (
  expected_stage text NOT NULL,
  target_stage text NOT NULL,
  gate_key text NOT NULL,
  gate_type text NOT NULL DEFAULT 'hard',
  override_allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (expected_stage, target_stage, gate_key),
  CONSTRAINT epoch_gate_requirements_type_check CHECK (gate_type IN ('hard', 'soft')),
  CONSTRAINT epoch_gate_requirements_key_check CHECK (gate_key ~ '^[a-z][a-z0-9:_-]*$')
);

INSERT INTO public.epoch_stage_gate_requirements (expected_stage, target_stage, gate_key, gate_type, override_allowed) VALUES
  ('collecting', 'reconciling', 'collection_cutoff_reached', 'hard', false),
  ('reconciling', 'valuing', 'reconciliation_complete', 'hard', true),
  ('valuing', 'fee_processing', 'valuation_complete', 'hard', true),
  ('fee_processing', 'carryover_payouts', 'fee_review_complete', 'hard', true),
  ('carryover_payouts', 'locking', 'carryover_payouts_reviewed', 'hard', true),
  ('locking', 'allocating', 'input_manifest_locked', 'hard', false),
  ('allocating', 'reviewing', 'allocation_complete', 'hard', true),
  ('reviewing', 'payout_readying', 'opt_out_window_closed', 'hard', false),
  ('payout_readying', 'payout_open', 'payout_readiness_complete', 'hard', true),
  ('payout_open', 'expired', 'payout_window_expired', 'hard', false),
  ('expired', 'closed', 'carryover_complete', 'hard', false);

ALTER TABLE public.epoch_shadow_states
  ADD COLUMN stage_ready_at timestamptz,
  ADD COLUMN opt_out_email_delivered_at timestamptz,
  ADD COLUMN payout_opened_at timestamptz,
  ADD COLUMN carryover_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN business_calendar_region text NOT NULL DEFAULT 'US-CA';

CREATE TABLE public.epoch_business_calendars (
  region_key text PRIMARY KEY,
  timezone_name text NOT NULL DEFAULT 'America/Los_Angeles',
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_business_calendars_production_check CHECK (production_enabled = false)
);
INSERT INTO public.epoch_business_calendars (region_key) VALUES ('US-CA');
ALTER TABLE public.epoch_business_calendar
  ADD COLUMN calendar_region text NOT NULL DEFAULT 'US-CA' REFERENCES public.epoch_business_calendars(region_key) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.epoch_shadow_states
  ADD CONSTRAINT epoch_shadow_states_calendar_fk FOREIGN KEY (business_calendar_region)
    REFERENCES public.epoch_business_calendars(region_key) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE UNIQUE INDEX epoch_business_calendar_region_date_idx ON public.epoch_business_calendar (calendar_region, calendar_date);

ALTER TABLE public.epoch_stage_overrides ADD COLUMN attempt_id bigint REFERENCES public.epoch_stage_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE UNIQUE INDEX epoch_stage_overrides_attempt_gate_idx ON public.epoch_stage_overrides (attempt_id, gate_key) WHERE attempt_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_epoch_shadow_attempt(
  p_shadow_state_id bigint, p_target_stage text, p_expected_stage text,
  p_expected_state_version bigint, p_idempotency_key text, p_input_manifest_hash text,
  p_trigger_type text, p_actor_user_id uuid, p_scheduled_for timestamptz,
  p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state public.epoch_shadow_states%ROWTYPE; v_existing public.epoch_stage_attempts%ROWTYPE;
  v_sequence bigint; v_attempt_id bigint;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(p_shadow_state_id);
  SELECT * INTO v_existing FROM public.epoch_stage_attempts WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.shadow_state_id <> p_shadow_state_id OR v_existing.target_stage <> p_target_stage
      OR v_existing.expected_stage <> p_expected_stage OR v_existing.expected_state_version <> p_expected_state_version
      OR v_existing.input_manifest_hash <> p_input_manifest_hash OR v_existing.trigger_type <> p_trigger_type
      OR v_existing.actor_user_id IS DISTINCT FROM p_actor_user_id OR v_existing.scheduled_for <> p_scheduled_for
    THEN RAISE EXCEPTION 'epoch_shadow_idempotency_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  SELECT * INTO v_state FROM public.epoch_shadow_states WHERE id = p_shadow_state_id FOR UPDATE;
  IF NOT FOUND OR v_state.production_enabled THEN RAISE EXCEPTION 'epoch_shadow_state_unavailable'; END IF;
  IF v_state.is_paused THEN RAISE EXCEPTION 'epoch_shadow_state_paused'; END IF;
  IF v_state.current_stage <> p_expected_stage OR v_state.state_version <> p_expected_state_version THEN
    RAISE EXCEPTION 'epoch_shadow_optimistic_guard_failed';
  END IF;
  IF public.epoch_shadow_next_stage(v_state.current_stage) IS DISTINCT FROM p_target_stage THEN
    RAISE EXCEPTION 'epoch_shadow_transition_invalid';
  END IF;
  SELECT coalesce(max(attempt_sequence), 0) + 1 INTO v_sequence FROM public.epoch_stage_attempts WHERE shadow_state_id = p_shadow_state_id;
  INSERT INTO public.epoch_stage_attempts (
    shadow_state_id, target_stage, expected_stage, expected_state_version, attempt_sequence,
    idempotency_key, input_manifest_hash, trigger_type, actor_user_id, scheduled_for
  ) VALUES (p_shadow_state_id, p_target_stage, p_expected_stage, p_expected_state_version, v_sequence,
    p_idempotency_key, p_input_manifest_hash, p_trigger_type, p_actor_user_id, p_scheduled_for)
  RETURNING id INTO v_attempt_id;
  RETURN v_attempt_id;
END;
$$;

DROP FUNCTION public.record_epoch_stage_override(bigint,text,text,uuid,text,text,text);
CREATE FUNCTION public.record_epoch_stage_override(
  p_attempt_id bigint, p_gate_key text, p_actor_user_id uuid, p_actor_context text,
  p_reason text, p_evidence_hash text, p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint; v_attempt public.epoch_stage_attempts%ROWTYPE;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR p_actor_context <> 'internal_admin' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  SELECT * INTO v_attempt FROM public.epoch_stage_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'claimed' OR v_attempt.actor_user_id IS DISTINCT FROM p_actor_user_id
    OR NOT EXISTS (SELECT 1 FROM public.epoch_stage_gate_requirements requirement
      WHERE requirement.expected_stage = v_attempt.expected_stage AND requirement.target_stage = v_attempt.target_stage
        AND requirement.gate_key = p_gate_key AND requirement.override_allowed)
  THEN RAISE EXCEPTION 'epoch_shadow_override_context_invalid'; END IF;
  INSERT INTO public.epoch_stage_overrides (
    shadow_state_id, attempt_id, stage, gate_key, actor_user_id, reason, evidence_hash
  ) VALUES (v_attempt.shadow_state_id, p_attempt_id, v_attempt.expected_stage, p_gate_key, p_actor_user_id, p_reason, p_evidence_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_epoch_shadow_attempt(
  p_attempt_id bigint, p_claim_token uuid, p_succeeded boolean,
  p_gate_results jsonb, p_artifacts jsonb, p_failure_code text,
  p_completed_at timestamptz, p_deployment_environment text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt public.epoch_stage_attempts%ROWTYPE; v_state public.epoch_shadow_states%ROWTYPE;
  v_gate jsonb; v_artifact jsonb; v_blocked boolean; v_missing boolean;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  SELECT * INTO v_attempt FROM public.epoch_stage_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'claimed' OR v_attempt.claim_token <> p_claim_token THEN RAISE EXCEPTION 'epoch_shadow_claim_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_attempt.shadow_state_id);
  SELECT * INTO v_state FROM public.epoch_shadow_states WHERE id = v_attempt.shadow_state_id FOR UPDATE;
  IF v_state.current_stage <> v_attempt.expected_stage OR v_state.state_version <> v_attempt.expected_state_version OR v_state.is_paused THEN
    UPDATE public.epoch_stage_attempts SET status = 'superseded', completed_at = p_completed_at, failure_code = 'optimistic_guard_failed' WHERE id = p_attempt_id;
    RETURN 'superseded';
  END IF;
  IF jsonb_typeof(p_gate_results) <> 'array' OR jsonb_typeof(p_artifacts) <> 'array' THEN RAISE EXCEPTION 'epoch_shadow_completion_payload_invalid'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.epoch_stage_gate_requirements requirement
    WHERE requirement.expected_stage = v_attempt.expected_stage AND requirement.target_stage = v_attempt.target_stage
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_gate_results) supplied WHERE supplied->>'gateKey' = requirement.gate_key)) INTO v_missing;
  IF v_missing THEN
    UPDATE public.epoch_stage_attempts SET status = 'failed', completed_at = p_completed_at, failure_code = 'required_gate_missing' WHERE id = p_attempt_id;
    RETURN 'failed';
  END IF;
  FOR v_gate IN SELECT value FROM jsonb_array_elements(p_gate_results) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.epoch_stage_gate_requirements requirement
      WHERE requirement.expected_stage = v_attempt.expected_stage AND requirement.target_stage = v_attempt.target_stage
        AND requirement.gate_key = v_gate->>'gateKey' AND requirement.gate_type = v_gate->>'gateType')
    THEN RAISE EXCEPTION 'epoch_shadow_gate_not_required'; END IF;
    IF nullif(v_gate->>'overrideId', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.epoch_stage_overrides override_row
      WHERE override_row.id = (v_gate->>'overrideId')::bigint AND override_row.attempt_id = p_attempt_id
        AND override_row.shadow_state_id = v_attempt.shadow_state_id AND override_row.stage = v_attempt.expected_stage
        AND override_row.gate_key = v_gate->>'gateKey' AND override_row.actor_user_id = v_attempt.actor_user_id
    ) THEN RAISE EXCEPTION 'epoch_shadow_override_context_invalid'; END IF;
    INSERT INTO public.epoch_stage_gate_results (attempt_id, gate_key, gate_type, passed, override_id, evidence_hash, reason_code)
    VALUES (p_attempt_id, v_gate->>'gateKey', v_gate->>'gateType', (v_gate->>'passed')::boolean,
      nullif(v_gate->>'overrideId', '')::bigint, v_gate->>'evidenceHash', v_gate->>'reasonCode');
  END LOOP;
  FOR v_artifact IN SELECT value FROM jsonb_array_elements(p_artifacts) LOOP
    INSERT INTO public.epoch_stage_artifacts (attempt_id, artifact_key, artifact_uri, artifact_hash)
    VALUES (p_attempt_id, v_artifact->>'artifactKey', v_artifact->>'artifactUri', v_artifact->>'artifactHash');
  END LOOP;
  SELECT EXISTS (SELECT 1 FROM public.epoch_stage_gate_results gate_result
    WHERE gate_result.attempt_id = p_attempt_id AND gate_result.gate_type = 'hard'
      AND NOT gate_result.passed AND gate_result.override_id IS NULL) INTO v_blocked;
  UPDATE public.epoch_stage_attempts SET status = CASE WHEN p_succeeded AND NOT v_blocked THEN 'succeeded' ELSE 'failed' END,
    completed_at = p_completed_at, failure_code = CASE WHEN v_blocked THEN 'hard_gate_failed' WHEN p_succeeded THEN NULL ELSE p_failure_code END
  WHERE id = p_attempt_id;
  IF p_succeeded AND NOT v_blocked THEN
    UPDATE public.epoch_shadow_states SET current_stage = v_attempt.target_stage, state_version = state_version + 1,
      stage_ready_at = NULL,
      payout_opened_at = CASE WHEN v_attempt.target_stage = 'payout_open' THEN p_completed_at ELSE payout_opened_at END,
      updated_at = p_completed_at
    WHERE id = v_state.id AND current_stage = v_attempt.expected_stage AND state_version = v_attempt.expected_state_version;
    IF NOT FOUND THEN RAISE EXCEPTION 'epoch_shadow_optimistic_guard_failed'; END IF;
  END IF;
  RETURN CASE WHEN p_succeeded AND NOT v_blocked THEN 'succeeded' ELSE 'failed' END;
END;
$$;

ALTER TABLE public.epoch_stage_gate_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_business_calendars ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.epoch_stage_gate_requirements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.epoch_business_calendars FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.epoch_stage_gate_requirements TO service_role;
GRANT SELECT ON TABLE public.epoch_business_calendars TO service_role;
REVOKE ALL ON FUNCTION public.record_epoch_stage_override(bigint,text,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_epoch_stage_override(bigint,text,uuid,text,text,text,text) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fundloop-epoch-shadow-scheduler') THEN
    PERFORM cron.unschedule('fundloop-epoch-shadow-scheduler');
  END IF;
  PERFORM cron.schedule('fundloop-epoch-shadow-scheduler', '*/5 * * * *', $job$
    DO $invoke$
    DECLARE v_url text; v_anon_key text; v_secret text; v_environment text;
    BEGIN
      SELECT decrypted_secret INTO v_environment FROM vault.decrypted_secrets WHERE name = 'fundloop_deployment_environment';
      IF lower(coalesce(v_environment, 'production')) = 'production' THEN RETURN; END IF;
      SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'fundloop_project_url';
      SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'fundloop_anon_key';
      SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'fundloop_epoch_scheduler_secret';
      IF v_url IS NULL OR v_anon_key IS NULL OR v_secret IS NULL THEN RETURN; END IF;
      PERFORM net.http_post(
        url := rtrim(v_url, '/') || '/functions/v1/epoch-shadow-scheduler',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key,
          'x-fundloop-cron-secret', v_secret), body := '{}'::jsonb
      );
    END $invoke$;
  $job$);
END;
$$;
