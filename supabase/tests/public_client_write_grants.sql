\set ON_ERROR_STOP on

-- Pins the client write surface left by 20260918120000_revoke_public_client_writes_stopgap.sql.

DO $$
DECLARE
  v_row record;
  v_allowed text[] := ARRAY[
    'anon:newsletter_subscribers:INSERT',
    'authenticated:newsletter_subscribers:INSERT',
    'anon:support_requests:INSERT',
    'authenticated:support_requests:INSERT',
    'authenticated:organization_invitations:INSERT',
    'authenticated:organization_invitations:UPDATE',
    'authenticated:organization_members:INSERT',
    'authenticated:projects:INSERT',
    'authenticated:wallet_accounts:INSERT',
    'authenticated:wallet_accounts:UPDATE',
    'authenticated:user_notifications:UPDATE'
  ];
  v_found text[] := ARRAY[]::text[];
BEGIN
  -- Every client-writable table without RLS must be on the allowlist.
  FOR v_row IN
    SELECT role_name, c.relname, privilege
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS role_name
    CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS privilege
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
      AND has_table_privilege(role_name, c.oid, privilege)
  LOOP
    IF NOT (v_row.role_name || ':' || v_row.relname || ':' || v_row.privilege) = ANY (v_allowed) THEN
      RAISE EXCEPTION 'unexpected client write privilege: % % on public.%', v_row.role_name, v_row.privilege, v_row.relname;
    END IF;
    v_found := v_found || (v_row.role_name || ':' || v_row.relname || ':' || v_row.privilege);
  END LOOP;

  -- Every intended client write must still be present.
  FOR v_row IN SELECT unnest(v_allowed) AS entry LOOP
    IF NOT v_row.entry = ANY (v_found) THEN
      RAISE EXCEPTION 'expected client write privilege missing: %', v_row.entry;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  -- The stopgap never revokes SELECT (pinned by tests/public-client-write-stopgap-migration.test.ts).
  -- Read grants come from each environment's default privileges, which differ between hosted
  -- projects and local images, so report them rather than assert them here.
  RAISE NOTICE 'client read grants: anon projects=%, authenticated users=%, anon ref_categories=%',
    has_table_privilege('anon', 'public.projects', 'SELECT'),
    has_table_privilege('authenticated', 'public.users', 'SELECT'),
    has_table_privilege('anon', 'public.ref_categories', 'SELECT');

  IF has_function_privilege('anon', 'public.soft_delete_users(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.soft_delete_users(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.soft_delete_organizations(bigint)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.soft_delete_organizations(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unguarded soft-delete functions must not be client executable';
  END IF;
END $$;

-- Behavioural check: a signed-out client can no longer delete users.
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  DELETE FROM public.users WHERE false;
  RAISE EXCEPTION 'anon delete on public.users unexpectedly permitted';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;
