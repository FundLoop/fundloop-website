\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE state_id bigint; attempt_one bigint; attempt_same bigint; attempt_two bigint; failed_attempt bigint; retry_attempt bigint; override_id bigint;
  claim_one record; claim_two record; failed_claim record; retry_claim record; result text; before_status text; after_status text;
BEGIN
  SELECT id INTO state_id FROM public.epoch_shadow_states LIMIT 1;
  IF state_id IS NULL THEN RAISE EXCEPTION 'missing seeded shadow state'; END IF;
  SELECT status INTO before_status FROM public.monthly_cycles WHERE id = (SELECT monthly_cycle_id FROM public.epoch_shadow_states WHERE id = state_id);

  BEGIN
    PERFORM public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
      'epoch:production:blocked', repeat('a',64), 'scheduled', null, now(), 'production');
    RAISE EXCEPTION 'production enqueue unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%epoch_shadow_runtime_disabled%' THEN RAISE; END IF;
  END;

  attempt_one := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:first', repeat('a',64), 'scheduled', null, now(), 'local');
  attempt_same := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:first', repeat('a',64), 'manual', null, now(), 'local');
  IF attempt_one <> attempt_same THEN RAISE EXCEPTION 'idempotency failed'; END IF;
  attempt_two := public.enqueue_epoch_shadow_attempt(state_id, 'reconciling', 'collecting', 1,
    'epoch:test:concurrent', repeat('b',64), 'manual', null, now(), 'local');

  SELECT * INTO claim_one FROM public.claim_epoch_shadow_attempt('worker-one', now(), 'local');
  SELECT * INTO claim_two FROM public.claim_epoch_shadow_attempt('worker-two', now(), 'local');
  IF claim_one.attempt_id = claim_two.attempt_id THEN RAISE EXCEPTION 'skip locked claim reused a row'; END IF;

  result := public.complete_epoch_shadow_attempt(claim_one.attempt_id, claim_one.claim_token, true,
    '[{"gateKey":"shadow_only","gateType":"hard","passed":true,"evidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]',
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
  SELECT * INTO failed_claim FROM public.claim_epoch_shadow_attempt('gate-worker', now(), 'local');
  result := public.complete_epoch_shadow_attempt(failed_claim.attempt_id, failed_claim.claim_token, true,
    '[{"gateKey":"operator_review","gateType":"hard","passed":false,"evidenceHash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}]',
    '[]', null, now(), 'local');
  IF result <> 'failed' OR (SELECT current_stage FROM public.epoch_shadow_states WHERE id = state_id) <> 'reconciling'
    THEN RAISE EXCEPTION 'hard gate did not block advancement'; END IF;

  override_id := public.record_epoch_stage_override(state_id, 'reconciling', 'operator_review',
    'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', 'single admin reviewed evidence', repeat('d',64), 'local');
  retry_attempt := public.enqueue_epoch_shadow_attempt(state_id, 'valuing', 'reconciling', 4,
    'epoch:test:retry', repeat('d',64), 'retry', 'd014ec60-98c7-4c71-bb09-d9ee1f2d19aa', now(), 'local');
  SELECT * INTO retry_claim FROM public.claim_epoch_shadow_attempt('retry-worker', now(), 'local');
  result := public.complete_epoch_shadow_attempt(retry_claim.attempt_id, retry_claim.claim_token, true,
    format('[{"gateKey":"operator_review","gateType":"hard","passed":false,"overrideId":"%s","evidenceHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]', override_id)::jsonb,
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
