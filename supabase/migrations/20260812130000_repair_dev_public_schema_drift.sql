DO $repair$
DECLARE
  v_month_bounds text;
  v_payment_roles name[];
  v_payment_command text;
  v_payment_using text;
  v_payment_check text;
  v_unknown_policy_count integer;
  v_unknown_policy_name name;
  v_clean boolean;
  v_exact_dev_drift boolean;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid, false)
  INTO v_month_bounds
  FROM pg_catalog.pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.monthly_cycles'::pg_catalog.regclass
    AND constraint_row.conname = 'monthly_cycles_month_bounds_check';

  SELECT
    ARRAY(
      SELECT role.rolname
      FROM unnest(policy.polroles) WITH ORDINALITY listed(role_oid, role_ordinal)
      JOIN pg_catalog.pg_roles role ON role.oid = listed.role_oid
      ORDER BY listed.role_ordinal
    ),
    policy.polcmd,
    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
    pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
  INTO v_payment_roles, v_payment_command, v_payment_using, v_payment_check
  FROM pg_catalog.pg_policy policy
  WHERE policy.polrelid = 'public.payments'::pg_catalog.regclass
    AND policy.polname = 'public_payments_read_all';

  SELECT count(*), min(policy.policyname)
  INTO v_unknown_policy_count, v_unknown_policy_name
  FROM pg_catalog.pg_policies policy
  WHERE policy.schemaname = 'public'
    AND encode(extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.format('%s.%s %s [POLICY]#1', policy.schemaname, policy.tablename, policy.policyname),
        'UTF8'
      ),
      'sha256'
    ), 'hex') = '8355071b6c97ae9ab87905ec5fa9b19380272cb553a01609cd7ca9e18be26946'
    AND policy.tablename = 'cron_logs'
    AND policy.cmd = 'INSERT'
    AND policy.permissive = 'PERMISSIVE'
    AND policy.roles = ARRAY['anon']::name[]
    AND policy.qual IS NULL
    AND policy.with_check = 'true';

  v_clean :=
    v_month_bounds = 'CHECK ((((month >= 1) AND (month <= 12)) AND (period_start = make_date((year)::integer, (month)::integer, 1)) AND (period_end = ((make_date((year)::integer, (month)::integer, 1) + ''1 mon -1 days''::interval))::date)))'
    AND v_payment_roles = ARRAY['authenticated', 'anon']::name[]
    AND v_payment_command = 'r'
    AND v_payment_using = 'true'
    AND v_payment_check IS NULL
    AND v_unknown_policy_count = 0;

  v_exact_dev_drift :=
    v_month_bounds = 'CHECK (((month >= 1) AND (month <= 12) AND (period_start = make_date((year)::integer, (month)::integer, 1)) AND (period_end = ((make_date((year)::integer, (month)::integer, 1) + ''1 mon -1 days''::interval))::date)))'
    AND v_payment_roles = ARRAY['authenticated', 'anon']::name[]
    AND v_payment_command = 'r'
    AND v_payment_using = 'true'
    AND v_payment_check IS NULL
    AND v_unknown_policy_count = 1
    AND v_unknown_policy_name IS NOT NULL;

  IF v_clean THEN
    RETURN;
  END IF;

  IF v_exact_dev_drift IS NOT TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'dev_public_schema_drift_precondition_failed';
  END IF;

  EXECUTE pg_catalog.format('DROP POLICY %I ON public.cron_logs', v_unknown_policy_name);

  ALTER TABLE public.monthly_cycles
    DROP CONSTRAINT monthly_cycles_month_bounds_check;
  ALTER TABLE public.monthly_cycles
    ADD CONSTRAINT monthly_cycles_month_bounds_check CHECK (
      month BETWEEN 1 AND 12
      AND period_start = make_date(year::integer, month::integer, 1)
      AND period_end = (make_date(year::integer, month::integer, 1) + interval '1 month - 1 day')::date
    );

END
$repair$;
