DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stripe_pay_by_bank_commands
    WHERE customer_country <> 'GB'
       OR merchant_country NOT IN ('DE', 'GB')
  ) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_legacy_country_reality_requires_review';
  END IF;
END $$;

ALTER TABLE public.stripe_pay_by_bank_commands
  DROP CONSTRAINT stripe_pay_by_bank_command_customer_check,
  DROP CONSTRAINT stripe_pay_by_bank_command_merchant_check;

ALTER TABLE public.stripe_pay_by_bank_commands
  ADD CONSTRAINT stripe_pay_by_bank_command_customer_check CHECK (customer_country = 'GB'),
  ADD CONSTRAINT stripe_pay_by_bank_command_merchant_check CHECK (merchant_country IN ('DE', 'GB'));

CREATE OR REPLACE FUNCTION public.prepare_stripe_pay_by_bank_command(p_command jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
  v_project public.projects%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_existing public.stripe_pay_by_bank_commands%ROWTYPE;
  v_quote public.project_payment_funding_quotes%ROWTYPE;
  v_hash text;
  v_id uuid;
BEGIN
  IF p_command->>'contractVersion' <> 'stripe_pay_by_bank_prepare.v1' OR v_environment NOT IN ('local', 'dev', 'test') THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.stripe_pay_by_bank_runtime_controls control
    WHERE control.deployment_environment = v_environment
      AND control.checkout_enabled
      AND CASE upper(p_command->>'currencyCode') WHEN 'EUR' THEN control.eur_enabled WHEN 'GBP' THEN control.gbp_enabled ELSE false END
      AND NOT control.production_value_flow_enabled
  ) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled';
  END IF;
  IF upper(p_command->>'currencyCode') NOT IN ('EUR', 'GBP') THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_currency_unavailable';
  END IF;
  IF upper(p_command->>'customerCountry') NOT IN ('FI', 'FR', 'DE', 'IE', 'GB')
     OR upper(p_command->>'merchantCountry') NOT IN ('DE', 'GB')
     OR p_command->>'chargeTopology' NOT IN ('platform', 'direct') THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_eligibility_mismatch';
  END IF;
  IF upper(p_command->>'customerCountry') IN ('FI', 'FR', 'DE', 'IE') THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_private_preview_unavailable';
  END IF;
  IF nullif(p_command->>'platformAccountId', '') IS NULL OR nullif(p_command->>'providerAccountId', '') IS NULL
     OR ((p_command->>'chargeTopology' = 'platform') <> (p_command->>'providerAccountId' = p_command->>'platformAccountId')) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_topology_account_mismatch';
  END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug = p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_payment FROM public.payments
    WHERE id = (p_command->>'paymentId')::bigint AND project_id = v_project.id AND deleted_at IS NULL;
  IF v_project.id IS NULL OR v_payment.id IS NULL THEN RAISE EXCEPTION 'stripe_pay_by_bank_payment_mismatch'; END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid, v_project.id) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_permission_denied';
  END IF;
  SELECT * INTO v_period FROM public.accounting_periods period
    WHERE period.status = 'open' AND NOT period.production_enabled
      AND period.starts_at < (v_payment.period_end + 1)::timestamptz
      AND period.ends_at > v_payment.period_start::timestamptz
    ORDER BY period.starts_at DESC LIMIT 1;
  SELECT * INTO v_quote FROM public.project_payment_funding_quotes quote
    WHERE quote.payment_id = v_payment.id AND quote.project_id = v_project.id
      AND quote.rail_key = 'stripe_pay_by_bank' AND quote.currency_code = upper(p_command->>'currencyCode')
      AND quote.freshness_expires_at > clock_timestamp()
      AND quote.obligation_usd_minor = round(v_payment.payment_amount * 100) AND NOT quote.production_enabled
    ORDER BY quote.observed_at DESC, quote.id DESC LIMIT 1;
  IF v_period.id IS NULL OR v_quote.id IS NULL THEN RAISE EXCEPTION 'stripe_pay_by_bank_funding_quote_unavailable'; END IF;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'contractVersion', 'stripe_pay_by_bank_prepare.v1', 'deploymentEnvironment', v_environment,
    'projectSlug', v_project.slug, 'paymentId', v_payment.id, 'currencyCode', upper(p_command->>'currencyCode'),
    'customerCountry', upper(p_command->>'customerCountry'), 'merchantCountry', upper(p_command->>'merchantCountry'),
    'chargeTopology', p_command->>'chargeTopology', 'providerAccountId', p_command->>'providerAccountId',
    'platformAccountId', p_command->>'platformAccountId', 'fundingQuoteId', v_quote.id,
    'expectedAmountMinor', v_quote.source_amount_minor
  )::text, 'UTF8'), 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'stripe-pay-by-bank:' || v_payment.id::text || ':' || upper(p_command->>'currencyCode'), 0));
  SELECT * INTO v_existing FROM public.stripe_pay_by_bank_commands
    WHERE payment_id = v_payment.id AND currency_code = upper(p_command->>'currencyCode');
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash OR v_existing.funding_quote_id IS DISTINCT FROM v_quote.id THEN
      RAISE EXCEPTION 'stripe_pay_by_bank_idempotency_conflict';
    END IF;
    RETURN v_existing.id;
  END IF;
  INSERT INTO public.stripe_pay_by_bank_commands(
    project_id, payment_id, accounting_period_id, actor_user_id, deployment_environment, currency_code,
    expected_amount_minor, customer_country, merchant_country, charge_topology, provider_account_id,
    platform_account_id, request_hash, funding_quote_id
  ) VALUES (
    v_project.id, v_payment.id, v_period.id, (p_command->>'actorUserId')::uuid, v_environment,
    upper(p_command->>'currencyCode'), v_quote.source_amount_minor, upper(p_command->>'customerCountry'),
    upper(p_command->>'merchantCountry'), p_command->>'chargeTopology', p_command->>'providerAccountId',
    p_command->>'platformAccountId', v_hash, v_quote.id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION public.enforce_stripe_pay_by_bank_country_reality() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.merchant_country NOT IN ('DE', 'GB') THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_eligibility_mismatch';
  END IF;
  IF NEW.customer_country <> 'GB' THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_private_preview_unavailable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stripe_pay_by_bank_country_reality
BEFORE INSERT ON public.stripe_pay_by_bank_commands
FOR EACH ROW EXECUTE FUNCTION public.enforce_stripe_pay_by_bank_country_reality();
