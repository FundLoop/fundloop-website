\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fundloop-epoch-shadow-scheduler' AND schedule = '*/5 * * * *')
    THEN RAISE EXCEPTION 'epoch scheduler cron is not installed'; END IF;
END $$;

DO $$
DECLARE state_id bigint; missing_attempt bigint; attempt_one bigint; attempt_same bigint; attempt_two bigint; failed_attempt bigint; retry_attempt bigint; override_id bigint;
  missing_claim record; claim_one record; recovered_claim record; claim_two record; failed_claim record; retry_claim record; result text; before_status text; after_status text;
  scheduled_at timestamptz := clock_timestamp();
BEGIN
  SELECT id INTO state_id FROM public.epoch_shadow_states LIMIT 1;
  IF state_id IS NULL THEN RAISE EXCEPTION 'missing seeded shadow state'; END IF;
  SELECT status INTO before_status FROM public.monthly_cycles WHERE id = (SELECT monthly_cycle_id FROM public.epoch_shadow_states WHERE id = state_id);

  BEGIN
    PERFORM public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
      'epoch:production:blocked', repeat('a',64), 'scheduled', null, scheduled_at, 'production');
    RAISE EXCEPTION 'production enqueue unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%epoch_shadow_runtime_disabled%' THEN RAISE; END IF;
  END;

  missing_attempt := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:missing-gate', repeat('0',64), 'scheduled', null, scheduled_at, 'local');
  SELECT * INTO missing_claim FROM public.claim_epoch_shadow_attempt('missing-gate-worker', scheduled_at, 'local');
  result := public.complete_epoch_shadow_attempt(missing_claim.attempt_id, missing_claim.claim_token, true, '[]', '[]', null, scheduled_at, 'local');
  IF result <> 'failed' OR (SELECT failure_code FROM public.epoch_stage_attempts WHERE id = missing_attempt) <> 'required_gate_missing'
    THEN RAISE EXCEPTION 'empty required gates advanced collecting'; END IF;

  attempt_one := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:first', repeat('a',64), 'scheduled', null, scheduled_at, 'local');
  attempt_same := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:first', repeat('a',64), 'scheduled', null, scheduled_at, 'local');
  IF attempt_one <> attempt_same THEN RAISE EXCEPTION 'idempotency failed'; END IF;
  BEGIN
    PERFORM public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
      'epoch:test:first', repeat('f',64), 'scheduled', null, scheduled_at, 'local');
    RAISE EXCEPTION 'changed idempotency payload unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%epoch_shadow_idempotency_conflict%' THEN RAISE; END IF; END;
  attempt_two := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:concurrent', repeat('b',64), 'manual', null, scheduled_at, 'local');

  SELECT * INTO claim_one FROM public.claim_epoch_shadow_attempt('worker-one', scheduled_at + interval '1 second', 'local');
  SELECT * INTO recovered_claim FROM public.claim_epoch_shadow_attempt('recovery-worker', scheduled_at + interval '10 minutes', 'local');
  IF recovered_claim.attempt_id<>claim_one.attempt_id OR recovered_claim.claim_token=claim_one.claim_token THEN RAISE EXCEPTION 'expired claim was not recovered';END IF;
  claim_one:=recovered_claim;
  SELECT * INTO claim_two FROM public.claim_epoch_shadow_attempt('worker-two', scheduled_at + interval '1 second', 'local');
  IF claim_one.attempt_id = claim_two.attempt_id THEN RAISE EXCEPTION 'skip locked claim reused a row'; END IF;

  result := public.complete_epoch_shadow_attempt(claim_one.attempt_id, claim_one.claim_token, true,
    '[{"gateKey":"collection_cutoff_reached","gateType":"hard","passed":true,"evidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]',
    '[]', null, now(), 'local');
  IF result <> 'succeeded' THEN RAISE EXCEPTION 'first completion failed'; END IF;
  result := public.complete_epoch_shadow_attempt(claim_two.attempt_id, claim_two.claim_token, true, '[]', '[]', null, now(), 'local');
  IF result <> 'superseded' THEN RAISE EXCEPTION 'optimistic concurrency did not supersede'; END IF;

  SELECT status INTO after_status FROM public.monthly_cycles WHERE id = (SELECT monthly_cycle_id FROM public.epoch_shadow_states WHERE id = state_id);
  IF before_status IS DISTINCT FROM after_status THEN RAISE EXCEPTION 'shadow transition mutated legacy outcome'; END IF;

  PERFORM public.set_epoch_shadow_pause(state_id, true, 2, 'operator review pause',
    'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', 'local');
  BEGIN
    PERFORM public.enqueue_epoch_shadow_attempt(state_id, 'valuing', 'reconciling', 3,
      'epoch:test:paused', repeat('c',64), 'manual', null, now(), 'local');
    RAISE EXCEPTION 'paused enqueue unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%epoch_shadow_state_paused%' THEN RAISE; END IF; END;
  PERFORM public.set_epoch_shadow_pause(state_id, false, 3, 'operator review resume',
    'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', 'local');

  failed_attempt := public.enqueue_epoch_shadow_attempt(state_id, 'valuing', 'reconciling', 4,
    'epoch:test:hard-gate', repeat('c',64), 'manual', 'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', now(), 'local');
  SELECT * INTO failed_claim FROM public.claim_epoch_shadow_attempt('gate-worker', clock_timestamp() + interval '1 second', 'local');
  result := public.complete_epoch_shadow_attempt(failed_claim.attempt_id, failed_claim.claim_token, true,
    '[{"gateKey":"reconciliation_complete","gateType":"hard","passed":false,"evidenceHash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}]',
    '[]', null, now(), 'local');
  IF result <> 'failed' OR (SELECT current_stage FROM public.epoch_shadow_states WHERE id = state_id) <> 'reconciling'
    THEN RAISE EXCEPTION 'hard gate did not block advancement'; END IF;

  retry_attempt := public.enqueue_epoch_shadow_attempt(state_id, 'valuing', 'reconciling', 4,
    'epoch:test:retry', repeat('d',64), 'retry', 'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', now(), 'local');
  SELECT * INTO retry_claim FROM public.claim_epoch_shadow_attempt('retry-worker', clock_timestamp() + interval '1 second', 'local');
  override_id := public.record_epoch_stage_override(retry_attempt, 'reconciliation_complete',
    'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', 'internal_admin', 'single admin reviewed evidence', repeat('d',64), 'local');
  BEGIN
    PERFORM public.record_epoch_stage_override(retry_attempt, 'valuation_complete',
      'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', 'internal_admin', 'unrelated gate evidence', repeat('e',64), 'local');
    RAISE EXCEPTION 'unrelated override unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%epoch_shadow_override_context_invalid%' THEN RAISE; END IF; END;
  result := public.complete_epoch_shadow_attempt(retry_claim.attempt_id, retry_claim.claim_token, true,
    format('[{"gateKey":"reconciliation_complete","gateType":"hard","passed":false,"overrideId":"%s","evidenceHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]', override_id)::jsonb,
    '[{"artifactKey":"review_manifest","artifactUri":"artifact://local/review","artifactHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]',
    null, now(), 'local');
  IF result <> 'succeeded' OR (SELECT current_stage FROM public.epoch_shadow_states WHERE id = state_id) <> 'valuing'
    THEN RAISE EXCEPTION 'audited override retry did not advance'; END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.epoch_shadow_observability;
    RAISE EXCEPTION 'authenticated observability read unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.claim_epoch_shadow_attempt('browser', now(), 'local');
    RAISE EXCEPTION 'authenticated RPC unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

ROLLBACK;
