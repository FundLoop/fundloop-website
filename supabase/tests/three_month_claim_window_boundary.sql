\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_target_start date := date_trunc('month', current_date)::date;
  v_target_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_origin_start date := (date_trunc('month', current_date) - interval '3 months')::date;
  v_origin_end date := (date_trunc('month', current_date) - interval '2 months 1 day')::date;
  v_target_key text := to_char(date_trunc('month', current_date), 'YYYY-MM');
  v_origin_key text := to_char(date_trunc('month', current_date) - interval '3 months', 'YYYY-MM');
BEGIN
  INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end,status)
  VALUES
    (v_origin_key,extract(year FROM v_origin_start)::integer,extract(month FROM v_origin_start)::integer,v_origin_start,v_origin_end,'completed'),
    (v_target_key,extract(year FROM v_target_start)::integer,extract(month FROM v_target_start)::integer,v_target_start,v_target_end,'completed')
  ON CONFLICT(cycle_key) DO UPDATE SET
    period_start=excluded.period_start,
    period_end=excluded.period_end,
    status=excluded.status;

  IF clock_timestamp() >= ((v_target_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles') THEN
    RAISE EXCEPTION 'claim_window_fixture_target_must_be_open';
  END IF;

  BEGIN
    PERFORM public.epoch_allocation_v2_preview_input(v_target_key,1.50,'local');
    RAISE EXCEPTION 'claim_window_open_boundary_not_enforced';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'epoch_allocation_v2_claim_window_open' THEN
        RAISE;
      END IF;
  END;
END
$$;

ROLLBACK;
