\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'review-policy-a@example.test', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'review-policy-b@example.test', now(), now());

INSERT INTO public.users (user_id, display_name, email, status)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Review Policy A', 'review-policy-a@example.test', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Review Policy B', 'review-policy-b@example.test', 'active');

SET LOCAL ROLE service_role;

SELECT *
FROM public.record_review_policy_acknowledgement(
  '10000000-0000-4000-8000-000000000001',
  'fundloop-terms-ca-review-draft-2026-08-08',
  '5fdad9b8c1a73e4072612820d079e357e56abf0a217f499de84db2cd78b5aa20',
  'en-CA',
  'user',
  'payout_preview'
);

DO $$
BEGIN
  BEGIN
    PERFORM public.record_review_policy_acknowledgement(
      '10000000-0000-4000-8000-000000000001',
      'not-the-current-document',
      repeat('0', 64),
      'en-CA',
      'user',
      'payout_preview'
    );
    RAISE EXCEPTION 'invalid Terms document/hash was accepted';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM <> 'current_review_document_required' THEN
        RAISE;
      END IF;
  END;
END
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.legal_acceptance_records) <> 1 THEN
    RAISE EXCEPTION 'Terms self-read policy failed';
  END IF;

  BEGIN
    INSERT INTO public.legal_acceptance_records (
      actor_user_id,
      document_version_id,
      document_identifier,
      content_hash,
      locale,
      document_status,
      actor_capacity,
      source_surface
    )
    SELECT
      '10000000-0000-4000-8000-000000000001',
      id,
      document_identifier,
      content_hash,
      locale,
      status,
      'user',
      'payout_preview'
    FROM public.legal_document_versions
    WHERE document_kind = 'terms';
    RAISE EXCEPTION 'authenticated direct Terms write was allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.legal_acceptance_records) <> 0 THEN
    RAISE EXCEPTION 'Terms cross-user read was allowed';
  END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT *
FROM public.record_profile_publication_choice(
  '10000000-0000-4000-8000-000000000001',
  'fundloop-privacy-ca-review-draft-2026-08-08',
  '97523eedf0c1cbf79b3cfd87eee42392815dd6458d45e1ceeaf68b2e859eb65a',
  'en-CA',
  'grant',
  '["display_name"]'::jsonb,
  'account_profile_visibility'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.list_discoverable_public_user_ids()
    WHERE user_id = '10000000-0000-4000-8000-000000000001'
      AND fields = '["display_name"]'::jsonb
  ) THEN
    RAISE EXCEPTION 'granted profile or exact consent fields were not discoverable';
  END IF;

  BEGIN
    PERFORM public.record_profile_publication_choice(
      '10000000-0000-4000-8000-000000000001',
      'fundloop-privacy-ca-review-draft-2026-08-08',
      repeat('0', 64),
      'en-CA',
      'grant',
      '["display_name"]'::jsonb,
      'account_profile_visibility'
    );
    RAISE EXCEPTION 'invalid Privacy document/hash was accepted';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM <> 'current_review_privacy_document_required' THEN
        RAISE;
      END IF;
  END;
END
$$;

SELECT *
FROM public.record_profile_publication_choice(
  '10000000-0000-4000-8000-000000000001',
  'fundloop-privacy-ca-review-draft-2026-08-08',
  '97523eedf0c1cbf79b3cfd87eee42392815dd6458d45e1ceeaf68b2e859eb65a',
  'en-CA',
  'withdraw',
  '[]'::jsonb,
  'account_profile_visibility'
);

DO $$
BEGIN
  IF (
    SELECT action
    FROM public.profile_publication_consents
    WHERE user_id = '10000000-0000-4000-8000-000000000001'
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  ) <> 'withdraw' THEN
    RAISE EXCEPTION 'latest Privacy choice was not withdrawal';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.list_discoverable_public_user_ids()
    WHERE user_id = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'withdrawn profile remained discoverable';
  END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.profile_publication_consents) <> 2 THEN
    RAISE EXCEPTION 'Privacy self-read/latest-choice history failed';
  END IF;

  BEGIN
    INSERT INTO public.profile_publication_consents (
      user_id,
      document_version_id,
      document_identifier,
      content_hash,
      document_status,
      locale,
      action,
      fields,
      source_surface
    )
    SELECT
      '10000000-0000-4000-8000-000000000001',
      id,
      document_identifier,
      content_hash,
      status,
      locale,
      'grant',
      '["display_name"]'::jsonb,
      'account_profile_visibility'
    FROM public.legal_document_versions
    WHERE document_kind = 'privacy';
    RAISE EXCEPTION 'authenticated direct Privacy consent write was allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.profile_publication_consents) <> 0 THEN
    RAISE EXCEPTION 'Privacy cross-user read was allowed';
  END IF;
END
$$;

ROLLBACK;

SELECT 'review policy SQL validation passed' AS result;
