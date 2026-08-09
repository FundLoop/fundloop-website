CREATE TABLE public.epoch_shadow_runtime_controls (
  deployment_environment text PRIMARY KEY,
  scheduler_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_shadow_runtime_environment_check CHECK (deployment_environment ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT epoch_shadow_runtime_production_check CHECK (
    deployment_environment <> 'production'
    OR (scheduler_enabled = false AND production_value_flow_enabled = false)
  ),
  CONSTRAINT epoch_shadow_runtime_value_flow_check CHECK (production_value_flow_enabled = false)
);
INSERT INTO public.epoch_shadow_runtime_controls VALUES
  ('local', true, false), ('development', true, false), ('dev', true, false),
  ('preview', true, false), ('test', true, false), ('production', false, false)
ON CONFLICT (deployment_environment) DO NOTHING;

CREATE TABLE public.epoch_business_calendar (
  calendar_date date PRIMARY KEY,
  is_business_day boolean NOT NULL,
  reason text,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_business_calendar_reason_check CHECK (is_business_day OR nullif(trim(reason), '') IS NOT NULL),
  CONSTRAINT epoch_business_calendar_production_check CHECK (production_enabled = false)
);

CREATE TABLE public.epoch_shadow_states (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accounting_period_id bigint NOT NULL UNIQUE REFERENCES public.accounting_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint UNIQUE REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  current_stage text NOT NULL DEFAULT 'collecting',
  state_version bigint NOT NULL DEFAULT 1,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  legacy_status_snapshot text,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_shadow_states_stage_check CHECK (current_stage IN (
    'collecting', 'reconciling', 'valuing', 'fee_processing', 'carryover_payouts',
    'locking', 'allocating', 'reviewing', 'payout_readying', 'payout_open', 'expired', 'closed'
  )),
  CONSTRAINT epoch_shadow_states_version_check CHECK (state_version > 0),
  CONSTRAINT epoch_shadow_states_pause_check CHECK (NOT is_paused OR nullif(trim(pause_reason), '') IS NOT NULL),
  CONSTRAINT epoch_shadow_states_production_check CHECK (production_enabled = false)
);
CREATE INDEX epoch_shadow_states_stage_idx ON public.epoch_shadow_states (current_stage, accounting_period_id) WHERE current_stage <> 'closed';
CREATE INDEX epoch_shadow_states_paused_idx ON public.epoch_shadow_states (updated_at) WHERE is_paused;

CREATE TABLE public.epoch_stage_overrides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shadow_state_id bigint NOT NULL REFERENCES public.epoch_shadow_states(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  stage text NOT NULL,
  gate_key text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason text NOT NULL,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_stage_overrides_stage_check CHECK (stage IN (
    'collecting', 'reconciling', 'valuing', 'fee_processing', 'carryover_payouts',
    'locking', 'allocating', 'reviewing', 'payout_readying', 'payout_open', 'expired', 'closed'
  )),
  CONSTRAINT epoch_stage_overrides_gate_key_check CHECK (gate_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_stage_overrides_reason_check CHECK (length(trim(reason)) BETWEEN 8 AND 1000),
  CONSTRAINT epoch_stage_overrides_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_stage_overrides_production_check CHECK (production_enabled = false)
);
CREATE INDEX epoch_stage_overrides_state_idx ON public.epoch_stage_overrides (shadow_state_id, stage, created_at DESC);

CREATE TABLE public.epoch_stage_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shadow_state_id bigint NOT NULL REFERENCES public.epoch_shadow_states(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  target_stage text NOT NULL,
  expected_stage text NOT NULL,
  expected_state_version bigint NOT NULL,
  attempt_sequence bigint NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  input_manifest_hash text NOT NULL,
  trigger_type text NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL,
  claim_token uuid,
  worker_id text,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  sanitized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  no_external_call_under_lock boolean NOT NULL DEFAULT true,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_stage_attempts_state_sequence_unique UNIQUE (shadow_state_id, attempt_sequence),
  CONSTRAINT epoch_stage_attempts_target_stage_check CHECK (target_stage IN (
    'collecting', 'reconciling', 'valuing', 'fee_processing', 'carryover_payouts',
    'locking', 'allocating', 'reviewing', 'payout_readying', 'payout_open', 'expired', 'closed'
  )),
  CONSTRAINT epoch_stage_attempts_expected_stage_check CHECK (expected_stage IN (
    'collecting', 'reconciling', 'valuing', 'fee_processing', 'carryover_payouts',
    'locking', 'allocating', 'reviewing', 'payout_readying', 'payout_open', 'expired', 'closed'
  )),
  CONSTRAINT epoch_stage_attempts_version_check CHECK (expected_state_version > 0),
  CONSTRAINT epoch_stage_attempts_sequence_check CHECK (attempt_sequence > 0),
  CONSTRAINT epoch_stage_attempts_idempotency_check CHECK (idempotency_key ~ '^[a-zA-Z0-9:_-]{8,160}$'),
  CONSTRAINT epoch_stage_attempts_manifest_hash_check CHECK (input_manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_stage_attempts_trigger_check CHECK (trigger_type IN ('scheduled', 'manual', 'retry', 'fake_clock')),
  CONSTRAINT epoch_stage_attempts_status_check CHECK (status IN ('queued', 'claimed', 'succeeded', 'failed', 'superseded')),
  CONSTRAINT epoch_stage_attempts_claim_check CHECK (
    (status = 'queued' AND claim_token IS NULL AND worker_id IS NULL AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'claimed' AND claim_token IS NOT NULL AND nullif(trim(worker_id), '') IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed', 'superseded') AND completed_at IS NOT NULL)
  ),
  CONSTRAINT epoch_stage_attempts_metadata_check CHECK (jsonb_typeof(sanitized_metadata) = 'object'),
  CONSTRAINT epoch_stage_attempts_no_external_lock_check CHECK (no_external_call_under_lock = true),
  CONSTRAINT epoch_stage_attempts_production_check CHECK (production_enabled = false)
);
CREATE INDEX epoch_stage_attempts_state_idx ON public.epoch_stage_attempts (shadow_state_id, attempt_sequence DESC);
CREATE INDEX epoch_stage_attempts_queue_idx ON public.epoch_stage_attempts (scheduled_for, id) WHERE status = 'queued';
CREATE INDEX epoch_stage_attempts_claimed_idx ON public.epoch_stage_attempts (started_at, id) WHERE status = 'claimed';

CREATE TABLE public.epoch_stage_gate_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id bigint NOT NULL REFERENCES public.epoch_stage_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  gate_key text NOT NULL,
  gate_type text NOT NULL,
  passed boolean NOT NULL,
  override_id bigint REFERENCES public.epoch_stage_overrides(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_stage_gate_results_attempt_gate_unique UNIQUE (attempt_id, gate_key),
  CONSTRAINT epoch_stage_gate_results_gate_key_check CHECK (gate_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_stage_gate_results_gate_type_check CHECK (gate_type IN ('hard', 'soft')),
  CONSTRAINT epoch_stage_gate_results_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_stage_gate_results_override_check CHECK (override_id IS NULL OR NOT passed)
);
CREATE INDEX epoch_stage_gate_results_attempt_idx ON public.epoch_stage_gate_results (attempt_id);
CREATE INDEX epoch_stage_gate_results_failed_idx ON public.epoch_stage_gate_results (attempt_id, gate_type) WHERE NOT passed;

CREATE TABLE public.epoch_stage_artifacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id bigint NOT NULL REFERENCES public.epoch_stage_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  artifact_key text NOT NULL,
  artifact_uri text NOT NULL,
  artifact_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_stage_artifacts_attempt_key_unique UNIQUE (attempt_id, artifact_key),
  CONSTRAINT epoch_stage_artifacts_key_check CHECK (artifact_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_stage_artifacts_uri_check CHECK (artifact_uri ~ '^(storage|artifact)://'),
  CONSTRAINT epoch_stage_artifacts_hash_check CHECK (artifact_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_stage_artifacts_attempt_idx ON public.epoch_stage_artifacts (attempt_id);

CREATE VIEW public.epoch_shadow_observability WITH (security_invoker = true) AS
SELECT state.id AS shadow_state_id, state.accounting_period_id, state.monthly_cycle_id,
  state.current_stage, state.state_version, state.is_paused, state.pause_reason,
  state.legacy_status_snapshot, state.updated_at,
  latest.id AS latest_attempt_id, latest.target_stage AS latest_target_stage,
  latest.status AS latest_attempt_status, latest.trigger_type AS latest_trigger_type,
  latest.failure_code AS latest_failure_code, latest.started_at, latest.completed_at,
  CASE state.current_stage
    WHEN 'collecting' THEN 'open'
    WHEN 'reconciling' THEN 'prep'
    WHEN 'valuing' THEN 'prep'
    WHEN 'fee_processing' THEN 'prep'
    WHEN 'carryover_payouts' THEN 'prep'
    WHEN 'locking' THEN 'locked'
    WHEN 'allocating' THEN 'calculation'
    WHEN 'reviewing' THEN 'approval'
    WHEN 'payout_readying' THEN 'distribution'
    WHEN 'payout_open' THEN 'distribution'
    WHEN 'expired' THEN 'completed'
    WHEN 'closed' THEN 'reporting'
  END AS legacy_compatibility_status
FROM public.epoch_shadow_states state
LEFT JOIN LATERAL (
  SELECT attempt.* FROM public.epoch_stage_attempts attempt
  WHERE attempt.shadow_state_id = state.id ORDER BY attempt.attempt_sequence DESC LIMIT 1
) latest ON true;

CREATE FUNCTION public.epoch_shadow_next_stage(p_stage text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_stage
    WHEN 'collecting' THEN 'reconciling' WHEN 'reconciling' THEN 'valuing'
    WHEN 'valuing' THEN 'fee_processing' WHEN 'fee_processing' THEN 'carryover_payouts'
    WHEN 'carryover_payouts' THEN 'locking' WHEN 'locking' THEN 'allocating'
    WHEN 'allocating' THEN 'reviewing' WHEN 'reviewing' THEN 'payout_readying'
    WHEN 'payout_readying' THEN 'payout_open' WHEN 'payout_open' THEN 'expired'
    WHEN 'expired' THEN 'closed' ELSE NULL END;
$$;

CREATE FUNCTION public.enqueue_epoch_shadow_attempt(
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
  IF FOUND THEN RETURN v_existing.id; END IF;
  SELECT * INTO v_state FROM public.epoch_shadow_states WHERE id = p_shadow_state_id FOR UPDATE;
  IF NOT FOUND OR v_state.production_enabled THEN RAISE EXCEPTION 'epoch_shadow_state_unavailable'; END IF;
  IF v_state.is_paused THEN RAISE EXCEPTION 'epoch_shadow_state_paused'; END IF;
  IF v_state.current_stage <> p_expected_stage OR v_state.state_version <> p_expected_state_version THEN
    RAISE EXCEPTION 'epoch_shadow_optimistic_guard_failed';
  END IF;
  IF public.epoch_shadow_next_stage(v_state.current_stage) IS DISTINCT FROM p_target_stage THEN
    RAISE EXCEPTION 'epoch_shadow_transition_invalid';
  END IF;
  SELECT coalesce(max(attempt_sequence), 0) + 1 INTO v_sequence
  FROM public.epoch_stage_attempts WHERE shadow_state_id = p_shadow_state_id;
  INSERT INTO public.epoch_stage_attempts (
    shadow_state_id, target_stage, expected_stage, expected_state_version,
    attempt_sequence, idempotency_key, input_manifest_hash, trigger_type,
    actor_user_id, scheduled_for
  ) VALUES (
    p_shadow_state_id, p_target_stage, p_expected_stage, p_expected_state_version,
    v_sequence, p_idempotency_key, p_input_manifest_hash, p_trigger_type,
    p_actor_user_id, p_scheduled_for
  ) RETURNING id INTO v_attempt_id;
  RETURN v_attempt_id;
END;
$$;

CREATE FUNCTION public.claim_epoch_shadow_attempt(
  p_worker_id text, p_now timestamptz, p_deployment_environment text
) RETURNS TABLE (attempt_id bigint, claim_token uuid, shadow_state_id bigint,
  target_stage text, expected_stage text, expected_state_version bigint,
  input_manifest_hash text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  RETURN QUERY
  UPDATE public.epoch_stage_attempts attempt SET status = 'claimed',
    claim_token = extensions.gen_random_uuid(), worker_id = p_worker_id, started_at = p_now
  WHERE attempt.id = (
    SELECT queued.id FROM public.epoch_stage_attempts queued
    JOIN public.epoch_shadow_states state ON state.id = queued.shadow_state_id
    WHERE queued.status = 'queued' AND queued.scheduled_for <= p_now AND NOT state.is_paused
    ORDER BY queued.scheduled_for, queued.id FOR UPDATE OF queued SKIP LOCKED LIMIT 1
  )
  RETURNING attempt.id, attempt.claim_token, attempt.shadow_state_id,
    attempt.target_stage, attempt.expected_stage, attempt.expected_state_version,
    attempt.input_manifest_hash;
END;
$$;

CREATE FUNCTION public.complete_epoch_shadow_attempt(
  p_attempt_id bigint, p_claim_token uuid, p_succeeded boolean,
  p_gate_results jsonb, p_artifacts jsonb, p_failure_code text,
  p_completed_at timestamptz, p_deployment_environment text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt public.epoch_stage_attempts%ROWTYPE; v_state public.epoch_shadow_states%ROWTYPE;
  v_gate jsonb; v_artifact jsonb; v_blocked boolean;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  SELECT * INTO v_attempt FROM public.epoch_stage_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'claimed' OR v_attempt.claim_token <> p_claim_token THEN
    RAISE EXCEPTION 'epoch_shadow_claim_invalid';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_attempt.shadow_state_id);
  SELECT * INTO v_state FROM public.epoch_shadow_states WHERE id = v_attempt.shadow_state_id FOR UPDATE;
  IF v_state.current_stage <> v_attempt.expected_stage OR v_state.state_version <> v_attempt.expected_state_version OR v_state.is_paused THEN
    UPDATE public.epoch_stage_attempts SET status = 'superseded', completed_at = p_completed_at,
      failure_code = 'optimistic_guard_failed' WHERE id = p_attempt_id;
    RETURN 'superseded';
  END IF;
  IF jsonb_typeof(p_gate_results) <> 'array' OR jsonb_typeof(p_artifacts) <> 'array' THEN
    RAISE EXCEPTION 'epoch_shadow_completion_payload_invalid';
  END IF;
  FOR v_gate IN SELECT value FROM jsonb_array_elements(p_gate_results) LOOP
    INSERT INTO public.epoch_stage_gate_results (
      attempt_id, gate_key, gate_type, passed, override_id, evidence_hash, reason_code
    ) VALUES (
      p_attempt_id, v_gate->>'gateKey', v_gate->>'gateType', (v_gate->>'passed')::boolean,
      nullif(v_gate->>'overrideId', '')::bigint, v_gate->>'evidenceHash', v_gate->>'reasonCode'
    );
  END LOOP;
  FOR v_artifact IN SELECT value FROM jsonb_array_elements(p_artifacts) LOOP
    INSERT INTO public.epoch_stage_artifacts (attempt_id, artifact_key, artifact_uri, artifact_hash)
    VALUES (p_attempt_id, v_artifact->>'artifactKey', v_artifact->>'artifactUri', v_artifact->>'artifactHash');
  END LOOP;
  SELECT EXISTS (
    SELECT 1 FROM public.epoch_stage_gate_results gate_result
    WHERE gate_result.attempt_id = p_attempt_id AND gate_result.gate_type = 'hard'
      AND NOT gate_result.passed AND gate_result.override_id IS NULL
  ) INTO v_blocked;
  UPDATE public.epoch_stage_attempts SET status = CASE WHEN p_succeeded AND NOT v_blocked THEN 'succeeded' ELSE 'failed' END,
    completed_at = p_completed_at,
    failure_code = CASE WHEN v_blocked THEN 'hard_gate_failed' WHEN p_succeeded THEN NULL ELSE p_failure_code END
  WHERE id = p_attempt_id;
  IF p_succeeded AND NOT v_blocked THEN
    UPDATE public.epoch_shadow_states SET current_stage = v_attempt.target_stage,
      state_version = state_version + 1, updated_at = p_completed_at
    WHERE id = v_state.id AND current_stage = v_attempt.expected_stage
      AND state_version = v_attempt.expected_state_version;
    IF NOT FOUND THEN RAISE EXCEPTION 'epoch_shadow_optimistic_guard_failed'; END IF;
  END IF;
  RETURN CASE WHEN p_succeeded AND NOT v_blocked THEN 'succeeded' ELSE 'failed' END;
END;
$$;

CREATE FUNCTION public.record_epoch_stage_override(
  p_shadow_state_id bigint, p_stage text, p_gate_key text, p_actor_user_id uuid,
  p_reason text, p_evidence_hash text, p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'epoch_shadow_override_actor_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.epoch_shadow_states state
    WHERE state.id = p_shadow_state_id AND state.current_stage = p_stage AND NOT state.production_enabled)
  THEN RAISE EXCEPTION 'epoch_shadow_override_state_invalid'; END IF;
  INSERT INTO public.epoch_stage_overrides (
    shadow_state_id, stage, gate_key, actor_user_id, reason, evidence_hash
  ) VALUES (p_shadow_state_id, p_stage, p_gate_key, p_actor_user_id, p_reason, p_evidence_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.set_epoch_shadow_pause(
  p_shadow_state_id bigint, p_paused boolean, p_expected_state_version bigint,
  p_reason text, p_actor_user_id uuid, p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_version bigint;
BEGIN
  IF lower(p_deployment_environment) = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.epoch_shadow_runtime_controls control
    WHERE control.deployment_environment = lower(p_deployment_environment)
      AND control.scheduler_enabled AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'epoch_shadow_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'epoch_shadow_pause_evidence_required'; END IF;
  UPDATE public.epoch_shadow_states SET is_paused = p_paused,
    pause_reason = CASE WHEN p_paused THEN p_reason ELSE NULL END,
    state_version = state_version + 1, updated_at = now()
  WHERE id = p_shadow_state_id AND state_version = p_expected_state_version
  RETURNING state_version INTO v_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'epoch_shadow_optimistic_guard_failed'; END IF;
  RETURN v_version;
END;
$$;

ALTER TABLE public.epoch_shadow_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_business_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_shadow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_stage_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_stage_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_stage_gate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_stage_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epoch_shadow_runtime_controls, public.epoch_business_calendar,
  public.epoch_shadow_states, public.epoch_stage_overrides, public.epoch_stage_attempts,
  public.epoch_stage_gate_results, public.epoch_stage_artifacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.epoch_shadow_runtime_controls, public.epoch_business_calendar,
  public.epoch_shadow_states, public.epoch_stage_overrides, public.epoch_stage_attempts,
  public.epoch_stage_gate_results, public.epoch_stage_artifacts TO service_role;
REVOKE ALL ON TABLE public.epoch_shadow_observability FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.epoch_shadow_observability TO service_role;
REVOKE ALL ON FUNCTION public.epoch_shadow_next_stage(text),
  public.enqueue_epoch_shadow_attempt(bigint,text,text,bigint,text,text,text,uuid,timestamptz,text),
  public.claim_epoch_shadow_attempt(text,timestamptz,text),
  public.complete_epoch_shadow_attempt(bigint,uuid,boolean,jsonb,jsonb,text,timestamptz,text),
  public.record_epoch_stage_override(bigint,text,text,uuid,text,text,text),
  public.set_epoch_shadow_pause(bigint,boolean,bigint,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_epoch_shadow_attempt(bigint,text,text,bigint,text,text,text,uuid,timestamptz,text),
  public.claim_epoch_shadow_attempt(text,timestamptz,text),
  public.complete_epoch_shadow_attempt(bigint,uuid,boolean,jsonb,jsonb,text,timestamptz,text),
  public.record_epoch_stage_override(bigint,text,text,uuid,text,text,text),
  public.set_epoch_shadow_pause(bigint,boolean,bigint,text,uuid,text) TO service_role;
