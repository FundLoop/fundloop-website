BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE
  v_actor uuid;
  v_project bigint := 1;
  v_cycle bigint;
  v_accounting_period bigint;
  v_payment bigint;
  v_intent bigint;
  v_package bigint;
  v_observation bigint;
BEGIN
  SELECT user_id INTO STRICT v_actor FROM public.users WHERE email = 'maya@fundloop.example.com';

  -- Keep browser acceptance deterministic relative to the real claim-window
  -- guard: 2026-04 is closed at the repository's fixed 2026-08 test date and
  -- has an explicit E-3 origin cycle for harvest evaluation.
  INSERT INTO public.monthly_cycles(cycle_key, year, month, period_start, period_end, status)
  VALUES ('2026-01', 2026, 1, '2026-01-01', '2026-01-31', 'completed')
  ON CONFLICT (cycle_key) DO UPDATE SET status = excluded.status;
  INSERT INTO public.monthly_cycles(cycle_key, year, month, period_start, period_end, status)
  VALUES ('2026-04', 2026, 4, '2026-04-01', '2026-04-30', 'prep')
  ON CONFLICT (cycle_key) DO UPDATE SET status = excluded.status;
  SELECT id INTO v_cycle FROM public.monthly_cycles WHERE cycle_key = '2026-04';

  INSERT INTO public.accounting_periods(period_key, starts_at, ends_at, timezone_name)
  VALUES ('browser_allocation_2026_04', '2026-04-01T07:00:00Z', '2026-05-01T07:00:00Z', 'America/Los_Angeles')
  ON CONFLICT (period_key) DO UPDATE SET status = 'open', closed_at = NULL, close_evidence_hash = NULL
  RETURNING id INTO v_accounting_period;

  INSERT INTO public.payments(project_id, period_start, period_end, revenue, payment_amount, payment_percentage, monthly_cycle_id)
  VALUES (v_project, '2026-04-01', '2026-04-30', 100, 100, 100, v_cycle)
  RETURNING id INTO v_payment;

  INSERT INTO public.stripe_bank_transfer_intents(
    project_id, payment_id, accounting_period_id, actor_user_id, currency_code, expected_amount_minor,
    provider_account_id, provider_customer_id, provider_payment_intent_id, instruction_evidence_hash,
    deployment_environment
  )
  VALUES (
    v_project, v_payment, v_accounting_period, v_actor, 'USD', 10000, 'acct_allocation', 'cus_allocation', 'pi_allocation',
    repeat('1', 64), 'local'
  )
  RETURNING id INTO v_intent;

  -- A funding source may only be packaged after authoritative settlement has
  -- claimed the payment's one rail. This committed browser fixture models that
  -- invariant explicitly instead of bypassing the provider provenance guard.
  INSERT INTO public.project_payment_settled_rail_claims(
    payment_id, rail_key, command_reference, evidence_hash
  )
  VALUES (v_payment, 'stripe_bank_transfer', v_intent::text, repeat('1', 64));

  INSERT INTO public.epoch_project_packages(
    project_id, intended_cycle_id, canonical_cycle_id, version, status, list_status, funding_status,
    compliance_status, cubid_status, cutoff_at, frozen_at, approved_at, approved_by_user_id,
    project_fee_assessed_once, base_fee_deferred, payment_count, funding_source_count, cohort_count,
    eligible_user_count, preliminary_usd, manifest, manifest_hash, created_by_user_id
  )
  VALUES (
    v_project, v_cycle, v_cycle, 1, 'approved', 'valid', 'settled', 'passed', 'eligible',
    '2026-05-01T07:00:00Z', '2026-05-01T07:00:00Z', '2026-05-02T00:00:00Z', v_actor,
    false, true, 1, 1, 1, 1, 100, '{}', repeat('2', 64), v_actor
  )
  RETURNING id INTO v_package;

  INSERT INTO public.epoch_project_package_funding_sources(
    package_id, source_position, source_kind, stripe_intent_id, asset_code, native_atomic_amount,
    preliminary_usd, source_evidence_hash, project_fee_assessed_once, base_fee_deferred
  )
  VALUES (v_package, 0, 'stripe_bank_transfer', v_intent, 'USD', 10000, 100, repeat('3', 64), false, true);

  INSERT INTO public.epoch_project_package_cohort(
    package_id, source_row_id, user_id, project_pseudonym, cubid_decision, eligibility_status,
    locked_cubid_score, locked_max_cubid_score, cubid_evidence_at, cubid_evidence_expires_at, evidence_hash
  )
  VALUES (
    v_package, 101, v_actor, repeat('4', 64), 'valid', 'eligible', 10, 20,
    '2026-04-30T00:00:00Z', '2026-05-02T00:00:00Z', repeat('5', 64)
  );

  v_observation := public.record_epoch_fx_observation(jsonb_build_object(
    'contractVersion', 'epoch_fx_observation.v1',
    'deploymentEnvironment', 'local',
    'cycleKey', '2026-04',
    'assetKey', 'stripe_sandbox_usd',
    'sourceKey', 'allocation_primary',
    'sourceRank', 1,
    'rateUsdPerUnit', '1',
    'observedAt', clock_timestamp(),
    'freshnessExpiresAt', clock_timestamp() + interval '1 hour',
    'reasonabilityStatus', 'eligible',
    'evidenceHash', repeat('6', 64),
    'actorUserId', v_actor
  ));

  PERFORM public.post_epoch_fx_snapshot(jsonb_build_object(
    'contractVersion', 'epoch_fx_snapshot.v1',
    'deploymentEnvironment', 'local',
    'cycleKey', '2026-04',
    'assetKey', 'stripe_sandbox_usd',
    'method', 'primary',
    'observationId', v_observation,
    'preanalysis', jsonb_build_object('fresh', true),
    'evidenceHash', repeat('7', 64),
    'actorUserId', v_actor
  ));

  IF public.prepare_epoch_financial_sources(jsonb_build_object(
    'contractVersion', 'epoch_financial_prep.v1',
    'deploymentEnvironment', 'local',
    'packageId', v_package,
    'actorUserId', v_actor
  )) <> 1 THEN
    RAISE EXCEPTION 'allocation source prep failed';
  END IF;

  UPDATE public.epoch_shadow_states
  SET monthly_cycle_id = v_cycle, current_stage = 'reviewing', state_version = 100, is_paused = false
  WHERE accounting_period_id = (
    SELECT id FROM public.accounting_periods WHERE period_key = 'local_review_2026_08'
  );

  INSERT INTO public.participants(project_id, user_id, is_admin)
  VALUES (v_project, v_actor, true)
  ON CONFLICT (project_id, user_id) DO UPDATE SET is_admin = true;
END;
$$;

ROLLBACK;
