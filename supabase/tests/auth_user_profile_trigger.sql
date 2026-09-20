\set ON_ERROR_STOP on

-- A new sign-up must receive a public.users profile row, and reference data must exist even
-- though supabase/seed.sql never runs on hosted databases.

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-trigger@example.test', now(), now());

DO $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.users WHERE user_id = '50000000-0000-4000-8000-000000000001';
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'sign-up did not create a public.users profile';
  END IF;
  IF v_status <> 'inactive' THEN
    RAISE EXCEPTION 'new profile should start inactive, got %', v_status;
  END IF;
END $$;

DO $$
DECLARE
  v_table text;
  v_count bigint;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['ref_genders', 'ref_invitation_statuses', 'ref_payment_periodicities',
    'ref_payment_statuses', 'ref_social_platforms', 'ref_categories', 'ref_interests', 'ref_occupations',
    'ref_locations', 'ref_skills', 'ref_roles', 'ref_payment_methods', 'ref_notification_types'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'reference table public.% is empty', v_table;
    END IF;
  END LOOP;
END $$;

ROLLBACK;
