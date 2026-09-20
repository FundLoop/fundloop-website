-- Run on Prod after 20_cron_logs_handover_post.sql has been verified. Irreversible.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cron_logs_prelaunch legacy
    WHERE NOT EXISTS (SELECT 1 FROM public.cron_logs current WHERE current.id = legacy.id)
  ) THEN
    RAISE EXCEPTION 'handover_cleanup_rows_not_copied';
  END IF;
END $$;

DROP TABLE public.cron_logs_prelaunch;

COMMIT;
