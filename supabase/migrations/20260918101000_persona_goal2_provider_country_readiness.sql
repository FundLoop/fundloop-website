ALTER FUNCTION public.persona_goal2_schema_readiness() RENAME TO persona_goal2_schema_readiness_v3;
REVOKE ALL ON FUNCTION public.persona_goal2_schema_readiness_v3() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.persona_goal2_schema_readiness() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prior jsonb := public.persona_goal2_schema_readiness_v3();
  v_missing text[] := ARRAY[]::text[];
  v_customer_constraint text;
  v_merchant_constraint text;
BEGIN
  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO v_missing
  FROM jsonb_array_elements_text(v_prior->'missingFeatures') AS prior_missing(value);

  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_customer_constraint
  FROM pg_catalog.pg_constraint constraint_row
  JOIN pg_catalog.pg_class table_row ON table_row.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
  WHERE schema_row.nspname = 'public'
    AND table_row.relname = 'stripe_pay_by_bank_commands'
    AND constraint_row.conname = 'stripe_pay_by_bank_command_customer_check';

  IF v_customer_constraint IS NULL OR position('customer_country = ''GB''' IN v_customer_constraint) = 0 THEN
    v_missing := array_append(v_missing, 'constraint:stripe_pay_by_bank_command_customer_check');
  END IF;

  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_merchant_constraint
  FROM pg_catalog.pg_constraint constraint_row
  JOIN pg_catalog.pg_class table_row ON table_row.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
  WHERE schema_row.nspname = 'public'
    AND table_row.relname = 'stripe_pay_by_bank_commands'
    AND constraint_row.conname = 'stripe_pay_by_bank_command_merchant_check';

  IF v_merchant_constraint IS NULL
     OR position('merchant_country = ANY (ARRAY[''DE''::text, ''GB''::text])' IN v_merchant_constraint) = 0 THEN
    v_missing := array_append(v_missing, 'constraint:stripe_pay_by_bank_command_merchant_check');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    JOIN pg_catalog.pg_class table_row ON table_row.oid = trigger_row.tgrelid
    JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
    WHERE schema_row.nspname = 'public'
      AND table_row.relname = 'stripe_pay_by_bank_commands'
      AND trigger_row.tgname = 'stripe_pay_by_bank_country_reality'
      AND trigger_row.tgenabled = 'O'
      AND NOT trigger_row.tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:stripe_pay_by_bank_country_reality');
  END IF;

  RETURN jsonb_build_object(
    'contractVersion', 'fundloop.persona-goal2-schema-readiness.v4',
    'migrationVersion', '20260918101000',
    'featureCount', 39,
    'missingFeatures', to_jsonb(v_missing),
    'ready', cardinality(v_missing) = 0,
    'productionValueFlowEnabled', false
  );
END $$;

REVOKE ALL ON FUNCTION public.persona_goal2_schema_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persona_goal2_schema_readiness() TO service_role;
