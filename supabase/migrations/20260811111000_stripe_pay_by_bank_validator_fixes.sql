ALTER TABLE public.stripe_pay_by_bank_commands
  ADD COLUMN platform_account_id text;
UPDATE public.stripe_pay_by_bank_commands SET platform_account_id=provider_account_id WHERE platform_account_id IS NULL;
ALTER TABLE public.stripe_pay_by_bank_commands ALTER COLUMN platform_account_id SET NOT NULL;
ALTER TABLE public.stripe_pay_by_bank_commands
  ADD CONSTRAINT stripe_pay_by_bank_platform_account_check CHECK(platform_account_id~'^acct_[A-Za-z0-9]+$'),
  DROP CONSTRAINT stripe_pay_by_bank_command_topology_check,
  ADD CONSTRAINT stripe_pay_by_bank_command_topology_check CHECK(charge_topology IN('platform','direct')),
  ADD CONSTRAINT stripe_pay_by_bank_command_topology_identity_check CHECK(
    (charge_topology='platform' AND provider_account_id=platform_account_id)
    OR (charge_topology='direct' AND provider_account_id<>platform_account_id));

CREATE OR REPLACE FUNCTION public.prepare_stripe_pay_by_bank_command(p_command jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_project public.projects%ROWTYPE;v_payment public.payments%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;v_existing public.stripe_pay_by_bank_commands%ROWTYPE;v_hash text;v_id uuid;
BEGIN
  IF p_command->>'contractVersion'<>'stripe_pay_by_bank_prepare.v1' OR v_environment NOT IN('local','dev','test') THEN RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_runtime_controls c WHERE c.deployment_environment=v_environment AND c.checkout_enabled
    AND CASE upper(p_command->>'currencyCode') WHEN'EUR'THEN c.eur_enabled WHEN'GBP'THEN c.gbp_enabled ELSE false END AND NOT c.production_value_flow_enabled)
    THEN RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled'; END IF;
  IF upper(p_command->>'currencyCode') NOT IN('EUR','GBP') THEN RAISE EXCEPTION 'stripe_pay_by_bank_currency_unavailable'; END IF;
  IF upper(p_command->>'customerCountry') NOT IN('FI','FR','DE','IE','GB') OR upper(p_command->>'merchantCountry') NOT IN('AT','AU','BE','BG','CA','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SG','SI','SK','US')
    OR p_command->>'chargeTopology' NOT IN('platform','direct') THEN RAISE EXCEPTION 'stripe_pay_by_bank_eligibility_mismatch';END IF;
  IF upper(p_command->>'customerCountry') IN('FR','DE','IE') THEN RAISE EXCEPTION 'stripe_pay_by_bank_private_preview_unavailable';END IF;
  IF nullif(p_command->>'platformAccountId','') IS NULL OR nullif(p_command->>'providerAccountId','') IS NULL
    OR ((p_command->>'chargeTopology'='platform')<>(p_command->>'providerAccountId'=p_command->>'platformAccountId')) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_topology_account_mismatch';
  END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug=p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND project_id=v_project.id AND deleted_at IS NULL;
  IF v_project.id IS NULL OR v_payment.id IS NULL OR round(v_payment.payment_amount*100)<>(p_command->>'expectedAmountMinor')::numeric THEN RAISE EXCEPTION 'stripe_pay_by_bank_payment_mismatch'; END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN RAISE EXCEPTION 'stripe_pay_by_bank_permission_denied'; END IF;
  SELECT * INTO v_period FROM public.accounting_periods p WHERE p.status='open' AND NOT p.production_enabled
    AND p.starts_at<(v_payment.period_end+1)::timestamptz AND p.ends_at>v_payment.period_start::timestamptz ORDER BY p.starts_at DESC LIMIT 1;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'stripe_pay_by_bank_period_unavailable'; END IF;
  v_hash:=encode(extensions.digest(convert_to((p_command-ARRAY['actorUserId']::text[])::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-pay-by-bank:'||v_payment.id::text||':'||upper(p_command->>'currencyCode'),0));
  SELECT * INTO v_existing FROM public.stripe_pay_by_bank_commands WHERE payment_id=v_payment.id AND currency_code=upper(p_command->>'currencyCode');
  IF FOUND THEN IF v_existing.request_hash<>v_hash THEN RAISE EXCEPTION 'stripe_pay_by_bank_idempotency_conflict'; END IF;RETURN v_existing.id;END IF;
  INSERT INTO public.stripe_pay_by_bank_commands(project_id,payment_id,accounting_period_id,actor_user_id,deployment_environment,currency_code,expected_amount_minor,
    customer_country,merchant_country,charge_topology,provider_account_id,platform_account_id,request_hash)
  VALUES(v_project.id,v_payment.id,v_period.id,(p_command->>'actorUserId')::uuid,v_environment,upper(p_command->>'currencyCode'),(p_command->>'expectedAmountMinor')::numeric,
    upper(p_command->>'customerCountry'),upper(p_command->>'merchantCountry'),p_command->>'chargeTopology',p_command->>'providerAccountId',p_command->>'platformAccountId',v_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE TABLE public.stripe_pay_by_bank_residual_retirements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  command_id uuid NOT NULL REFERENCES public.stripe_pay_by_bank_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  refund_evidence_id bigint NOT NULL REFERENCES public.stripe_pay_by_bank_evidence(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  residual_transaction_id bigint NOT NULL REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversal_transaction_id bigint NOT NULL REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  production_enabled boolean NOT NULL DEFAULT false CHECK(production_enabled=false),
  UNIQUE(refund_evidence_id,residual_transaction_id),
  UNIQUE(reversal_transaction_id)
);
CREATE INDEX stripe_pay_by_bank_residual_retirements_command_idx
  ON public.stripe_pay_by_bank_residual_retirements(command_id,created_at DESC,id DESC);

CREATE FUNCTION public.retire_prior_stripe_pay_by_bank_residuals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_pay_by_bank_commands%ROWTYPE;v_period public.accounting_periods%ROWTYPE;
  v_prior record;v_reversal bigint;v_effective_at timestamptz;
BEGIN
  IF NEW.evidence_type<>'refunded' THEN RETURN NEW;END IF;
  SELECT * INTO v_command FROM public.stripe_pay_by_bank_commands WHERE id=NEW.command_id FOR UPDATE;
  SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_command.accounting_period_id;
  SELECT provider_created_at INTO v_effective_at FROM public.stripe_webhook_events WHERE id=NEW.webhook_event_id;
  FOR v_prior IN
    SELECT e.ledger_transaction_id FROM public.stripe_pay_by_bank_evidence e
    WHERE e.command_id=NEW.command_id AND e.evidence_type='refunded' AND e.id<>NEW.id AND e.ledger_transaction_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions r WHERE r.reversal_of_transaction_id=e.ledger_transaction_id)
    ORDER BY e.id
  LOOP
    v_reversal:=public.reverse_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_reversal.v1',
      'deploymentEnvironment',v_command.deployment_environment,'idempotencyKey','stripe:pay-by-bank:residual-retire:'||NEW.id::text||':'||v_prior.ledger_transaction_id::text,
      'originalTransactionId',v_prior.ledger_transaction_id::text,'periodKey',v_period.period_key,'evidenceHash',NEW.evidence_hash,
      'actorType','service','effectiveAt',v_effective_at::text));
    INSERT INTO public.stripe_pay_by_bank_residual_retirements(command_id,refund_evidence_id,residual_transaction_id,reversal_transaction_id)
    VALUES(NEW.command_id,NEW.id,v_prior.ledger_transaction_id,v_reversal);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER stripe_pay_by_bank_evidence_retire_prior_residuals_after_insert
AFTER INSERT ON public.stripe_pay_by_bank_evidence FOR EACH ROW
EXECUTE FUNCTION public.retire_prior_stripe_pay_by_bank_residuals();

ALTER TABLE public.stripe_pay_by_bank_residual_retirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_pay_by_bank_residual_retirements FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.stripe_pay_by_bank_residual_retirements TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.stripe_pay_by_bank_residual_retirements FROM service_role;
REVOKE ALL ON FUNCTION public.retire_prior_stripe_pay_by_bank_residuals() FROM PUBLIC,anon,authenticated,service_role;
