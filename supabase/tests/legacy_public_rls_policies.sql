\set ON_ERROR_STOP on

-- Behavioural coverage for 20260919090000_rls_policies_for_legacy_public_tables.sql.
-- A = admin of a private project and member of a public one; B = unrelated signed-in user;
-- C = public-profile member of the public project with a display_name/avatar consent grant.

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES
  ('30000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'rls-a@example.test', now(), now()),
  ('30000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'rls-b@example.test', now(), now()),
  ('30000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'rls-c@example.test', now(), now());

INSERT INTO public.users (user_id, full_name, display_name, profile_headline, email, status, is_public) VALUES
  ('30000000-0000-4000-8000-00000000000a', 'Admin Alpha', 'Alpha', 'Secret headline A', 'rls-a@example.test', 'active', false),
  ('30000000-0000-4000-8000-00000000000b', 'Outsider Beta', 'Beta', NULL, 'rls-b@example.test', 'active', false),
  ('30000000-0000-4000-8000-00000000000c', 'Public Gamma', 'Gamma', 'Unconsented headline', 'rls-c@example.test', 'active', true);

INSERT INTO public.profile_publication_consents
  (user_id, document_version_id, document_identifier, content_hash, document_status, locale, action, fields, source_surface)
SELECT '30000000-0000-4000-8000-00000000000c', version.id, version.document_identifier, version.content_hash,
  'review', version.locale, 'grant', '["display_name", "avatar"]'::jsonb, 'account_profile_visibility'
FROM public.legal_document_versions version
WHERE version.status = 'review' AND version.document_identifier LIKE 'fundloop-privacy-%'
ORDER BY version.id
LIMIT 1;

INSERT INTO public.organizations (id, name) VALUES (930001, 'RLS Test Org');

INSERT INTO public.projects (id, name, description, slug, organization_id, is_public, status) VALUES
  (930001, 'RLS Private Project', 'private', 'rls-private-project', 930001, false, 'active'),
  (930002, 'RLS Public Project', 'public', 'rls-public-project', NULL, true, 'active');

INSERT INTO public.participants (project_id, user_id, is_admin) VALUES
  (930001, '30000000-0000-4000-8000-00000000000a', true),
  (930002, '30000000-0000-4000-8000-00000000000a', false),
  (930002, '30000000-0000-4000-8000-00000000000c', false);

INSERT INTO public.payments (project_id, period_start, period_end, revenue, payment_amount, payment_percentage)
VALUES (930001, '2026-08-01', '2026-08-31', 1000, 50, 5);

INSERT INTO public.invitation_codes (code, created_by, max_uses, usage_count)
VALUES ('RLS-TEST-CODE', '30000000-0000-4000-8000-00000000000a', 5, 1);

-- Structural checks ---------------------------------------------------------------------

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity
    AND c.relname = ANY (ARRAY['audit_log', 'invitation_codes', 'payments', 'payment_methods', 'users', 'projects',
      'participants', 'organization_members', 'organizations', 'wallet_accounts', 'support_requests', 'ref_roles']);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled on: %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('public_payments_read_all', 'audit_log_read_all', 'invitation_codes_read_all',
        'payment_methods_read_all', 'newsletter_subscribers_read_all', 'projects_org_policy', 'users_user_policy')
  ) THEN
    RAISE EXCEPTION 'legacy policies must be dropped before RLS is enabled';
  END IF;
END $$;

-- Signed-out visitor ----------------------------------------------------------------------

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE
  v_count bigint;
  v_profile record;
  v_preview record;
BEGIN
  SELECT count(*) INTO v_count FROM public.projects WHERE id IN (930001, 930002);
  IF v_count <> 1 OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 930002) THEN
    RAISE EXCEPTION 'anon must see only the public project (saw %)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.participants WHERE project_id = 930001;
  IF v_count <> 0 THEN RAISE EXCEPTION 'anon saw private project participants'; END IF;
  SELECT count(*) INTO v_count FROM public.participants WHERE project_id = 930002;
  IF v_count <> 2 THEN RAISE EXCEPTION 'anon must see public project participants (saw %)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.project_active_members WHERE project_id = 930001;
  IF v_count <> 0 THEN RAISE EXCEPTION 'anon saw private project members through the view'; END IF;

  SELECT * INTO v_profile FROM public.public_user_profiles WHERE user_id = '30000000-0000-4000-8000-00000000000c';
  IF v_profile.user_id IS NULL OR v_profile.display_name IS DISTINCT FROM 'Gamma' OR v_profile.profile_headline IS NOT NULL THEN
    RAISE EXCEPTION 'public profile must expose only consented fields';
  END IF;
  IF EXISTS (SELECT 1 FROM public.public_user_profiles WHERE user_id = '30000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'non-public profile exposed';
  END IF;

  SELECT * INTO v_preview FROM public.get_invitation_preview('RLS-TEST-CODE');
  IF v_preview.code IS DISTINCT FROM 'RLS-TEST-CODE' OR v_preview.inviter_name IS DISTINCT FROM 'Alpha' THEN
    RAISE EXCEPTION 'invitation preview must resolve one exact code';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_invitation_preview('RLS-TEST')) THEN
    RAISE EXCEPTION 'invitation preview must not match partial codes';
  END IF;
END $$;

DO $$ BEGIN PERFORM 1 FROM public.users; RAISE EXCEPTION 'anon read users';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM 1 FROM public.payments; RAISE EXCEPTION 'anon read payments';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM 1 FROM public.invitation_codes; RAISE EXCEPTION 'anon read invitation codes';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM 1 FROM public.audit_log; RAISE EXCEPTION 'anon read audit log';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM 1 FROM public.search_projects_for_team_member('RLS'); RAISE EXCEPTION 'anon searched projects';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.support_requests (name, email, subject, category, message, user_id)
VALUES ('Visitor', 'visitor@example.test', 'Hello', 'general', 'Signed-out request', NULL);
DO $$ BEGIN
  INSERT INTO public.support_requests (name, email, subject, category, message, user_id)
  VALUES ('Spoof', 'spoof@example.test', 'Hi', 'general', 'Impersonation', '30000000-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'anon inserted a support request as another user';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM 1 FROM public.support_requests; RAISE EXCEPTION 'anon read support requests';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

RESET ROLE;

-- Unrelated signed-in user ----------------------------------------------------------------

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.users;
  IF v_count <> 1 OR NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = '30000000-0000-4000-8000-00000000000b') THEN
    RAISE EXCEPTION 'a signed-in user must see only their own users row (saw %)', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.projects WHERE id = 930001) THEN
    RAISE EXCEPTION 'outsider saw the private project';
  END IF;
  SELECT count(*) INTO v_count FROM public.payments;
  IF v_count <> 0 THEN RAISE EXCEPTION 'outsider saw payments'; END IF;

  UPDATE public.projects SET is_public = false WHERE id = 930002;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'outsider changed project visibility'; END IF;

  -- Project-level contact only; the search itself is allowed for signed-in users.
  SELECT count(*) INTO v_count FROM public.search_projects_for_team_member('RLS Private');
  IF v_count <> 1 THEN RAISE EXCEPTION 'signed-in project search must find active projects (saw %)', v_count; END IF;
END $$;

RESET ROLE;

-- Project admin ---------------------------------------------------------------------------

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

DO $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 930001) THEN
    RAISE EXCEPTION 'admin must see their private project';
  END IF;
  SELECT count(*) INTO v_count FROM public.payments WHERE project_id = 930001;
  IF v_count <> 1 THEN RAISE EXCEPTION 'admin must see their project payments (saw %)', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.project_active_members WHERE project_id = 930001;
  IF v_count <> 1 THEN RAISE EXCEPTION 'member must see private project members (saw %)', v_count; END IF;

  UPDATE public.projects SET is_public = true, updated_by = '30000000-0000-4000-8000-00000000000a' WHERE id = 930001;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'admin must be able to toggle visibility'; END IF;
END $$;

DO $$ BEGIN
  UPDATE public.projects SET name = 'Renamed' WHERE id = 930001;
  RAISE EXCEPTION 'admin updated a column outside the visibility grant';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.wallet_accounts (user_id, wallet_address, wallet_type, wallet_name, is_primary)
VALUES ('30000000-0000-4000-8000-00000000000a', '0x3333333333333333333333333333333333333333', 'ethereum', 'RLS wallet', true);
DO $$ BEGIN
  INSERT INTO public.wallet_accounts (user_id, wallet_address, wallet_type)
  VALUES ('30000000-0000-4000-8000-00000000000b', '0x4444444444444444444444444444444444444444', 'ethereum');
  RAISE EXCEPTION 'user created a wallet for someone else';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

RESET ROLE;

ROLLBACK;
