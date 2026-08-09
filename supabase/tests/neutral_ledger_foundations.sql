\set ON_ERROR_STOP on

BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.ledger_transactions (
      accounting_period_id, contract_version, transaction_type, idempotency_key,
      command_hash, evidence_hash, actor_type, deployment_environment, effective_at
    ) SELECT id, 'ledger_post.v1', 'direct_write', 'direct-write-denied', repeat('a', 64),
      repeat('b', 64), 'operator', 'local', now()
      FROM public.accounting_periods WHERE period_key = 'local_review_2026_08';
    RAISE EXCEPTION 'authenticated direct ledger write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.post_neutral_ledger_transaction('{}'::jsonb);
    RAISE EXCEPTION 'authenticated posting RPC execution was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
INSERT INTO public.financial_assets (
  asset_key, rail_key, symbol, atomic_scale, classification_metadata
) VALUES (
  'local_review_eur', 'local_fixture', 'EUR', 6,
  '{"purpose":"asset_custody_mismatch_test","approved":false}'::jsonb
);
INSERT INTO public.financial_custody_accounts (
  custody_key, asset_id, provider_key, external_reference_hash, classification_metadata
) SELECT 'local_review_eur_custody', id, 'local_fixture', repeat('d', 64),
  '{"purpose":"posting_reference_mismatch_test","approved":false}'::jsonb
FROM public.financial_assets WHERE asset_key = 'local_review_eur';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.financial_references (
      reference_key, reference_type, asset_id, custody_account_id,
      native_atomic_limit, evidence_hash
    ) SELECT 'mismatched_eur_usd_reference', 'local_test_fixture', eur.id, usd_custody.id,
      1, repeat('e', 64)
    FROM public.financial_assets eur
    CROSS JOIN public.financial_custody_accounts usd_custody
    WHERE eur.asset_key = 'local_review_eur' AND usd_custody.custody_key = 'local_review_custody';
    RAISE EXCEPTION 'mismatched EUR asset and USD custody reference was allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;

SET LOCAL ROLE service_role;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'reference-no-native-denied-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
      'evidenceHash', repeat('7', 64), 'actorType', 'service', 'financialReferenceKey', 'local_review_reference',
      'postings', jsonb_build_array(
        jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'functionalUsdAmount', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
        jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'functionalUsdAmount', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
      )
    ));
    SET CONSTRAINTS ledger_reference_posting_context IMMEDIATE;
    RAISE EXCEPTION 'financial reference without native postings was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_reference_posting_context_mismatch' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ledger_reference_posting_context DEFERRED;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'reference-unrelated-pair-denied-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
      'evidenceHash', repeat('8', 64), 'actorType', 'service', 'financialReferenceKey', 'local_review_reference',
      'postings', jsonb_build_array(
        jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_eur', 'custodyKey', 'local_review_eur_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
        jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_eur', 'custodyKey', 'local_review_eur_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
      )
    ));
    SET CONSTRAINTS ledger_reference_posting_context IMMEDIATE;
    RAISE EXCEPTION 'financial reference with unrelated asset and custody was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_reference_posting_context_mismatch' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ledger_reference_posting_context DEFERRED;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'production',
      'idempotencyKey', 'production-denied-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
      'evidenceHash', repeat('1', 64), 'actorType', 'service', 'postings', jsonb_build_array('{}'::jsonb, '{}'::jsonb)
    ));
    RAISE EXCEPTION 'production neutral posting was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'neutral_ledger_runtime_disabled' THEN RAISE; END IF;
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'unbalanced-denied-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
      'evidenceHash', repeat('2', 64), 'actorType', 'service',
      'postings', jsonb_build_array(
        jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
        jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000002', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
      )
    ));
    RAISE EXCEPTION 'unbalanced neutral transaction was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_transaction_unbalanced' THEN RAISE; END IF;
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'outside-period-post-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-09-01T07:00:00Z',
      'evidenceHash', repeat('f', 64), 'actorType', 'service',
      'postings', jsonb_build_array(
        jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1', 'functionalUsdAmount', '0.000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
        jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1', 'functionalUsdAmount', '0.000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
      )
    ));
    RAISE EXCEPTION 'out-of-period posting was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_effective_at_outside_period' THEN RAISE; END IF;
  END;
END $$;

SELECT public.post_neutral_ledger_transaction(jsonb_build_object(
  'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
  'idempotencyKey', 'balanced-neutral-001', 'transactionType', 'neutral_review',
  'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
  'evidenceHash', repeat('3', 64), 'actorType', 'operator',
  'actorUserId', '00000000-0000-4000-8000-000000000101',
  'financialReferenceKey', 'local_review_reference',
  'postings', jsonb_build_array(
    jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
    jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
  )
)) AS posted_transaction_id \gset

SELECT public.post_neutral_ledger_transaction(jsonb_build_object(
  'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
  'idempotencyKey', 'balanced-neutral-001', 'transactionType', 'neutral_review',
  'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
  'evidenceHash', repeat('3', 64), 'actorType', 'operator',
  'actorUserId', '00000000-0000-4000-8000-000000000101',
  'financialReferenceKey', 'local_review_reference',
  'postings', jsonb_build_array(
    jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
    jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1000000', 'functionalUsdAmount', '1.000000000000000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
  )
)) AS replayed_transaction_id \gset

DO $$ BEGIN
  IF (SELECT count(*) FROM public.ledger_transactions WHERE idempotency_key = 'balanced-neutral-001') <> 1 THEN RAISE EXCEPTION 'idempotent transaction count mismatch'; END IF;
  IF (SELECT count(*) FROM public.ledger_postings posting JOIN public.ledger_transactions transaction_row ON transaction_row.id = posting.transaction_id WHERE transaction_row.idempotency_key = 'balanced-neutral-001') <> 2 THEN RAISE EXCEPTION 'balanced posting count mismatch'; END IF;
  IF (SELECT sum(posting.functional_usd_amount) FROM public.ledger_postings posting JOIN public.ledger_transactions transaction_row ON transaction_row.id = posting.transaction_id WHERE transaction_row.idempotency_key = 'balanced-neutral-001' AND posting.side = 'debit')
    <> 1.000000000000000001::numeric THEN RAISE EXCEPTION 'exact functional USD amount changed'; END IF;
  IF (SELECT sum(posting.native_atomic_amount) FROM public.ledger_postings posting JOIN public.ledger_transactions transaction_row ON transaction_row.id = posting.transaction_id WHERE transaction_row.idempotency_key = 'balanced-neutral-001' AND posting.side = 'credit')
    <> 1000000::numeric THEN RAISE EXCEPTION 'exact native atomic amount changed'; END IF;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'balanced-neutral-001', 'transactionType', 'changed_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-15T12:00:00Z',
      'evidenceHash', repeat('4', 64), 'actorType', 'service',
      'postings', jsonb_build_array('{}'::jsonb, '{}'::jsonb)
    ));
    RAISE EXCEPTION 'idempotency conflict was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_idempotency_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'over-application-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-16T12:00:00Z',
      'evidenceHash', repeat('5', 64), 'actorType', 'service', 'financialReferenceKey', 'local_review_reference',
      'postings', jsonb_build_array(
        jsonb_build_object('accountKey', 'neutral_source_control', 'side', 'debit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1', 'functionalUsdAmount', '0.000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101'),
        jsonb_build_object('accountKey', 'neutral_offset_control', 'side', 'credit', 'assetKey', 'local_review_usd', 'custodyKey', 'local_review_custody', 'nativeAtomicAmount', '1', 'functionalUsdAmount', '0.000001', 'fxUsdPerUnit', '1', 'projectId', 101, 'userId', '00000000-0000-4000-8000-000000000101')
      )
    ));
    RAISE EXCEPTION 'financial reference over-application was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'financial_reference_over_applied' THEN RAISE; END IF;
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.reverse_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_reversal.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'outside-period-reversal-001',
      'originalTransactionId', (SELECT id FROM public.ledger_transactions WHERE idempotency_key = 'balanced-neutral-001'),
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-07-31T06:59:59Z',
      'evidenceHash', repeat('d', 64), 'actorType', 'service'
    ));
    RAISE EXCEPTION 'out-of-period reversal was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_effective_at_outside_period' THEN RAISE; END IF;
  END;
END $$;

SELECT public.reverse_neutral_ledger_transaction(jsonb_build_object(
  'contractVersion', 'ledger_reversal.v1', 'deploymentEnvironment', 'local',
  'idempotencyKey', 'balanced-reversal-001', 'originalTransactionId', :posted_transaction_id,
  'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-17T12:00:00Z',
  'evidenceHash', repeat('6', 64), 'actorType', 'operator',
  'actorUserId', '00000000-0000-4000-8000-000000000101'
)) AS reversal_transaction_id \gset

SELECT public.reverse_neutral_ledger_transaction(jsonb_build_object(
  'contractVersion', 'ledger_reversal.v1', 'deploymentEnvironment', 'local',
  'idempotencyKey', 'balanced-reversal-001', 'originalTransactionId', :posted_transaction_id,
  'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-17T12:00:00Z',
  'evidenceHash', repeat('6', 64), 'actorType', 'operator',
  'actorUserId', '00000000-0000-4000-8000-000000000101'
)) AS replayed_reversal_transaction_id \gset

DO $$ BEGIN
  IF (SELECT count(*) FROM public.ledger_transactions WHERE idempotency_key = 'balanced-reversal-001') <> 1 THEN RAISE EXCEPTION 'idempotent reversal count mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_transactions reversal JOIN public.ledger_transactions original ON original.id = reversal.reversal_of_transaction_id WHERE reversal.idempotency_key = 'balanced-reversal-001' AND original.idempotency_key = 'balanced-neutral-001') THEN RAISE EXCEPTION 'typed reversal transaction missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ledger_postings original
    JOIN public.ledger_transactions original_transaction ON original_transaction.id = original.transaction_id AND original_transaction.idempotency_key = 'balanced-neutral-001'
    JOIN public.ledger_transactions reversal_transaction ON reversal_transaction.reversal_of_transaction_id = original_transaction.id AND reversal_transaction.idempotency_key = 'balanced-reversal-001'
    JOIN public.ledger_postings reversal ON reversal.transaction_id = reversal_transaction.id
      AND reversal.sequence_no = original.sequence_no
    WHERE reversal.side = CASE original.side WHEN 'debit' THEN 'credit' ELSE 'debit' END
      AND reversal.native_atomic_amount = original.native_atomic_amount
      AND reversal.functional_usd_amount = original.functional_usd_amount
  ) THEN RAISE EXCEPTION 'reversal did not preserve exact amounts and invert sides'; END IF;
  BEGIN
    PERFORM public.reverse_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_reversal.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'second-reversal-denied-001',
      'originalTransactionId', (SELECT id FROM public.ledger_transactions WHERE idempotency_key = 'balanced-neutral-001'),
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-17T12:01:00Z',
      'evidenceHash', repeat('a', 64), 'actorType', 'service'
    ));
    RAISE EXCEPTION 'second typed reversal was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_transaction_already_reversed' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.ledger_transactions SET evidence_hash = repeat('9', 64) WHERE idempotency_key = 'balanced-neutral-001';
    RAISE EXCEPTION 'append-only transaction update was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'financial_records_are_append_only' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.accounting_periods SET status = 'closed', closed_at = now(), close_evidence_hash = repeat('7', 64)
WHERE period_key = 'local_review_2026_08';
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion', 'ledger_post.v1', 'deploymentEnvironment', 'local',
      'idempotencyKey', 'closed-period-001', 'transactionType', 'neutral_review',
      'periodKey', 'local_review_2026_08', 'effectiveAt', '2026-08-18T12:00:00Z',
      'evidenceHash', repeat('8', 64), 'actorType', 'service', 'postings', jsonb_build_array('{}'::jsonb, '{}'::jsonb)
    ));
    RAISE EXCEPTION 'closed period posting was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ledger_period_not_open' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.ledger_postings WHERE transaction_id = (SELECT id FROM public.ledger_transactions WHERE idempotency_key = 'balanced-neutral-001');
    RAISE EXCEPTION 'service role direct financial delete was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
UPDATE public.accounting_periods SET status = 'open', closed_at = NULL, close_evidence_hash = NULL
WHERE period_key = 'local_review_2026_08';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.ledger_postings) <> 4 THEN RAISE EXCEPTION 'user scoped ledger read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.ledger_postings) <> 4 THEN RAISE EXCEPTION 'project participant scoped ledger read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.ledger_postings) OR EXISTS (SELECT 1 FROM public.ledger_transactions) THEN RAISE EXCEPTION 'unrelated actor read ledger data'; END IF;
END $$;

RESET ROLE;
SET LOCAL enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT id FROM public.ledger_postings
WHERE user_id = '00000000-0000-4000-8000-000000000101' AND transaction_id = :posted_transaction_id;
EXPLAIN (COSTS OFF) SELECT id FROM public.ledger_postings
WHERE project_id = 101 AND transaction_id = :posted_transaction_id;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ledger_postings_user_idx' AND indexdef LIKE '%WHERE (user_id IS NOT NULL)%') THEN RAISE EXCEPTION 'user partial index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ledger_postings_project_idx' AND indexdef LIKE '%WHERE (project_id IS NOT NULL)%') THEN RAISE EXCEPTION 'project partial index missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_runtime_controls WHERE deployment_environment = 'production' AND (neutral_posting_enabled OR production_value_flow_enabled OR professional_approval_reference IS NOT NULL)) THEN RAISE EXCEPTION 'production runtime control is not fail closed'; END IF;
END $$;

ROLLBACK;
SELECT 'neutral ledger foundation SQL validation passed' AS result;
