-- Reproduces FundLoop Prod's database state before its first pipeline deploy, as observed
-- read-only on 2026-09-19. Runs on a fresh, migration-free local Supabase database.
-- Synthetic data only: no production rows or identities are copied.
--
-- Observed on Prod (tpouimiyfmvucrerfhfc):
--   * no supabase_migrations history; public has only cron_logs and rls_auto_enable()
--   * ensure_rls event trigger enabling RLS on every table created in public
--   * default privileges granting ALL on public tables/sequences/functions to anon,
--     authenticated, service_role (local images differ, so set explicitly)
--   * cron_logs: RLS on, anon INSERT policy, 148 rows
--   * 5 auth.users (Aug-Sep 2026), no storage buckets

\set ON_ERROR_STOP on

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Supabase's newer projects ship this trigger; body copied from Prod.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable();

-- Prod's pre-existing cron_logs (same columns as initial_remote.sql), owned by postgres as on Prod.
SET ROLE postgres;
CREATE TABLE public.cron_logs (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
  "timestamp" timestamp with time zone DEFAULT now(),
  status text,
  note text
);
CREATE POLICY "Allow anonymous cron log inserts" ON public.cron_logs FOR INSERT TO anon WITH CHECK (true);

INSERT INTO public.cron_logs ("timestamp", status, note)
SELECT now() - make_interval(hours => series), CASE WHEN series % 10 = 0 THEN 'error' ELSE 'ok' END,
  'rehearsal synthetic cron log ' || series
FROM generate_series(1, 148) AS series;
RESET ROLE;

-- Five pre-existing sign-ups (synthetic identities).
INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
SELECT ('40000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
  'prelaunch-' || series || '@rehearsal.test', timestamptz '2026-08-15' + make_interval(days => series * 7), now()
FROM generate_series(1, 5) AS series;
