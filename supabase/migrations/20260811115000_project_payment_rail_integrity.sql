CREATE TABLE public.project_payment_funding_quotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES public.payments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rail_key text NOT NULL,
  currency_code text NOT NULL,
  obligation_usd_minor numeric(78,0) NOT NULL,
  source_amount_minor numeric(78,0) NOT NULL,
  rate_usd_per_unit numeric(38,18) NOT NULL,
  source_key text NOT NULL,
  observed_at timestamptz NOT NULL,
  freshness_expires_at timestamptz NOT NULL,
  evidence_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(payment_id,rail_key,currency_code,observed_at),
  CONSTRAINT project_payment_funding_quote_rail_check CHECK(
    (rail_key='stripe_acss_debit' AND currency_code='CAD')
    OR (rail_key='stripe_pay_by_bank' AND currency_code IN('EUR','GBP'))),
  CONSTRAINT project_payment_funding_quote_amount_check CHECK(
    obligation_usd_minor>0 AND source_amount_minor>0 AND rate_usd_per_unit>0),
  CONSTRAINT project_payment_funding_quote_source_check CHECK(source_key~'^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT project_payment_funding_quote_freshness_check CHECK(freshness_expires_at>observed_at),
  CONSTRAINT project_payment_funding_quote_hash_check CHECK(evidence_hash~'^[0-9a-f]{64}$'),
  CONSTRAINT project_payment_funding_quote_production_check CHECK(production_enabled=false)
);
CREATE INDEX project_payment_funding_quotes_lookup_idx
  ON public.project_payment_funding_quotes(payment_id,rail_key,currency_code,observed_at DESC,id DESC);
CREATE INDEX project_payment_funding_quotes_actor_idx ON public.project_payment_funding_quotes(actor_user_id,created_at DESC,id DESC);

CREATE FUNCTION public.reject_project_payment_funding_integrity_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'project_payment_funding_integrity_is_append_only'; END $$;
CREATE TRIGGER project_payment_funding_quotes_append_only
BEFORE UPDATE OR DELETE ON public.project_payment_funding_quotes
FOR EACH ROW EXECUTE FUNCTION public.reject_project_payment_funding_integrity_mutation();

CREATE FUNCTION public.post_project_payment_funding_quote(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_payment public.payments%ROWTYPE;
  v_project public.projects%ROWTYPE;v_route record;v_rate numeric(38,18);v_obligation numeric(78,0);v_source numeric(78,0);v_id bigint;
  v_observed timestamptz:=(p_command->>'observedAt')::timestamptz;v_expires timestamptz:=(p_command->>'freshnessExpiresAt')::timestamptz;
BEGIN
  IF p_command->>'contractVersion'<>'project_payment_funding_quote.v1' OR v_environment NOT IN('local','dev','test')
    OR lower(coalesce(p_command->>'railKey','')) NOT IN('stripe_acss_debit','stripe_pay_by_bank') THEN
    RAISE EXCEPTION 'project_payment_funding_quote_runtime_disabled';
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND deleted_at IS NULL FOR SHARE;
  SELECT * INTO v_project FROM public.projects WHERE id=v_payment.project_id AND deleted_at IS NULL;
  IF v_payment.id IS NULL OR v_project.id IS NULL OR NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN
    RAISE EXCEPTION 'project_payment_funding_quote_permission_denied';
  END IF;
  IF v_observed>clock_timestamp() OR v_expires<=clock_timestamp() THEN RAISE EXCEPTION 'project_payment_funding_quote_stale';END IF;
  v_rate:=(p_command->>'rateUsdPerUnit')::numeric;
  IF lower(p_command->>'railKey')='stripe_acss_debit' THEN
    SELECT route.currency_code,asset.atomic_scale INTO v_route
    FROM public.stripe_acss_debit_custody_routes route JOIN public.financial_assets asset ON asset.id=route.asset_id
    WHERE route.currency_code=upper(p_command->>'currencyCode') AND route.sandbox_enabled AND NOT route.production_enabled;
  ELSE
    SELECT route.currency_code,asset.atomic_scale INTO v_route
    FROM public.stripe_pay_by_bank_custody_routes route JOIN public.financial_assets asset ON asset.id=route.asset_id
    WHERE route.currency_code=upper(p_command->>'currencyCode') AND route.sandbox_enabled AND NOT route.production_enabled;
  END IF;
  IF v_route.currency_code IS NULL OR v_rate<=0 THEN RAISE EXCEPTION 'project_payment_funding_quote_dimensions_invalid';END IF;
  v_obligation:=round(v_payment.payment_amount*100);
  v_source:=round((v_payment.payment_amount/v_rate)*power(10::numeric,v_route.atomic_scale));
  IF v_source<=0 THEN RAISE EXCEPTION 'project_payment_funding_quote_amount_invalid';END IF;
  INSERT INTO public.project_payment_funding_quotes(payment_id,project_id,rail_key,currency_code,obligation_usd_minor,source_amount_minor,
    rate_usd_per_unit,source_key,observed_at,freshness_expires_at,evidence_hash,actor_user_id,deployment_environment)
  VALUES(v_payment.id,v_project.id,lower(p_command->>'railKey'),upper(p_command->>'currencyCode'),v_obligation,v_source,v_rate,
    p_command->>'sourceKey',v_observed,v_expires,p_command->>'evidenceHash',(p_command->>'actorUserId')::uuid,v_environment)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

ALTER TABLE public.stripe_acss_debit_commands ADD COLUMN funding_quote_id bigint
  REFERENCES public.project_payment_funding_quotes(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.stripe_pay_by_bank_commands ADD COLUMN funding_quote_id bigint
  REFERENCES public.project_payment_funding_quotes(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE UNIQUE INDEX stripe_acss_debit_commands_quote_idx ON public.stripe_acss_debit_commands(funding_quote_id) WHERE funding_quote_id IS NOT NULL;
CREATE UNIQUE INDEX stripe_pay_by_bank_commands_quote_idx ON public.stripe_pay_by_bank_commands(funding_quote_id) WHERE funding_quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_stripe_acss_debit_command(p_command jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_project public.projects%ROWTYPE;v_payment public.payments%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;v_existing public.stripe_acss_debit_commands%ROWTYPE;v_quote public.project_payment_funding_quotes%ROWTYPE;
  v_hash text;v_id uuid;
BEGIN
  IF p_command->>'contractVersion'<>'stripe_acss_debit_prepare.v1' OR v_environment NOT IN('local','dev','test') THEN RAISE EXCEPTION 'stripe_acss_runtime_disabled';END IF;
  IF upper(p_command->>'currencyCode')<>'CAD' THEN RAISE EXCEPTION 'stripe_acss_currency_unavailable';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_acss_debit_runtime_controls c
    WHERE c.deployment_environment=v_environment AND c.checkout_enabled AND c.cad_enabled AND NOT c.production_value_flow_enabled) THEN
    RAISE EXCEPTION 'stripe_acss_runtime_disabled';END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug=p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND project_id=v_project.id AND deleted_at IS NULL;
  IF v_project.id IS NULL OR v_payment.id IS NULL THEN RAISE EXCEPTION 'stripe_acss_payment_mismatch';END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN RAISE EXCEPTION 'stripe_acss_permission_denied';END IF;
  SELECT * INTO v_period FROM public.accounting_periods p WHERE p.status='open' AND NOT p.production_enabled
    AND p.starts_at<(v_payment.period_end+1)::timestamptz AND p.ends_at>v_payment.period_start::timestamptz ORDER BY p.starts_at DESC LIMIT 1;
  SELECT * INTO v_quote FROM public.project_payment_funding_quotes q WHERE q.payment_id=v_payment.id AND q.project_id=v_project.id
    AND q.rail_key='stripe_acss_debit' AND q.currency_code='CAD' AND q.freshness_expires_at>clock_timestamp()
    AND q.obligation_usd_minor=round(v_payment.payment_amount*100) AND NOT q.production_enabled
    ORDER BY q.observed_at DESC,q.id DESC LIMIT 1;
  IF v_period.id IS NULL OR v_quote.id IS NULL THEN RAISE EXCEPTION 'stripe_acss_funding_quote_unavailable';END IF;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('contractVersion','stripe_acss_debit_prepare.v1','deploymentEnvironment',v_environment,
    'projectSlug',v_project.slug,'paymentId',v_payment.id,'currencyCode','CAD','fundingQuoteId',v_quote.id,'expectedAmountMinor',v_quote.source_amount_minor)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-acss:'||v_payment.id::text||':CAD',0));
  SELECT * INTO v_existing FROM public.stripe_acss_debit_commands WHERE payment_id=v_payment.id AND currency_code='CAD';
  IF FOUND THEN IF v_existing.request_hash<>v_hash OR v_existing.funding_quote_id IS DISTINCT FROM v_quote.id THEN RAISE EXCEPTION 'stripe_acss_idempotency_conflict';END IF;RETURN v_existing.id;END IF;
  INSERT INTO public.stripe_acss_debit_commands(project_id,payment_id,accounting_period_id,actor_user_id,deployment_environment,currency_code,
    expected_amount_minor,request_hash,funding_quote_id)
  VALUES(v_project.id,v_payment.id,v_period.id,(p_command->>'actorUserId')::uuid,v_environment,'CAD',v_quote.source_amount_minor,v_hash,v_quote.id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.prepare_stripe_pay_by_bank_command(p_command jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_project public.projects%ROWTYPE;v_payment public.payments%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;v_existing public.stripe_pay_by_bank_commands%ROWTYPE;v_quote public.project_payment_funding_quotes%ROWTYPE;
  v_hash text;v_id uuid;
BEGIN
  IF p_command->>'contractVersion'<>'stripe_pay_by_bank_prepare.v1' OR v_environment NOT IN('local','dev','test') THEN RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_runtime_controls c WHERE c.deployment_environment=v_environment AND c.checkout_enabled
    AND CASE upper(p_command->>'currencyCode') WHEN'EUR'THEN c.eur_enabled WHEN'GBP'THEN c.gbp_enabled ELSE false END AND NOT c.production_value_flow_enabled)
    THEN RAISE EXCEPTION 'stripe_pay_by_bank_runtime_disabled';END IF;
  IF upper(p_command->>'currencyCode') NOT IN('EUR','GBP') THEN RAISE EXCEPTION 'stripe_pay_by_bank_currency_unavailable';END IF;
  IF upper(p_command->>'customerCountry') NOT IN('FI','FR','DE','IE','GB') OR upper(p_command->>'merchantCountry') NOT IN('AT','AU','BE','BG','CA','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SG','SI','SK','US')
    OR p_command->>'chargeTopology' NOT IN('platform','direct') THEN RAISE EXCEPTION 'stripe_pay_by_bank_eligibility_mismatch';END IF;
  IF upper(p_command->>'customerCountry') IN('FR','DE','IE') THEN RAISE EXCEPTION 'stripe_pay_by_bank_private_preview_unavailable';END IF;
  IF nullif(p_command->>'platformAccountId','') IS NULL OR nullif(p_command->>'providerAccountId','') IS NULL
    OR ((p_command->>'chargeTopology'='platform')<>(p_command->>'providerAccountId'=p_command->>'platformAccountId')) THEN
    RAISE EXCEPTION 'stripe_pay_by_bank_topology_account_mismatch';END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug=p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND project_id=v_project.id AND deleted_at IS NULL;
  IF v_project.id IS NULL OR v_payment.id IS NULL THEN RAISE EXCEPTION 'stripe_pay_by_bank_payment_mismatch';END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN RAISE EXCEPTION 'stripe_pay_by_bank_permission_denied';END IF;
  SELECT * INTO v_period FROM public.accounting_periods p WHERE p.status='open' AND NOT p.production_enabled
    AND p.starts_at<(v_payment.period_end+1)::timestamptz AND p.ends_at>v_payment.period_start::timestamptz ORDER BY p.starts_at DESC LIMIT 1;
  SELECT * INTO v_quote FROM public.project_payment_funding_quotes q WHERE q.payment_id=v_payment.id AND q.project_id=v_project.id
    AND q.rail_key='stripe_pay_by_bank' AND q.currency_code=upper(p_command->>'currencyCode') AND q.freshness_expires_at>clock_timestamp()
    AND q.obligation_usd_minor=round(v_payment.payment_amount*100) AND NOT q.production_enabled
    ORDER BY q.observed_at DESC,q.id DESC LIMIT 1;
  IF v_period.id IS NULL OR v_quote.id IS NULL THEN RAISE EXCEPTION 'stripe_pay_by_bank_funding_quote_unavailable';END IF;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('contractVersion','stripe_pay_by_bank_prepare.v1','deploymentEnvironment',v_environment,
    'projectSlug',v_project.slug,'paymentId',v_payment.id,'currencyCode',upper(p_command->>'currencyCode'),'customerCountry',upper(p_command->>'customerCountry'),
    'merchantCountry',upper(p_command->>'merchantCountry'),'chargeTopology',p_command->>'chargeTopology','providerAccountId',p_command->>'providerAccountId',
    'platformAccountId',p_command->>'platformAccountId','fundingQuoteId',v_quote.id,'expectedAmountMinor',v_quote.source_amount_minor)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-pay-by-bank:'||v_payment.id::text||':'||upper(p_command->>'currencyCode'),0));
  SELECT * INTO v_existing FROM public.stripe_pay_by_bank_commands WHERE payment_id=v_payment.id AND currency_code=upper(p_command->>'currencyCode');
  IF FOUND THEN IF v_existing.request_hash<>v_hash OR v_existing.funding_quote_id IS DISTINCT FROM v_quote.id THEN RAISE EXCEPTION 'stripe_pay_by_bank_idempotency_conflict';END IF;RETURN v_existing.id;END IF;
  INSERT INTO public.stripe_pay_by_bank_commands(project_id,payment_id,accounting_period_id,actor_user_id,deployment_environment,currency_code,
    expected_amount_minor,customer_country,merchant_country,charge_topology,provider_account_id,platform_account_id,request_hash,funding_quote_id)
  VALUES(v_project.id,v_payment.id,v_period.id,(p_command->>'actorUserId')::uuid,v_environment,upper(p_command->>'currencyCode'),v_quote.source_amount_minor,
    upper(p_command->>'customerCountry'),upper(p_command->>'merchantCountry'),p_command->>'chargeTopology',p_command->>'providerAccountId',p_command->>'platformAccountId',v_hash,v_quote.id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE TABLE public.project_payment_settled_rail_claims (
  payment_id bigint PRIMARY KEY REFERENCES public.payments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rail_key text NOT NULL CHECK(rail_key IN('stripe_bank_transfer','stripe_acss_debit','stripe_pay_by_bank')),
  command_reference text NOT NULL,
  evidence_hash text NOT NULL CHECK(evidence_hash~'^[0-9a-f]{64}$'),
  settled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  production_enabled boolean NOT NULL DEFAULT false CHECK(production_enabled=false),
  UNIQUE(rail_key,command_reference)
);
CREATE TRIGGER project_payment_settled_rail_claims_append_only
BEFORE UPDATE OR DELETE ON public.project_payment_settled_rail_claims
FOR EACH ROW EXECUTE FUNCTION public.reject_project_payment_funding_integrity_mutation();

DO $$
BEGIN
  IF EXISTS(
    SELECT payment_id FROM(
      SELECT i.payment_id,'stripe_bank_transfer' rail_key,i.id::text command_reference FROM public.stripe_bank_transfer_evidence e JOIN public.stripe_bank_transfer_intents i ON i.id=e.intent_id WHERE e.evidence_type='available' AND e.ledger_transaction_id IS NOT NULL
      UNION SELECT c.payment_id,'stripe_acss_debit',c.id::text FROM public.stripe_acss_debit_evidence e JOIN public.stripe_acss_debit_commands c ON c.id=e.command_id WHERE e.evidence_type='settled_available' AND e.ledger_transaction_id IS NOT NULL
      UNION SELECT c.payment_id,'stripe_pay_by_bank',c.id::text FROM public.stripe_pay_by_bank_evidence e JOIN public.stripe_pay_by_bank_commands c ON c.id=e.command_id WHERE e.evidence_type='settled_available' AND e.ledger_transaction_id IS NOT NULL
    ) settled GROUP BY payment_id HAVING count(DISTINCT rail_key||':'||command_reference)>1
  ) THEN RAISE EXCEPTION 'project_payment_multiple_settled_rails_existing';END IF;
END $$;

INSERT INTO public.project_payment_settled_rail_claims(payment_id,rail_key,command_reference,evidence_hash,settled_at)
SELECT DISTINCT ON(payment_id) payment_id,rail_key,command_reference,evidence_hash,settled_at FROM(
  SELECT i.payment_id,'stripe_bank_transfer' rail_key,i.id::text command_reference,e.evidence_hash,e.created_at settled_at FROM public.stripe_bank_transfer_evidence e JOIN public.stripe_bank_transfer_intents i ON i.id=e.intent_id WHERE e.evidence_type='available' AND e.ledger_transaction_id IS NOT NULL
  UNION ALL SELECT c.payment_id,'stripe_acss_debit',c.id::text,e.evidence_hash,e.created_at FROM public.stripe_acss_debit_evidence e JOIN public.stripe_acss_debit_commands c ON c.id=e.command_id WHERE e.evidence_type='settled_available' AND e.ledger_transaction_id IS NOT NULL
  UNION ALL SELECT c.payment_id,'stripe_pay_by_bank',c.id::text,e.evidence_hash,e.created_at FROM public.stripe_pay_by_bank_evidence e JOIN public.stripe_pay_by_bank_commands c ON c.id=e.command_id WHERE e.evidence_type='settled_available' AND e.ledger_transaction_id IS NOT NULL
) settled ORDER BY payment_id,settled_at,rail_key,command_reference ON CONFLICT(payment_id) DO NOTHING;

CREATE FUNCTION public.claim_project_payment_settled_rail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payment_id bigint;v_rail text;v_reference text;v_claim public.project_payment_settled_rail_claims%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='stripe_bank_transfer_evidence' THEN
    IF NEW.evidence_type<>'available' OR NEW.ledger_transaction_id IS NULL THEN RETURN NEW;END IF;
    SELECT payment_id INTO v_payment_id FROM public.stripe_bank_transfer_intents WHERE id=NEW.intent_id;
    v_rail:='stripe_bank_transfer';v_reference:=NEW.intent_id::text;
  ELSIF TG_TABLE_NAME='stripe_acss_debit_evidence' THEN
    IF NEW.evidence_type<>'settled_available' OR NEW.ledger_transaction_id IS NULL THEN RETURN NEW;END IF;
    SELECT payment_id INTO v_payment_id FROM public.stripe_acss_debit_commands WHERE id=NEW.command_id;
    v_rail:='stripe_acss_debit';v_reference:=NEW.command_id::text;
  ELSE
    IF NEW.evidence_type<>'settled_available' OR NEW.ledger_transaction_id IS NULL THEN RETURN NEW;END IF;
    SELECT payment_id INTO v_payment_id FROM public.stripe_pay_by_bank_commands WHERE id=NEW.command_id;
    v_rail:='stripe_pay_by_bank';v_reference:=NEW.command_id::text;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-payment-settled-rail:'||v_payment_id::text,0));
  SELECT * INTO v_claim FROM public.project_payment_settled_rail_claims WHERE payment_id=v_payment_id;
  IF FOUND THEN
    IF v_claim.rail_key<>v_rail OR v_claim.command_reference<>v_reference THEN RAISE EXCEPTION 'project_payment_already_settled_on_another_rail';END IF;
    RETURN NEW;
  END IF;
  INSERT INTO public.project_payment_settled_rail_claims(payment_id,rail_key,command_reference,evidence_hash)
  VALUES(v_payment_id,v_rail,v_reference,NEW.evidence_hash);
  RETURN NEW;
END $$;
CREATE TRIGGER stripe_bank_transfer_claim_settled_rail AFTER INSERT ON public.stripe_bank_transfer_evidence
FOR EACH ROW EXECUTE FUNCTION public.claim_project_payment_settled_rail();
CREATE TRIGGER stripe_acss_debit_claim_settled_rail AFTER INSERT ON public.stripe_acss_debit_evidence
FOR EACH ROW EXECUTE FUNCTION public.claim_project_payment_settled_rail();
CREATE TRIGGER stripe_pay_by_bank_claim_settled_rail AFTER INSERT ON public.stripe_pay_by_bank_evidence
FOR EACH ROW EXECUTE FUNCTION public.claim_project_payment_settled_rail();

CREATE FUNCTION public.enforce_project_payment_funding_source_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payment_id bigint;v_reference text;v_quote_id bigint;v_expected numeric(78,0);
BEGIN
  IF NEW.source_kind='stripe_bank_transfer' THEN
    SELECT payment_id,id::text,expected_amount_minor INTO v_payment_id,v_reference,v_expected FROM public.stripe_bank_transfer_intents WHERE id=NEW.stripe_intent_id;
  ELSIF NEW.source_kind='stripe_acss_debit' THEN
    SELECT payment_id,id::text,funding_quote_id,expected_amount_minor INTO v_payment_id,v_reference,v_quote_id,v_expected FROM public.stripe_acss_debit_commands WHERE id=NEW.stripe_acss_debit_command_id;
  ELSIF NEW.source_kind='stripe_pay_by_bank' THEN
    SELECT payment_id,id::text,funding_quote_id,expected_amount_minor INTO v_payment_id,v_reference,v_quote_id,v_expected FROM public.stripe_pay_by_bank_commands WHERE id=NEW.stripe_pay_by_bank_command_id;
  ELSE RETURN NEW;
  END IF;
  IF v_payment_id IS NULL OR v_expected<>NEW.native_atomic_amount
    OR (NEW.source_kind IN('stripe_acss_debit','stripe_pay_by_bank') AND v_quote_id IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.project_payment_settled_rail_claims claim
      WHERE claim.payment_id=v_payment_id AND claim.rail_key=NEW.source_kind AND claim.command_reference=v_reference) THEN
    RAISE EXCEPTION 'epoch_project_package_payment_rail_claim_mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER epoch_project_package_funding_source_claim_before_insert
BEFORE INSERT ON public.epoch_project_package_funding_sources
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_payment_funding_source_claim();

CREATE OR REPLACE FUNCTION public.enforce_stripe_acss_debit_evidence_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_acss_debit_commands%ROWTYPE;v_terminal_without_mandate boolean:=NEW.evidence_type IN('failed','canceled');
BEGIN
  SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=NEW.command_id FOR UPDATE;
  IF v_command.id IS NULL OR NEW.provider_checkout_session_id IS NULL OR NEW.provider_checkout_session_id<>v_command.provider_checkout_session_id
    OR NEW.provider_payment_intent_id IS NULL OR (NOT v_terminal_without_mandate AND NEW.provider_mandate_id IS NULL) THEN
    RAISE EXCEPTION 'stripe_acss_provider_identity_missing';
  END IF;
  IF (v_command.provider_payment_intent_id IS NOT NULL AND v_command.provider_payment_intent_id<>NEW.provider_payment_intent_id)
    OR (v_command.provider_charge_id IS NOT NULL AND NEW.provider_charge_id IS NOT NULL AND v_command.provider_charge_id<>NEW.provider_charge_id)
    OR (v_command.provider_mandate_id IS NOT NULL AND NEW.provider_mandate_id IS NOT NULL AND v_command.provider_mandate_id<>NEW.provider_mandate_id) THEN
    RAISE EXCEPTION 'stripe_acss_provider_identity_conflict';
  END IF;
  IF NEW.evidence_type='settled_available' AND EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence e
    WHERE e.command_id=NEW.command_id AND e.evidence_type IN('refunded','dispute_lost')) THEN RAISE EXCEPTION 'stripe_acss_terminal_evidence_blocks_settlement';END IF;
  UPDATE public.stripe_acss_debit_commands SET provider_payment_intent_id=coalesce(provider_payment_intent_id,NEW.provider_payment_intent_id),
    provider_charge_id=coalesce(provider_charge_id,NEW.provider_charge_id),provider_mandate_id=coalesce(provider_mandate_id,NEW.provider_mandate_id)
  WHERE id=NEW.command_id;
  RETURN NEW;
END $$;

ALTER FUNCTION public.ingest_stripe_acss_debit_webhook(jsonb) RENAME TO ingest_stripe_acss_debit_webhook_requiring_mandate;
CREATE FUNCTION public.ingest_stripe_acss_debit_webhook(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_command public.stripe_acss_debit_commands%ROWTYPE;
  v_event public.stripe_webhook_events%ROWTYPE;v_event_id bigint;v_evidence_id bigint;v_ordering text;v_command_hash text;
BEGIN
  IF p_command->>'evidenceType' NOT IN('failed','canceled') OR nullif(p_command->>'providerMandateId','') IS NOT NULL THEN
    RETURN public.ingest_stripe_acss_debit_webhook_requiring_mandate(p_command);
  END IF;
  IF p_command->>'contractVersion'<>'stripe_acss_debit_webhook.v1' OR v_environment NOT IN('local','dev','test')
    OR p_command->>'observationSource'<>'stripe_sdk_v1' OR coalesce((p_command->>'livemode')::boolean,true)
    OR NOT ((p_command->>'eventType'='payment_intent.payment_failed' AND p_command->>'evidenceType'='failed')
      OR (p_command->>'eventType'='payment_intent.canceled' AND p_command->>'evidenceType'='canceled')) THEN
    RAISE EXCEPTION 'stripe_acss_webhook_runtime_disabled';
  END IF;
  SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=(p_command->>'commandId')::uuid FOR UPDATE;
  IF v_command.id IS NULL OR v_command.currency_code<>upper(p_command->>'currencyCode')
    OR v_command.expected_amount_minor<>(p_command->>'grossAmountMinor')::numeric
    OR (v_command.provider_account_id IS NOT NULL AND v_command.provider_account_id<>p_command->>'providerAccountId') THEN
    RAISE EXCEPTION 'stripe_acss_observation_mismatch';
  END IF;
  IF v_command.provider_checkout_session_id IS NULL THEN
    PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_command.id,'providerAccountId',p_command->>'providerAccountId',
      'providerCheckoutSessionId',p_command->>'providerCheckoutSessionId','capabilityEvidenceHash',p_command->>'capabilityEvidenceHash'));
    SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=v_command.id;
  END IF;
  IF v_command.provider_checkout_session_id<>p_command->>'providerCheckoutSessionId' OR nullif(p_command->>'providerPaymentIntentId','') IS NULL
    OR coalesce(nullif(p_command->>'paymentMethodType',''),'acss_debit')<>'acss_debit'
    OR (v_command.provider_payment_intent_id IS NOT NULL AND v_command.provider_payment_intent_id<>p_command->>'providerPaymentIntentId') THEN
    RAISE EXCEPTION 'stripe_acss_mandate_or_session_mismatch';
  END IF;
  v_command_hash:=encode(extensions.digest(convert_to((p_command-ARRAY['signatureTimestamp']::text[])::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-webhook:'||(p_command->>'providerEventId'),0));
  SELECT * INTO v_event FROM public.stripe_webhook_events WHERE provider_event_id=p_command->>'providerEventId';
  IF FOUND THEN
    IF v_event.command_sha256<>v_command_hash THEN RAISE EXCEPTION 'stripe_acss_webhook_dedupe_conflict';END IF;
  ELSE
    INSERT INTO public.stripe_webhook_events(provider_event_id,provider_account_id,event_type,provider_object_id,provider_created_at,api_version,
      signature_timestamp,payload_sha256,command_sha256,livemode,observation_source)
    VALUES(p_command->>'providerEventId',p_command->>'providerAccountId',p_command->>'eventType',p_command->>'providerObjectId',
      (p_command->>'providerCreatedAt')::timestamptz,nullif(p_command->>'apiVersion',''),(p_command->>'signatureTimestamp')::bigint,
      p_command->>'payloadSha256',v_command_hash,false,'stripe_sdk_v1') RETURNING id INTO v_event_id;
  END IF;
  v_event_id:=coalesce(v_event.id,v_event_id);
  SELECT id INTO v_evidence_id FROM public.stripe_acss_debit_evidence WHERE webhook_event_id=v_event_id AND command_id=v_command.id;
  IF v_evidence_id IS NOT NULL THEN RETURN v_evidence_id;END IF;
  v_ordering:=CASE WHEN EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
    WHERE e.command_id=v_command.id AND w.provider_created_at>=(p_command->>'providerCreatedAt')::timestamptz) THEN'out_of_order' ELSE'in_order' END;
  INSERT INTO public.stripe_acss_debit_evidence(webhook_event_id,command_id,evidence_type,provider_checkout_session_id,provider_payment_intent_id,
    provider_charge_id,provider_mandate_id,provider_balance_transaction_id,currency_code,gross_amount_minor,fee_amount_minor,net_amount_minor,
    balance_status,ordering_status,evidence_hash)
  VALUES(v_event_id,v_command.id,p_command->>'evidenceType',p_command->>'providerCheckoutSessionId',p_command->>'providerPaymentIntentId',
    nullif(p_command->>'providerChargeId',''),NULL,NULL,v_command.currency_code,(p_command->>'grossAmountMinor')::numeric,NULL,NULL,NULL,v_ordering,p_command->>'payloadSha256')
  RETURNING id INTO v_evidence_id;
  RETURN v_evidence_id;
END $$;

ALTER TABLE public.project_payment_funding_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payment_settled_rail_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_payment_funding_quotes,public.project_payment_settled_rail_claims FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.project_payment_funding_quotes,public.project_payment_settled_rail_claims TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.project_payment_funding_quotes,public.project_payment_settled_rail_claims FROM service_role;
REVOKE ALL ON FUNCTION public.post_project_payment_funding_quote(jsonb),public.ingest_stripe_acss_debit_webhook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_project_payment_funding_quote(jsonb),public.ingest_stripe_acss_debit_webhook(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ingest_stripe_acss_debit_webhook_requiring_mandate(jsonb),public.claim_project_payment_settled_rail(),
  public.enforce_project_payment_funding_source_claim(),public.reject_project_payment_funding_integrity_mutation() FROM PUBLIC,anon,authenticated,service_role;
