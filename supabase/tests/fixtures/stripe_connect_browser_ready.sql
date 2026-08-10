BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;

DO $$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO STRICT v_user FROM public.users WHERE email = 'maya@fundloop.example.com';
  PERFORM public.sync_stripe_connect_account(v_user, jsonb_build_object(
    'contractVersion', 'stripe_connect_account_sync.v1',
    'deploymentEnvironment', 'local',
    'providerAccountId', 'acct_fundloop141',
    'countryCode', 'CA',
    'defaultCurrency', 'USD',
    'detailsSubmitted', true,
    'payoutsEnabled', true,
    'externalAccountEnabled', true,
    'externalAccountLast4', '6789',
    'currentlyDueCount', 0,
    'eventuallyDueCount', 0,
    'disabledReason', '',
    'providerUpdatedAt', '2026-08-10T18:00:00Z',
    'evidenceHash', repeat('c', 64)
  ));
  IF NOT EXISTS (
    SELECT 1
    FROM public.stripe_connect_accounts
    WHERE user_id = v_user
      AND onboarding_status = 'ready'
      AND payouts_enabled
      AND external_account_enabled
      AND currently_due_count = 0
      AND external_account_last4 = '6789'
  ) THEN
    RAISE EXCEPTION 'stripe connect browser account is not ready';
  END IF;
END;
$$;

ROLLBACK;
