\set ON_ERROR_STOP on

-- Pins the client write surface: introduced by 20260918120000 (stopgap), tightened by 20260919090000 (RLS).

DO $$
DECLARE
  v_row record;
BEGIN
  -- Since 20260919090000 every legacy table has RLS, so no public table without RLS may be
  -- client-writable at all. Allowed client writes are covered behaviourally by
  -- legacy_public_rls_policies.sql.
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
    RAISE EXCEPTION 'client write privilege on a table without RLS: % % on public.%', v_row.role_name, v_row.privilege, v_row.relname;
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
