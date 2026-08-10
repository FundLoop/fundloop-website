CREATE TABLE public.stripe_bank_transfer_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sandbox_enabled boolean NOT NULL DEFAULT false,
  usd_bank_transfer_enabled boolean NOT NULL DEFAULT false,
  cad_bank_transfer_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  provider_evidence_status text NOT NULL DEFAULT 'unavailable',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_runtime_evidence_check CHECK (provider_evidence_status IN ('unavailable','local_fixture','sandbox_verified')),
  CONSTRAINT stripe_runtime_cad_unavailable_check CHECK (cad_bank_transfer_enabled = false),
  CONSTRAINT stripe_runtime_production_closed_check CHECK (
    deployment_environment <> 'production' OR (
      sandbox_enabled = false AND usd_bank_transfer_enabled = false AND cad_bank_transfer_enabled = false
      AND production_value_flow_enabled = false AND provider_evidence_status = 'unavailable'
    )
  ),
  CONSTRAINT stripe_runtime_value_flow_disabled_check CHECK (production_value_flow_enabled = false)
);

INSERT INTO public.stripe_bank_transfer_runtime_controls (
  deployment_environment, sandbox_enabled, usd_bank_transfer_enabled, provider_evidence_status
) VALUES
  ('local', true, true, 'local_fixture'),
  ('dev', true, true, 'local_fixture'),
  ('test', true, true, 'local_fixture'),
  ('production', false, false, 'unavailable')
ON CONFLICT (deployment_environment) DO NOTHING;

CREATE TABLE public.stripe_bank_transfer_custody_routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  currency_code text NOT NULL UNIQUE,
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  topology_status text NOT NULL DEFAULT 'clearing_sweep_required',
  sandbox_enabled boolean NOT NULL DEFAULT false,
  production_enabled boolean NOT NULL DEFAULT false,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_custody_currency_check CHECK (currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_custody_asset_fk FOREIGN KEY(asset_id,custody_account_id) REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT stripe_custody_topology_check CHECK (topology_status IN ('clearing_sweep_required','separated_custody_verified')),
  CONSTRAINT stripe_custody_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_custody_production_disabled_check CHECK (production_enabled = false)
);
CREATE INDEX stripe_bank_transfer_custody_routes_asset_custody_idx
  ON public.stripe_bank_transfer_custody_routes(asset_id,custody_account_id);

CREATE TABLE public.stripe_bank_transfer_intents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payment_id bigint NOT NULL REFERENCES public.payments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  accounting_period_id bigint NOT NULL REFERENCES public.accounting_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  currency_code text NOT NULL,
  expected_amount_minor numeric(78,0) NOT NULL,
  provider_account_id text NOT NULL,
  provider_customer_id text NOT NULL UNIQUE,
  provider_payment_intent_id text NOT NULL UNIQUE,
  instruction_status text NOT NULL DEFAULT 'instructions_created',
  instruction_evidence_hash text NOT NULL,
  deployment_environment text NOT NULL REFERENCES public.stripe_bank_transfer_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_id,currency_code),
  CONSTRAINT stripe_intent_currency_check CHECK (currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_intent_amount_check CHECK (expected_amount_minor > 0),
  CONSTRAINT stripe_intent_account_check CHECK (provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
  CONSTRAINT stripe_intent_customer_check CHECK (provider_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  CONSTRAINT stripe_intent_provider_id_check CHECK (provider_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  CONSTRAINT stripe_intent_status_check CHECK (instruction_status = 'instructions_created'),
  CONSTRAINT stripe_intent_hash_check CHECK (instruction_evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_intent_production_disabled_check CHECK (production_enabled = false)
);
CREATE INDEX stripe_bank_transfer_intents_project_created_idx ON public.stripe_bank_transfer_intents(project_id,created_at DESC,id DESC);
CREATE INDEX stripe_bank_transfer_intents_period_idx ON public.stripe_bank_transfer_intents(accounting_period_id);
CREATE INDEX stripe_bank_transfer_intents_actor_idx ON public.stripe_bank_transfer_intents(actor_user_id);
CREATE INDEX stripe_bank_transfer_intents_environment_idx ON public.stripe_bank_transfer_intents(deployment_environment);

CREATE TABLE public.stripe_webhook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_event_id text NOT NULL UNIQUE,
  provider_account_id text NOT NULL,
  event_type text NOT NULL,
  provider_object_id text NOT NULL,
  provider_created_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  api_version text,
  signature_timestamp bigint NOT NULL,
  payload_sha256 text NOT NULL,
  command_sha256 text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  observation_source text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT stripe_webhook_event_id_check CHECK (provider_event_id ~ '^evt_[A-Za-z0-9]+$'),
  CONSTRAINT stripe_webhook_account_check CHECK (provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
  CONSTRAINT stripe_webhook_object_check CHECK (length(provider_object_id) BETWEEN 3 AND 255),
  CONSTRAINT stripe_webhook_type_check CHECK (event_type ~ '^[a-z0-9_.]+$'),
  CONSTRAINT stripe_webhook_payload_hash_check CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_webhook_command_hash_check CHECK (command_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_webhook_test_only_check CHECK (livemode = false AND production_enabled = false),
  CONSTRAINT stripe_webhook_source_check CHECK (observation_source = 'stripe_sdk_v1')
);

CREATE TABLE public.stripe_bank_transfer_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  webhook_event_id bigint NOT NULL UNIQUE REFERENCES public.stripe_webhook_events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  intent_id bigint REFERENCES public.stripe_bank_transfer_intents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_type text NOT NULL,
  currency_code text,
  gross_amount_minor numeric(78,0),
  fee_amount_minor numeric(78,0),
  net_amount_minor numeric(78,0),
  provider_balance_transaction_id text,
  provider_balance_currency_code text,
  provider_balance_gross_amount_minor numeric(78,0),
  provider_balance_fee_amount_minor numeric(78,0),
  provider_balance_net_amount_minor numeric(78,0),
  ordering_status text NOT NULL,
  evidence_hash text NOT NULL,
  ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  external_financial_event_id bigint REFERENCES public.external_financial_events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversal_ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT stripe_evidence_type_check CHECK (evidence_type IN ('funded','processing','available','failed','canceled','refunded','disputed','dispute_won','dispute_lost','balance_available')),
  CONSTRAINT stripe_evidence_currency_check CHECK (currency_code IS NULL OR currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_evidence_amounts_check CHECK (
    (gross_amount_minor IS NULL OR gross_amount_minor >= 0)
    AND (fee_amount_minor IS NULL OR fee_amount_minor >= 0)
    AND (net_amount_minor IS NULL OR net_amount_minor >= 0)
    AND (gross_amount_minor IS NULL OR fee_amount_minor IS NULL OR net_amount_minor IS NULL OR gross_amount_minor = fee_amount_minor + net_amount_minor)
  ),
  CONSTRAINT stripe_evidence_ordering_check CHECK (ordering_status IN ('in_order','out_of_order','unsequenced')),
  CONSTRAINT stripe_evidence_balance_currency_check CHECK (provider_balance_currency_code IS NULL OR provider_balance_currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_evidence_balance_amounts_check CHECK (
    (provider_balance_gross_amount_minor IS NULL AND provider_balance_fee_amount_minor IS NULL AND provider_balance_net_amount_minor IS NULL)
    OR (
      provider_balance_currency_code IS NOT NULL
      AND provider_balance_gross_amount_minor >= 0
      AND provider_balance_fee_amount_minor >= 0
      AND provider_balance_net_amount_minor >= 0
      AND provider_balance_gross_amount_minor = provider_balance_fee_amount_minor + provider_balance_net_amount_minor
    )
  ),
  CONSTRAINT stripe_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_evidence_production_disabled_check CHECK (production_enabled = false)
);
CREATE INDEX stripe_bank_transfer_evidence_intent_order_idx ON public.stripe_bank_transfer_evidence(intent_id,id DESC) WHERE intent_id IS NOT NULL;
CREATE INDEX stripe_bank_transfer_evidence_ledger_idx ON public.stripe_bank_transfer_evidence(ledger_transaction_id) WHERE ledger_transaction_id IS NOT NULL;
CREATE INDEX stripe_bank_transfer_evidence_external_event_idx ON public.stripe_bank_transfer_evidence(external_financial_event_id) WHERE external_financial_event_id IS NOT NULL;
CREATE INDEX stripe_bank_transfer_evidence_reversal_idx ON public.stripe_bank_transfer_evidence(reversal_ledger_transaction_id) WHERE reversal_ledger_transaction_id IS NOT NULL;

CREATE TABLE public.stripe_balance_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  webhook_event_id bigint NOT NULL REFERENCES public.stripe_webhook_events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  currency_code text NOT NULL,
  available_amount_minor numeric(78,0) NOT NULL,
  pending_amount_minor numeric(78,0) NOT NULL,
  observed_at timestamptz NOT NULL,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(webhook_event_id,currency_code),
  CONSTRAINT stripe_balance_currency_check CHECK (currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_balance_amount_check CHECK (available_amount_minor >= 0 AND pending_amount_minor >= 0),
  CONSTRAINT stripe_balance_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_balance_production_disabled_check CHECK (production_enabled = false)
);

CREATE TABLE public.stripe_clearing_sweep_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  currency_code text NOT NULL,
  provider_transfer_id text NOT NULL UNIQUE,
  amount_minor numeric(78,0) NOT NULL,
  from_reference_hash text NOT NULL,
  to_reference_hash text NOT NULL,
  swept_at timestamptz NOT NULL,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_sweep_currency_check CHECK (currency_code IN ('USD','CAD')),
  CONSTRAINT stripe_sweep_amount_check CHECK (amount_minor > 0),
  CONSTRAINT stripe_sweep_reference_hash_check CHECK (from_reference_hash ~ '^[0-9a-f]{64}$' AND to_reference_hash ~ '^[0-9a-f]{64}$' AND from_reference_hash <> to_reference_hash),
  CONSTRAINT stripe_sweep_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_sweep_production_disabled_check CHECK (production_enabled = false)
);

CREATE FUNCTION public.reject_stripe_intake_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'stripe_intake_records_are_append_only'; END;
$$;
CREATE TRIGGER stripe_intents_append_only BEFORE UPDATE OR DELETE ON public.stripe_bank_transfer_intents FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_intake_mutation();
CREATE TRIGGER stripe_webhooks_append_only BEFORE UPDATE OR DELETE ON public.stripe_webhook_events FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_intake_mutation();
CREATE TRIGGER stripe_evidence_append_only BEFORE UPDATE OR DELETE ON public.stripe_bank_transfer_evidence FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_intake_mutation();
CREATE TRIGGER stripe_balances_append_only BEFORE UPDATE OR DELETE ON public.stripe_balance_snapshots FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_intake_mutation();
CREATE TRIGGER stripe_sweeps_append_only BEFORE UPDATE OR DELETE ON public.stripe_clearing_sweep_evidence FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_intake_mutation();

CREATE FUNCTION public.is_project_financial_admin(p_actor_user_id uuid,p_project_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.participants p WHERE p.project_id=p_project_id AND p.user_id=p_actor_user_id AND p.is_admin)
  OR EXISTS(
    SELECT 1 FROM public.projects p
    JOIN public.organization_members om ON om.organization_id=p.organization_id AND om.user_id=p_actor_user_id AND om.status='active' AND om.deleted_at IS NULL
    JOIN public.ref_roles r ON r.id=om.role_id AND r.name IN('Founder','Admin')
    WHERE p.id=p_project_id
  );
$$;

CREATE FUNCTION public.record_stripe_bank_transfer_intent(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));
  v_currency text:=upper(coalesce(p_command->>'currencyCode',''));
  v_payment public.payments%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_existing public.stripe_bank_transfer_intents%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_id bigint;
BEGIN
  IF v_environment NOT IN('local','dev','test') OR NOT EXISTS(
    SELECT 1 FROM public.stripe_bank_transfer_runtime_controls c
    WHERE c.deployment_environment=v_environment AND c.sandbox_enabled AND c.usd_bank_transfer_enabled
      AND NOT c.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'stripe_bank_transfer_runtime_disabled'; END IF;
  IF v_currency='CAD' THEN RAISE EXCEPTION 'stripe_cad_bank_transfer_unavailable'; END IF;
  IF v_currency<>'USD' THEN RAISE EXCEPTION 'stripe_bank_transfer_currency_unavailable'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug=p_command->>'projectSlug';
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND project_id=v_project.id;
  IF NOT FOUND OR v_project.id IS NULL THEN RAISE EXCEPTION 'stripe_payment_unavailable'; END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN RAISE EXCEPTION 'stripe_payment_permission_denied'; END IF;
  IF round(v_payment.payment_amount*100)::numeric<>(p_command->>'expectedAmountMinor')::numeric THEN RAISE EXCEPTION 'stripe_payment_amount_mismatch'; END IF;
  SELECT * INTO v_period FROM public.accounting_periods p
  WHERE p.status='open' AND NOT p.production_enabled
    AND (v_payment.period_end::timestamptz+interval'12 hours')>=p.starts_at
    AND (v_payment.period_end::timestamptz+interval'12 hours')<p.ends_at
  ORDER BY p.starts_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'stripe_accounting_period_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-intent:'||(p_command->>'providerPaymentIntentId'),0));
  SELECT * INTO v_existing FROM public.stripe_bank_transfer_intents WHERE provider_payment_intent_id=p_command->>'providerPaymentIntentId';
  IF FOUND THEN
    IF v_existing.project_id<>v_project.id OR v_existing.payment_id<>v_payment.id OR v_existing.actor_user_id<>(p_command->>'actorUserId')::uuid
      OR v_existing.currency_code<>v_currency OR v_existing.expected_amount_minor<>(p_command->>'expectedAmountMinor')::numeric
      OR v_existing.provider_account_id<>p_command->>'providerAccountId' OR v_existing.provider_customer_id<>p_command->>'providerCustomerId'
      OR v_existing.instruction_evidence_hash<>p_command->>'evidenceHash' OR v_existing.deployment_environment<>v_environment
    THEN RAISE EXCEPTION 'stripe_intent_idempotency_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  INSERT INTO public.stripe_bank_transfer_intents(project_id,payment_id,accounting_period_id,actor_user_id,currency_code,expected_amount_minor,
    provider_account_id,provider_customer_id,provider_payment_intent_id,instruction_evidence_hash,deployment_environment)
  VALUES(v_project.id,v_payment.id,v_period.id,(p_command->>'actorUserId')::uuid,v_currency,(p_command->>'expectedAmountMinor')::numeric,
    p_command->>'providerAccountId',p_command->>'providerCustomerId',p_command->>'providerPaymentIntentId',p_command->>'evidenceHash',v_environment)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.ingest_stripe_bank_transfer_webhook(p_command jsonb) RETURNS TABLE(webhook_event_id bigint,evidence_id bigint,ledger_transaction_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));
  v_command_hash text:=encode(extensions.digest(convert_to(
    (p_command-ARRAY['signatureTimestamp','balanceSnapshots','balanceEvidenceHash']::text[])::text,
    'UTF8'),'sha256'),'hex');
  v_existing public.stripe_webhook_events%ROWTYPE;
  v_webhook_id bigint;
  v_evidence_id bigint;
  v_intent public.stripe_bank_transfer_intents%ROWTYPE;
  v_ordering text;
  v_route public.stripe_bank_transfer_custody_routes%ROWTYPE;
  v_event_id bigint;
  v_reference_id bigint;
  v_reference_key text;
  v_ledger_id bigint;
  v_reversal_id bigint;
  v_original_ledger bigint;
  v_period public.accounting_periods%ROWTYPE;
  v_effective_at timestamptz:=(p_command->>'providerCreatedAt')::timestamptz;
  v_gross numeric:=nullif(p_command->>'grossAmountMinor','')::numeric;
  v_fee numeric:=nullif(p_command->>'feeAmountMinor','')::numeric;
  v_net numeric:=nullif(p_command->>'netAmountMinor','')::numeric;
  v_currency text:=upper(nullif(p_command->>'currencyCode',''));
BEGIN
  IF v_environment NOT IN('local','dev','test') OR p_command->>'observationSource'<>'stripe_sdk_v1'
    OR coalesce((p_command->>'livemode')::boolean,true) THEN RAISE EXCEPTION 'stripe_webhook_runtime_disabled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_bank_transfer_runtime_controls c WHERE c.deployment_environment=v_environment AND c.sandbox_enabled AND NOT c.production_value_flow_enabled)
    THEN RAISE EXCEPTION 'stripe_webhook_runtime_disabled'; END IF;
  IF NOT (
    (p_command->>'eventType'='customer_cash_balance_transaction.created' AND p_command->>'evidenceType'='funded') OR
    (p_command->>'eventType'='payment_intent.processing' AND p_command->>'evidenceType'='processing') OR
    (p_command->>'eventType'='payment_intent.succeeded' AND p_command->>'evidenceType'='available') OR
    (p_command->>'eventType'='payment_intent.payment_failed' AND p_command->>'evidenceType'='failed') OR
    (p_command->>'eventType'='payment_intent.canceled' AND p_command->>'evidenceType'='canceled') OR
    (p_command->>'eventType'='charge.refunded' AND p_command->>'evidenceType'='refunded') OR
    (p_command->>'eventType'='charge.dispute.created' AND p_command->>'evidenceType'='disputed') OR
    (p_command->>'eventType'='charge.dispute.closed' AND p_command->>'evidenceType' IN('dispute_won','dispute_lost')) OR
    (p_command->>'eventType'='balance.available' AND p_command->>'evidenceType'='balance_available')
  ) THEN RAISE EXCEPTION 'stripe_webhook_evidence_type_mismatch'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-webhook:'||coalesce(p_command->>'providerEventId',''),0));
  SELECT * INTO v_existing FROM public.stripe_webhook_events WHERE provider_event_id=p_command->>'providerEventId';
  IF FOUND THEN
    IF v_existing.command_sha256<>v_command_hash THEN RAISE EXCEPTION 'stripe_webhook_dedupe_conflict'; END IF;
    RETURN QUERY SELECT v_existing.id,e.id,e.ledger_transaction_id FROM public.stripe_bank_transfer_evidence e WHERE e.webhook_event_id=v_existing.id;
    RETURN;
  END IF;
  INSERT INTO public.stripe_webhook_events(provider_event_id,provider_account_id,event_type,provider_object_id,provider_created_at,api_version,
    signature_timestamp,payload_sha256,command_sha256,livemode,observation_source)
  VALUES(p_command->>'providerEventId',p_command->>'providerAccountId',p_command->>'eventType',p_command->>'providerObjectId',v_effective_at,
    nullif(p_command->>'apiVersion',''),(p_command->>'signatureTimestamp')::bigint,p_command->>'payloadSha256',v_command_hash,false,'stripe_sdk_v1')
  RETURNING id INTO v_webhook_id;
  SELECT * INTO v_intent FROM public.stripe_bank_transfer_intents i
  WHERE i.provider_payment_intent_id=nullif(p_command->>'providerPaymentIntentId','')
     OR i.provider_customer_id=nullif(p_command->>'providerCustomerId','')
  ORDER BY i.id DESC LIMIT 1;
  IF v_intent.id IS NOT NULL AND v_intent.provider_account_id<>p_command->>'providerAccountId' THEN
    RAISE EXCEPTION 'stripe_webhook_account_mismatch';
  END IF;
  v_ordering:=CASE WHEN v_intent.id IS NULL THEN'unsequenced'
    WHEN EXISTS(SELECT 1 FROM public.stripe_bank_transfer_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
      WHERE e.intent_id=v_intent.id AND w.provider_created_at>=v_effective_at) THEN'out_of_order' ELSE'in_order' END;
  INSERT INTO public.stripe_balance_snapshots(webhook_event_id,currency_code,available_amount_minor,pending_amount_minor,observed_at,evidence_hash)
  SELECT v_webhook_id,upper(x->>'currencyCode'),(x->>'availableAmountMinor')::numeric,(x->>'pendingAmountMinor')::numeric,now(),p_command->>'balanceEvidenceHash'
  FROM jsonb_array_elements(coalesce(p_command->'balanceSnapshots','[]'::jsonb))x;

  IF p_command->>'evidenceType'='available' AND v_intent.id IS NOT NULL THEN
    IF v_intent.currency_code<>'USD' OR v_currency<>v_intent.currency_code OR v_gross<>v_intent.expected_amount_minor
       OR v_fee IS NULL OR v_net IS NULL OR v_gross<>v_fee+v_net
       OR nullif(p_command->>'providerBalanceCurrencyCode','')<>v_intent.currency_code THEN
      RAISE EXCEPTION 'stripe_available_evidence_mismatch';
    END IF;
    SELECT * INTO v_route FROM public.stripe_bank_transfer_custody_routes r WHERE r.currency_code=v_currency AND r.sandbox_enabled AND NOT r.production_enabled;
    IF NOT FOUND THEN RAISE EXCEPTION 'stripe_custody_route_unavailable'; END IF;
    v_event_id:=public.ingest_external_financial_event('stripe_sandbox',p_command->>'providerEventId',v_route.custody_account_id,v_route.asset_id,
      'bank_transfer_available',(p_command->>'signatureTimestamp')::bigint,v_gross,v_effective_at,p_command->>'payloadSha256',
      jsonb_build_object('stripeObjectId',p_command->>'providerObjectId','providerCreatedAt',p_command->>'providerCreatedAt'),v_environment);
    v_reference_key:='stripe_intake:'||v_intent.id::text;
    INSERT INTO public.financial_references(reference_key,reference_type,asset_id,custody_account_id,native_atomic_limit,evidence_hash)
    VALUES(v_reference_key,'stripe_bank_transfer_sandbox',v_route.asset_id,v_route.custody_account_id,v_gross,p_command->>'payloadSha256')
    ON CONFLICT(reference_key)DO NOTHING;
    SELECT id INTO v_reference_id FROM public.financial_references WHERE reference_key=v_reference_key;
    SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_intent.accounting_period_id;
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object(
      'contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,'idempotencyKey','stripe:available:'||(p_command->>'providerEventId'),
      'periodKey',v_period.period_key,'financialReferenceKey',v_reference_key,'transactionType','stripe_bank_transfer_receipt',
      'evidenceHash',p_command->>'payloadSha256','actorType','service','effectiveAt',p_command->>'providerCreatedAt','postings',jsonb_build_array(
        jsonb_build_object('accountKey','shadow_source_control','side','debit','assetKey',(SELECT asset_key FROM public.financial_assets WHERE id=v_route.asset_id),
          'custodyKey',(SELECT custody_key FROM public.financial_custody_accounts WHERE id=v_route.custody_account_id),'nativeAtomicAmount',v_gross::text,
          'functionalUsdAmount',(v_gross/100)::text,'fxUsdPerUnit','0.01','projectId',v_intent.project_id::text),
        jsonb_build_object('accountKey','shadow_offset_control','side','credit','assetKey',(SELECT asset_key FROM public.financial_assets WHERE id=v_route.asset_id),
          'custodyKey',(SELECT custody_key FROM public.financial_custody_accounts WHERE id=v_route.custody_account_id),'nativeAtomicAmount',v_gross::text,
          'functionalUsdAmount',(v_gross/100)::text,'fxUsdPerUnit','0.01','projectId',v_intent.project_id::text)
      )));
    PERFORM public.apply_external_funding(v_event_id,v_reference_id,v_gross,p_command->>'payloadSha256',v_environment);
    PERFORM public.post_shadow_financial_journal(v_event_id,v_ledger_id,'receipt','matched',jsonb_build_object('provider','stripe_sandbox','feeMinor',v_fee,'netMinor',v_net),p_command->>'payloadSha256',v_environment);
  ELSIF p_command->>'evidenceType' IN('refunded','dispute_lost') AND v_intent.id IS NOT NULL AND v_gross=v_intent.expected_amount_minor THEN
    SELECT e.ledger_transaction_id INTO v_original_ledger FROM public.stripe_bank_transfer_evidence e
    WHERE e.intent_id=v_intent.id AND e.evidence_type='available' AND e.ledger_transaction_id IS NOT NULL ORDER BY e.id DESC LIMIT 1;
    IF v_original_ledger IS NOT NULL THEN
      SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_intent.accounting_period_id;
      v_reversal_id:=public.reverse_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_reversal.v1','deploymentEnvironment',v_environment,
        'idempotencyKey','stripe:reversal:'||(p_command->>'providerEventId'),'originalTransactionId',v_original_ledger::text,'periodKey',v_period.period_key,
        'evidenceHash',p_command->>'payloadSha256','actorType','service','effectiveAt',p_command->>'providerCreatedAt'));
    END IF;
  END IF;
  INSERT INTO public.stripe_bank_transfer_evidence(webhook_event_id,intent_id,evidence_type,currency_code,gross_amount_minor,fee_amount_minor,net_amount_minor,
    provider_balance_transaction_id,provider_balance_currency_code,provider_balance_gross_amount_minor,provider_balance_fee_amount_minor,
    provider_balance_net_amount_minor,ordering_status,evidence_hash,ledger_transaction_id,external_financial_event_id,reversal_ledger_transaction_id)
  VALUES(v_webhook_id,v_intent.id,p_command->>'evidenceType',v_currency,v_gross,v_fee,v_net,nullif(p_command->>'providerBalanceTransactionId',''),
    nullif(p_command->>'providerBalanceCurrencyCode',''),nullif(p_command->>'providerBalanceGrossAmountMinor','')::numeric,
    nullif(p_command->>'providerBalanceFeeAmountMinor','')::numeric,nullif(p_command->>'providerBalanceNetAmountMinor','')::numeric,
    v_ordering,p_command->>'payloadSha256',v_ledger_id,v_event_id,v_reversal_id)
  RETURNING id INTO v_evidence_id;
  RETURN QUERY SELECT v_webhook_id,v_evidence_id,v_ledger_id;
END;
$$;

CREATE VIEW public.stripe_bank_transfer_status WITH(security_invoker=true) AS
SELECT i.id intent_id,i.project_id,i.payment_id,i.currency_code,i.expected_amount_minor,i.created_at,
  coalesce(latest.evidence_type,i.instruction_status) status,latest.provider_created_at status_at,
  coalesce(latest.ordering_status,'unsequenced') ordering_status,
  latest.gross_amount_minor,latest.fee_amount_minor,latest.net_amount_minor,
  (latest.evidence_type='available' AND latest.ledger_transaction_id IS NOT NULL AND latest.reversal_ledger_transaction_id IS NULL) available_for_shadow_close,
  r.topology_status,NOT EXISTS(SELECT 1 FROM public.stripe_clearing_sweep_evidence s WHERE s.currency_code=i.currency_code) sweep_evidence_pending
FROM public.stripe_bank_transfer_intents i
LEFT JOIN public.stripe_bank_transfer_custody_routes r ON r.currency_code=i.currency_code
LEFT JOIN LATERAL(
  SELECT e.*,w.provider_created_at FROM public.stripe_bank_transfer_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
  WHERE e.intent_id=i.id ORDER BY w.provider_created_at DESC,e.id DESC LIMIT 1
)latest ON true;

CREATE FUNCTION public.list_project_stripe_bank_transfer_status(p_actor_user_id uuid,p_project_slug text) RETURNS SETOF public.stripe_bank_transfer_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.* FROM public.stripe_bank_transfer_status s JOIN public.projects p ON p.id=s.project_id
  WHERE p.slug=p_project_slug AND public.is_project_financial_admin(p_actor_user_id,p.id)
  ORDER BY s.created_at DESC,s.intent_id DESC;
$$;

ALTER TABLE public.stripe_bank_transfer_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_bank_transfer_custody_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_bank_transfer_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_bank_transfer_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_clearing_sweep_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_bank_transfer_runtime_controls,public.stripe_bank_transfer_custody_routes,public.stripe_bank_transfer_intents,
  public.stripe_webhook_events,public.stripe_bank_transfer_evidence,public.stripe_balance_snapshots,public.stripe_clearing_sweep_evidence,
  public.stripe_bank_transfer_status FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.stripe_bank_transfer_runtime_controls,public.stripe_bank_transfer_custody_routes,public.stripe_bank_transfer_intents,
  public.stripe_webhook_events,public.stripe_bank_transfer_evidence,public.stripe_balance_snapshots,public.stripe_clearing_sweep_evidence,
  public.stripe_bank_transfer_status TO service_role;
REVOKE ALL ON FUNCTION public.is_project_financial_admin(uuid,bigint),public.record_stripe_bank_transfer_intent(jsonb),
  public.ingest_stripe_bank_transfer_webhook(jsonb),public.list_project_stripe_bank_transfer_status(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_financial_admin(uuid,bigint),public.record_stripe_bank_transfer_intent(jsonb),
  public.ingest_stripe_bank_transfer_webhook(jsonb),public.list_project_stripe_bank_transfer_status(uuid,text) TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.stripe_bank_transfer_runtime_controls,public.stripe_bank_transfer_custody_routes,
  public.stripe_bank_transfer_intents,public.stripe_webhook_events,public.stripe_bank_transfer_evidence,public.stripe_balance_snapshots,
  public.stripe_clearing_sweep_evidence FROM service_role;
