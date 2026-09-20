-- Run on Prod immediately BEFORE the first pipeline deploy (after review and approval).
-- initial_remote.sql creates public.cron_logs without IF NOT EXISTS, and Prod already has that
-- table (148 rows at inspection). Move the legacy table aside so the migration can create the
-- canonical one; 20_cron_logs_handover_post.sql copies the rows back.
--
-- Side effect: until the deploy finishes, cron inserts into public.cron_logs fail (log-only data).

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations) THEN
      RAISE EXCEPTION 'handover_pre_requires_empty_migration_history';
    END IF;
  END IF;
  IF to_regclass('public.cron_logs') IS NULL THEN
    RAISE EXCEPTION 'handover_pre_cron_logs_missing';
  END IF;
  IF to_regclass('public.cron_logs_prelaunch') IS NOT NULL THEN
    RAISE EXCEPTION 'handover_pre_already_applied';
  END IF;
END $$;

ALTER TABLE public.cron_logs RENAME TO cron_logs_prelaunch;
-- The migration creates constraint (and index) cron_logs_pkey; free the name.
ALTER TABLE public.cron_logs_prelaunch RENAME CONSTRAINT cron_logs_pkey TO cron_logs_prelaunch_pkey;

SELECT count(*) AS prelaunch_rows FROM public.cron_logs_prelaunch;

COMMIT;
