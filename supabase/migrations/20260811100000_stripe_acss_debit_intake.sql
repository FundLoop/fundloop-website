CREATE TABLE public.stripe_acss_debit_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  checkout_enabled boolean NOT NULL DEFAULT false,
  cad_enabled boolean NOT NULL DEFAULT false,
  usd_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  provider_evidence_status text NOT NULL DEFAULT 'unavailable',
  provider_evidence_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_acss_runtime_environment_check CHECK (deployment_environment IN ('local','dev','test','production')),
  CONSTRAINT stripe_acss_runtime_evidence_check CHECK (provider_evidence_status IN ('unavailable','local_fixture','sandbox_verified')),
  CONSTRAINT stripe_acss_runtime_hash_check CHECK (provider_evidence_hash IS NULL OR provider_evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_acss_runtime_usd_closed_check CHECK (usd_enabled = false),
  CONSTRAINT stripe_acss_runtime_production_closed_check CHECK (production_value_flow_enabled = false AND (deployment_environment <> 'production' OR NOT checkout_enabled))
);

INSERT INTO public.stripe_acss_debit_runtime_controls(deployment_environment,checkout_enabled,cad_enabled,provider_evidence_status,provider_evidence_hash)
VALUES ('local',true,true,'local_fixture',repeat('a',64)),('dev',false,false,'unavailable',NULL),
  ('test',true,true,'local_fixture',repeat('a',64)),('production',false,false,'unavailable',NULL)
ON CONFLICT(deployment_environment) DO NOTHING;

INSERT INTO public.financial_assets(asset_key,rail_key,symbol,atomic_scale,classification_metadata)
VALUES('stripe_acss_cad','stripe_acss_debit','CAD',2,jsonb_build_object('classification','provisional','environment','local'))
ON CONFLICT(asset_key) DO NOTHING;

INSERT INTO public.financial_custody_accounts(custody_key,asset_id,provider_key,external_reference_hash,classification_metadata)
SELECT 'stripe_acss_cad_clearing',asset.id,'stripe_sandbox',repeat('b',64),jsonb_build_object('classification','provisional','topology','clearing')
FROM public.financial_assets asset WHERE asset.asset_key='stripe_acss_cad'
ON CONFLICT(custody_key) DO NOTHING;

CREATE TABLE public.stripe_acss_debit_custody_routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  currency_code text NOT NULL UNIQUE,
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provisional_fx_usd_per_unit numeric(38,18) NOT NULL,
  sandbox_enabled boolean NOT NULL DEFAULT false,
  production_enabled boolean NOT NULL DEFAULT false,
  evidence_hash text NOT NULL,
  CONSTRAINT stripe_acss_route_currency_check CHECK(currency_code IN('CAD','USD')),
  CONSTRAINT stripe_acss_route_asset_custody_fk FOREIGN KEY(asset_id,custody_account_id) REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT stripe_acss_route_fx_check CHECK(provisional_fx_usd_per_unit>0),
  CONSTRAINT stripe_acss_route_hash_check CHECK(evidence_hash~'^[0-9a-f]{64}$'),
  CONSTRAINT stripe_acss_route_production_closed_check CHECK(production_enabled=false)
);
CREATE INDEX stripe_acss_routes_asset_custody_idx ON public.stripe_acss_debit_custody_routes(asset_id,custody_account_id);
INSERT INTO public.stripe_acss_debit_custody_routes(currency_code,asset_id,custody_account_id,provisional_fx_usd_per_unit,sandbox_enabled,evidence_hash)
SELECT 'CAD',asset.id,custody.id,0.75,true,repeat('c',64)
FROM public.financial_assets asset JOIN public.financial_custody_accounts custody ON custody.asset_id=asset.id
WHERE asset.asset_key='stripe_acss_cad' AND custody.custody_key='stripe_acss_cad_clearing'
ON CONFLICT(currency_code) DO NOTHING;

CREATE TABLE public.stripe_acss_debit_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payment_id bigint NOT NULL REFERENCES public.payments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  accounting_period_id bigint NOT NULL REFERENCES public.accounting_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.stripe_acss_debit_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  currency_code text NOT NULL,
  expected_amount_minor numeric(78,0) NOT NULL,
  request_hash text NOT NULL,
  provider_account_id text,
  provider_checkout_session_id text UNIQUE,
  capability_evidence_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider_acknowledged_at timestamptz,
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(payment_id,currency_code),
  CONSTRAINT stripe_acss_command_currency_check CHECK(currency_code IN('CAD','USD')),
  CONSTRAINT stripe_acss_command_amount_check CHECK(expected_amount_minor>0),
  CONSTRAINT stripe_acss_command_hash_check CHECK(request_hash~'^[0-9a-f]{64}$' AND (capability_evidence_hash IS NULL OR capability_evidence_hash~'^[0-9a-f]{64}$')),
  CONSTRAINT stripe_acss_command_provider_check CHECK((provider_account_id IS NULL AND provider_checkout_session_id IS NULL AND provider_acknowledged_at IS NULL) OR
    (provider_account_id~'^acct_[A-Za-z0-9]+$' AND provider_checkout_session_id~'^cs_test_[A-Za-z0-9]+$' AND provider_acknowledged_at IS NOT NULL)),
  CONSTRAINT stripe_acss_command_production_closed_check CHECK(production_enabled=false)
);
CREATE INDEX stripe_acss_commands_project_created_idx ON public.stripe_acss_debit_commands(project_id,created_at DESC,id);
CREATE INDEX stripe_acss_commands_period_idx ON public.stripe_acss_debit_commands(accounting_period_id);
CREATE INDEX stripe_acss_commands_actor_idx ON public.stripe_acss_debit_commands(actor_user_id,created_at DESC);

CREATE TABLE public.stripe_acss_debit_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  webhook_event_id bigint NOT NULL REFERENCES public.stripe_webhook_events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  command_id uuid NOT NULL REFERENCES public.stripe_acss_debit_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_type text NOT NULL,
  provider_checkout_session_id text,
  provider_payment_intent_id text,
  provider_charge_id text,
  provider_mandate_id text,
  provider_balance_transaction_id text,
  currency_code text NOT NULL,
  gross_amount_minor numeric(78,0) NOT NULL,
  fee_amount_minor numeric(78,0),
  net_amount_minor numeric(78,0),
  balance_status text,
  ordering_status text NOT NULL,
  evidence_hash text NOT NULL,
  ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversal_ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(webhook_event_id,command_id),
  CONSTRAINT stripe_acss_evidence_type_check CHECK(evidence_type IN('checkout_completed','processing','settled_available','failed','canceled','refunded','disputed','dispute_won','dispute_lost')),
  CONSTRAINT stripe_acss_evidence_currency_check CHECK(currency_code IN('CAD','USD')),
  CONSTRAINT stripe_acss_evidence_amount_check CHECK(gross_amount_minor>=0 AND (fee_amount_minor IS NULL OR fee_amount_minor>=0) AND (net_amount_minor IS NULL OR net_amount_minor>=0)
    AND (fee_amount_minor IS NULL OR net_amount_minor IS NULL OR gross_amount_minor=fee_amount_minor+net_amount_minor)),
  CONSTRAINT stripe_acss_evidence_balance_check CHECK(balance_status IS NULL OR balance_status IN('pending','available')),
  CONSTRAINT stripe_acss_evidence_ordering_check CHECK(ordering_status IN('in_order','out_of_order')),
  CONSTRAINT stripe_acss_evidence_hash_check CHECK(evidence_hash~'^[0-9a-f]{64}$'),
  CONSTRAINT stripe_acss_evidence_production_closed_check CHECK(production_enabled=false)
);
CREATE INDEX stripe_acss_evidence_command_order_idx ON public.stripe_acss_debit_evidence(command_id,created_at DESC,id DESC);
CREATE INDEX stripe_acss_evidence_ledger_idx ON public.stripe_acss_debit_evidence(ledger_transaction_id) WHERE ledger_transaction_id IS NOT NULL;

CREATE FUNCTION public.reject_stripe_acss_debit_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'stripe_acss_debit_records_are_append_only'; END $$;
CREATE TRIGGER stripe_acss_evidence_append_only BEFORE UPDATE OR DELETE ON public.stripe_acss_debit_evidence FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_acss_debit_mutation();

CREATE FUNCTION public.prepare_stripe_acss_debit_command(p_command jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_project public.projects%ROWTYPE;v_payment public.payments%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;v_existing public.stripe_acss_debit_commands%ROWTYPE;v_hash text;v_id uuid;
BEGIN
  IF p_command->>'contractVersion'<>'stripe_acss_debit_prepare.v1' OR v_environment NOT IN('local','dev','test') THEN RAISE EXCEPTION 'stripe_acss_runtime_disabled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stripe_acss_debit_runtime_controls c WHERE c.deployment_environment=v_environment AND c.checkout_enabled AND c.cad_enabled AND NOT c.production_value_flow_enabled)
    THEN RAISE EXCEPTION 'stripe_acss_runtime_disabled'; END IF;
  IF upper(p_command->>'currencyCode')<>'CAD' THEN RAISE EXCEPTION 'stripe_acss_currency_unavailable'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE slug=p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_payment FROM public.payments WHERE id=(p_command->>'paymentId')::bigint AND project_id=v_project.id AND deleted_at IS NULL;
  IF v_project.id IS NULL OR v_payment.id IS NULL OR round(v_payment.payment_amount*100)<>(p_command->>'expectedAmountMinor')::numeric THEN RAISE EXCEPTION 'stripe_acss_payment_mismatch'; END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_project.id) THEN RAISE EXCEPTION 'stripe_acss_permission_denied'; END IF;
  SELECT * INTO v_period FROM public.accounting_periods p WHERE p.status='open' AND NOT p.production_enabled
    AND p.starts_at<(v_payment.period_end+1)::timestamptz AND p.ends_at>v_payment.period_start::timestamptz ORDER BY p.starts_at DESC LIMIT 1;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'stripe_acss_period_unavailable'; END IF;
  v_hash:=encode(extensions.digest(convert_to((p_command-ARRAY['actorUserId']::text[])::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-acss:'||v_payment.id::text||':CAD',0));
  SELECT * INTO v_existing FROM public.stripe_acss_debit_commands WHERE payment_id=v_payment.id AND currency_code='CAD';
  IF FOUND THEN IF v_existing.request_hash<>v_hash THEN RAISE EXCEPTION 'stripe_acss_idempotency_conflict'; END IF;RETURN v_existing.id;END IF;
  INSERT INTO public.stripe_acss_debit_commands(project_id,payment_id,accounting_period_id,actor_user_id,deployment_environment,currency_code,expected_amount_minor,request_hash)
  VALUES(v_project.id,v_payment.id,v_period.id,(p_command->>'actorUserId')::uuid,v_environment,'CAD',(p_command->>'expectedAmountMinor')::numeric,v_hash) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION public.acknowledge_stripe_acss_debit_checkout(p_command jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.stripe_acss_debit_commands%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.stripe_acss_debit_commands WHERE id=(p_command->>'commandId')::uuid FOR UPDATE;
  IF v_row.id IS NULL OR v_row.deployment_environment NOT IN('local','dev','test') THEN RAISE EXCEPTION 'stripe_acss_command_unavailable'; END IF;
  IF v_row.provider_checkout_session_id IS NOT NULL THEN
    IF v_row.provider_checkout_session_id<>p_command->>'providerCheckoutSessionId' OR v_row.provider_account_id<>p_command->>'providerAccountId' THEN RAISE EXCEPTION 'stripe_acss_provider_reference_conflict'; END IF;
    RETURN v_row.id;
  END IF;
  UPDATE public.stripe_acss_debit_commands SET provider_account_id=p_command->>'providerAccountId',provider_checkout_session_id=p_command->>'providerCheckoutSessionId',
    capability_evidence_hash=p_command->>'capabilityEvidenceHash',provider_acknowledged_at=clock_timestamp() WHERE id=v_row.id;
  RETURN v_row.id;
END $$;

CREATE FUNCTION public.ingest_stripe_acss_debit_webhook(p_command jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(coalesce(p_command->>'deploymentEnvironment',''));v_command public.stripe_acss_debit_commands%ROWTYPE;
  v_event public.stripe_webhook_events%ROWTYPE;v_event_id bigint;v_evidence_id bigint;v_ordering text;v_route public.stripe_acss_debit_custody_routes%ROWTYPE;
  v_reference_key text;v_ledger_id bigint;v_reversal_id bigint;v_original bigint;v_period public.accounting_periods%ROWTYPE;v_functional numeric;v_command_hash text;
BEGIN
  IF p_command->>'contractVersion'<>'stripe_acss_debit_webhook.v1' OR v_environment NOT IN('local','dev','test') OR p_command->>'observationSource'<>'stripe_sdk_v1'
    OR coalesce((p_command->>'livemode')::boolean,true) THEN RAISE EXCEPTION 'stripe_acss_webhook_runtime_disabled'; END IF;
  IF NOT ((p_command->>'eventType'='checkout.session.completed' AND p_command->>'evidenceType'='checkout_completed')
    OR (p_command->>'eventType'='payment_intent.processing' AND p_command->>'evidenceType'='processing')
    OR (p_command->>'eventType'='payment_intent.succeeded' AND p_command->>'evidenceType' IN('processing','settled_available'))
    OR (p_command->>'eventType'='payment_intent.payment_failed' AND p_command->>'evidenceType'='failed')
    OR (p_command->>'eventType'='payment_intent.canceled' AND p_command->>'evidenceType'='canceled')
    OR (p_command->>'eventType'='charge.refunded' AND p_command->>'evidenceType'='refunded')
    OR (p_command->>'eventType'='charge.dispute.created' AND p_command->>'evidenceType'='disputed')
    OR (p_command->>'eventType'='charge.dispute.closed' AND p_command->>'evidenceType' IN('dispute_won','dispute_lost'))) THEN
    RAISE EXCEPTION 'stripe_acss_event_evidence_mismatch';
  END IF;
  SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=(p_command->>'commandId')::uuid FOR UPDATE;
  IF v_command.id IS NULL OR v_command.currency_code<>upper(p_command->>'currencyCode') OR v_command.expected_amount_minor<>(p_command->>'grossAmountMinor')::numeric
    OR (v_command.provider_account_id IS NOT NULL AND v_command.provider_account_id<>p_command->>'providerAccountId') THEN RAISE EXCEPTION 'stripe_acss_observation_mismatch'; END IF;
  IF v_command.provider_checkout_session_id IS NULL THEN
    PERFORM public.acknowledge_stripe_acss_debit_checkout(jsonb_build_object('commandId',v_command.id,'providerAccountId',p_command->>'providerAccountId',
      'providerCheckoutSessionId',p_command->>'providerCheckoutSessionId','capabilityEvidenceHash',p_command->>'capabilityEvidenceHash'));
    SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=v_command.id;
  END IF;
  IF v_command.provider_checkout_session_id<>p_command->>'providerCheckoutSessionId' OR p_command->>'paymentMethodType'<>'acss_debit' OR nullif(p_command->>'providerMandateId','') IS NULL
    THEN RAISE EXCEPTION 'stripe_acss_mandate_or_session_mismatch'; END IF;
  IF p_command->>'evidenceType'='settled_available' AND (p_command->>'balanceStatus'<>'available' OR nullif(p_command->>'providerBalanceTransactionId','') IS NULL
    OR (p_command->>'feeAmountMinor')::numeric+(p_command->>'netAmountMinor')::numeric<>(p_command->>'grossAmountMinor')::numeric) THEN RAISE EXCEPTION 'stripe_acss_availability_evidence_missing'; END IF;
  v_command_hash:=encode(extensions.digest(convert_to((p_command-ARRAY['signatureTimestamp']::text[])::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-webhook:'||(p_command->>'providerEventId'),0));
  SELECT * INTO v_event FROM public.stripe_webhook_events WHERE provider_event_id=p_command->>'providerEventId';
  IF FOUND THEN IF v_event.command_sha256<>v_command_hash THEN RAISE EXCEPTION 'stripe_acss_webhook_dedupe_conflict'; END IF;ELSE
    INSERT INTO public.stripe_webhook_events(provider_event_id,provider_account_id,event_type,provider_object_id,provider_created_at,api_version,signature_timestamp,
      payload_sha256,command_sha256,livemode,observation_source)
    VALUES(p_command->>'providerEventId',p_command->>'providerAccountId',p_command->>'eventType',p_command->>'providerObjectId',(p_command->>'providerCreatedAt')::timestamptz,
      nullif(p_command->>'apiVersion',''),(p_command->>'signatureTimestamp')::bigint,p_command->>'payloadSha256',v_command_hash,false,'stripe_sdk_v1') RETURNING id INTO v_event_id;
  END IF;
  v_event_id:=coalesce(v_event.id,v_event_id);
  IF EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence WHERE webhook_event_id=v_event_id AND command_id=v_command.id) THEN
    RETURN (SELECT id FROM public.stripe_acss_debit_evidence WHERE webhook_event_id=v_event_id AND command_id=v_command.id);
  END IF;
  v_ordering:=CASE WHEN EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
    WHERE e.command_id=v_command.id AND w.provider_created_at>=(p_command->>'providerCreatedAt')::timestamptz) THEN'out_of_order' ELSE'in_order' END;
  IF p_command->>'evidenceType'='settled_available' AND NOT EXISTS(SELECT 1 FROM public.stripe_acss_debit_evidence WHERE command_id=v_command.id AND ledger_transaction_id IS NOT NULL) THEN
    SELECT * INTO v_route FROM public.stripe_acss_debit_custody_routes WHERE currency_code=v_command.currency_code AND sandbox_enabled AND NOT production_enabled;
    IF v_route.id IS NULL THEN RAISE EXCEPTION 'stripe_acss_custody_route_unavailable'; END IF;
    v_reference_key:='stripe_acss:'||v_command.id::text;
    INSERT INTO public.financial_references(reference_key,reference_type,asset_id,custody_account_id,native_atomic_limit,evidence_hash)
    VALUES(v_reference_key,'stripe_acss_debit_sandbox',v_route.asset_id,v_route.custody_account_id,v_command.expected_amount_minor,p_command->>'payloadSha256') ON CONFLICT(reference_key)DO NOTHING;
    SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_command.accounting_period_id;
    v_functional:=(v_command.expected_amount_minor/100)*v_route.provisional_fx_usd_per_unit;
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
      'idempotencyKey','stripe:acss:available:'||v_command.id::text,'periodKey',v_period.period_key,'financialReferenceKey',v_reference_key,
      'transactionType','stripe_acss_debit_receipt','evidenceHash',p_command->>'payloadSha256','actorType','service','effectiveAt',p_command->>'providerCreatedAt','postings',jsonb_build_array(
        jsonb_build_object('accountKey','shadow_source_control','side','debit','assetKey',(SELECT asset_key FROM public.financial_assets WHERE id=v_route.asset_id),
          'custodyKey',(SELECT custody_key FROM public.financial_custody_accounts WHERE id=v_route.custody_account_id),'nativeAtomicAmount',v_command.expected_amount_minor::text,
          'functionalUsdAmount',v_functional::text,'fxUsdPerUnit',v_route.provisional_fx_usd_per_unit::text,'projectId',v_command.project_id::text),
        jsonb_build_object('accountKey','shadow_offset_control','side','credit','assetKey',(SELECT asset_key FROM public.financial_assets WHERE id=v_route.asset_id),
          'custodyKey',(SELECT custody_key FROM public.financial_custody_accounts WHERE id=v_route.custody_account_id),'nativeAtomicAmount',v_command.expected_amount_minor::text,
          'functionalUsdAmount',v_functional::text,'fxUsdPerUnit',v_route.provisional_fx_usd_per_unit::text,'projectId',v_command.project_id::text))));
  ELSIF p_command->>'evidenceType' IN('refunded','dispute_lost') THEN
    SELECT ledger_transaction_id INTO v_original FROM public.stripe_acss_debit_evidence WHERE command_id=v_command.id AND ledger_transaction_id IS NOT NULL ORDER BY id LIMIT 1;
    IF v_original IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions WHERE reversal_of_transaction_id=v_original) THEN
      SELECT * INTO v_period FROM public.accounting_periods WHERE id=v_command.accounting_period_id;
      v_reversal_id:=public.reverse_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_reversal.v1','deploymentEnvironment',v_environment,
        'idempotencyKey','stripe:acss:reversal:'||v_command.id::text,'originalTransactionId',v_original::text,'periodKey',v_period.period_key,
        'evidenceHash',p_command->>'payloadSha256','actorType','service','effectiveAt',p_command->>'providerCreatedAt'));
    END IF;
  END IF;
  INSERT INTO public.stripe_acss_debit_evidence(webhook_event_id,command_id,evidence_type,provider_checkout_session_id,provider_payment_intent_id,
    provider_charge_id,provider_mandate_id,provider_balance_transaction_id,currency_code,gross_amount_minor,fee_amount_minor,net_amount_minor,balance_status,
    ordering_status,evidence_hash,ledger_transaction_id,reversal_ledger_transaction_id)
  VALUES(v_event_id,v_command.id,p_command->>'evidenceType',p_command->>'providerCheckoutSessionId',nullif(p_command->>'providerPaymentIntentId',''),
    nullif(p_command->>'providerChargeId',''),p_command->>'providerMandateId',nullif(p_command->>'providerBalanceTransactionId',''),v_command.currency_code,
    (p_command->>'grossAmountMinor')::numeric,nullif(p_command->>'feeAmountMinor','')::numeric,nullif(p_command->>'netAmountMinor','')::numeric,
    nullif(p_command->>'balanceStatus',''),v_ordering,p_command->>'payloadSha256',v_ledger_id,v_reversal_id) RETURNING id INTO v_evidence_id;
  RETURN v_evidence_id;
END $$;

CREATE VIEW public.stripe_acss_debit_status WITH(security_invoker=true) AS
SELECT c.id command_id,c.project_id,c.payment_id,c.currency_code,c.expected_amount_minor,c.created_at,
  coalesce(latest.evidence_type,CASE WHEN c.provider_checkout_session_id IS NULL THEN'prepared' ELSE'checkout_created' END)status,
  latest.provider_created_at status_at,
  (settled.ledger_transaction_id IS NOT NULL AND reversal.id IS NULL) available_for_package,
  (reversal.id IS NOT NULL) reversed
FROM public.stripe_acss_debit_commands c
LEFT JOIN LATERAL(SELECT e.*,w.provider_created_at FROM public.stripe_acss_debit_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
  WHERE e.command_id=c.id ORDER BY w.provider_created_at DESC,e.id DESC LIMIT 1)latest ON true
LEFT JOIN LATERAL(SELECT e.ledger_transaction_id FROM public.stripe_acss_debit_evidence e WHERE e.command_id=c.id AND e.ledger_transaction_id IS NOT NULL ORDER BY e.id LIMIT 1)settled ON true
LEFT JOIN public.ledger_transactions reversal ON reversal.reversal_of_transaction_id=settled.ledger_transaction_id;

CREATE FUNCTION public.list_project_stripe_acss_debit_status(p_actor_user_id uuid,p_project_slug text) RETURNS SETOF public.stripe_acss_debit_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.* FROM public.stripe_acss_debit_status s JOIN public.projects p ON p.id=s.project_id
  WHERE p.slug=p_project_slug AND public.is_project_financial_admin(p_actor_user_id,p.id) ORDER BY s.created_at DESC,s.command_id;
$$;

ALTER TABLE public.epoch_project_package_funding_sources ADD COLUMN stripe_acss_debit_command_id uuid
  REFERENCES public.stripe_acss_debit_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE UNIQUE INDEX epoch_project_package_funding_acss_idx ON public.epoch_project_package_funding_sources(package_id,stripe_acss_debit_command_id)
  WHERE stripe_acss_debit_command_id IS NOT NULL;
ALTER TABLE public.epoch_project_package_funding_sources DROP CONSTRAINT epoch_project_package_funding_kind_check;
ALTER TABLE public.epoch_project_package_funding_sources DROP CONSTRAINT epoch_project_package_funding_shape_check;
ALTER TABLE public.epoch_project_package_funding_sources ADD CONSTRAINT epoch_project_package_funding_kind_check
  CHECK(source_kind IN('stripe_bank_transfer','base_stablecoin','stripe_acss_debit'));
ALTER TABLE public.epoch_project_package_funding_sources ADD CONSTRAINT epoch_project_package_funding_shape_check CHECK(
  (source_kind='stripe_bank_transfer' AND stripe_intent_id IS NOT NULL AND base_receipt_id IS NULL AND stripe_acss_debit_command_id IS NULL)
  OR (source_kind='base_stablecoin' AND stripe_intent_id IS NULL AND base_receipt_id IS NOT NULL AND stripe_acss_debit_command_id IS NULL)
  OR (source_kind='stripe_acss_debit' AND stripe_intent_id IS NULL AND base_receipt_id IS NULL AND stripe_acss_debit_command_id IS NOT NULL));

ALTER FUNCTION public.validate_epoch_project_package(jsonb) RENAME TO validate_epoch_project_package_without_acss;
CREATE FUNCTION public.validate_epoch_project_package(p_command jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_package_id bigint;v_package public.epoch_project_packages%ROWTYPE;v_observed_at timestamptz:=clock_timestamp();v_added integer;
BEGIN
  v_package_id:=public.validate_epoch_project_package_without_acss(p_command);
  SELECT * INTO v_package FROM public.epoch_project_packages WHERE id=v_package_id FOR UPDATE;
  INSERT INTO public.epoch_project_package_funding_sources(package_id,source_position,source_kind,stripe_acss_debit_command_id,asset_code,
    native_atomic_amount,preliminary_usd,source_evidence_hash,project_fee_assessed_once)
  SELECT v_package_id,coalesce((SELECT max(source_position)+1 FROM public.epoch_project_package_funding_sources WHERE package_id=v_package_id),0)
      +row_number()OVER(ORDER BY c.created_at,c.id)-1,'stripe_acss_debit',c.id,c.currency_code,c.expected_amount_minor,
    (SELECT p.functional_usd_amount FROM public.stripe_acss_debit_evidence e JOIN public.ledger_postings p ON p.transaction_id=e.ledger_transaction_id
      WHERE e.command_id=c.id AND e.ledger_transaction_id IS NOT NULL AND p.side='debit' ORDER BY e.id,p.id LIMIT 1),
    (SELECT e.evidence_hash FROM public.stripe_acss_debit_evidence e WHERE e.command_id=c.id AND e.ledger_transaction_id IS NOT NULL ORDER BY e.id LIMIT 1),true
  FROM public.stripe_acss_debit_commands c JOIN public.stripe_acss_debit_status s ON s.command_id=c.id
  JOIN public.accounting_periods period ON period.id=c.accounting_period_id
  JOIN public.monthly_cycles cycle ON cycle.id=v_package.intended_cycle_id
  WHERE c.project_id=v_package.project_id AND s.available_for_package
    AND period.starts_at<((cycle.period_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles')
    AND period.ends_at>(cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles')
  ON CONFLICT(package_id,stripe_acss_debit_command_id)WHERE stripe_acss_debit_command_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_added=ROW_COUNT;
  IF v_added>0 THEN
    UPDATE public.epoch_project_packages SET funding_status='settled',canonical_cycle_id=intended_cycle_id,
      status=CASE WHEN status='rolled_forward' AND list_status='valid' AND compliance_status='passed'
        THEN CASE WHEN v_observed_at>=cutoff_at THEN'frozen' ELSE'review_ready' END ELSE status END
    WHERE id=v_package_id;
  END IF;
  RETURN v_package_id;
END $$;

ALTER TABLE public.stripe_acss_debit_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_acss_debit_custody_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_acss_debit_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_acss_debit_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_acss_debit_runtime_controls,public.stripe_acss_debit_custody_routes,public.stripe_acss_debit_commands,
  public.stripe_acss_debit_evidence,public.stripe_acss_debit_status FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.stripe_acss_debit_runtime_controls,public.stripe_acss_debit_custody_routes,public.stripe_acss_debit_commands,
  public.stripe_acss_debit_evidence,public.stripe_acss_debit_status TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.stripe_acss_debit_runtime_controls,public.stripe_acss_debit_custody_routes,
  public.stripe_acss_debit_commands,public.stripe_acss_debit_evidence FROM service_role;
REVOKE ALL ON FUNCTION public.prepare_stripe_acss_debit_command(jsonb),public.acknowledge_stripe_acss_debit_checkout(jsonb),
  public.ingest_stripe_acss_debit_webhook(jsonb),public.list_project_stripe_acss_debit_status(uuid,text),public.validate_epoch_project_package(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_stripe_acss_debit_command(jsonb),public.acknowledge_stripe_acss_debit_checkout(jsonb),
  public.ingest_stripe_acss_debit_webhook(jsonb),public.list_project_stripe_acss_debit_status(uuid,text),public.validate_epoch_project_package(jsonb) TO service_role;
