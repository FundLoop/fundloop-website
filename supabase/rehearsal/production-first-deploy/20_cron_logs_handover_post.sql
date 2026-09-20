-- Run on Prod immediately AFTER the first pipeline deploy succeeds.
-- Copies the pre-launch cron log rows into the migration-created table and verifies that
-- every row arrived. The legacy table is kept until 30_cron_logs_handover_cleanup.sql.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.cron_logs') IS NULL OR to_regclass('public.cron_logs_prelaunch') IS NULL THEN
    RAISE EXCEPTION 'handover_post_requires_both_tables';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260324035725'
  ) THEN
    RAISE EXCEPTION 'handover_post_requires_applied_initial_migration';
  END IF;
END $$;

INSERT INTO public.cron_logs (id, "timestamp", status, note)
SELECT id, "timestamp", status, note
FROM public.cron_logs_prelaunch
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.cron_logs_prelaunch legacy
  WHERE NOT EXISTS (SELECT 1 FROM public.cron_logs current WHERE current.id = legacy.id);
  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'handover_post_rows_missing: %', v_missing;
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM public.cron_logs_prelaunch) AS prelaunch_rows,
  (SELECT count(*) FROM public.cron_logs) AS cron_logs_rows;

COMMIT;
