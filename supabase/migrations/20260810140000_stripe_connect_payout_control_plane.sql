-- Stripe Connect sandbox payout control plane for #141.
-- Provider calls are permitted only from typed Edge commands with test credentials.
-- Production activation, raw bank data, and live value flow remain fail closed.

CREATE TABLE public.stripe_connect_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  onboarding_enabled boolean NOT NULL DEFAULT false,
  payout_enabled boolean NOT NULL DEFAULT false,
  webhook_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (production_value_flow_enabled=false),
  CHECK (deployment_environment<>'production' OR (NOT onboarding_enabled AND NOT payout_enabled AND NOT webhook_enabled))
);
INSERT INTO public.stripe_connect_runtime_controls VALUES
  ('local',true,true,true,false,now()),('development',true,true,true,false,now()),
  ('dev',true,true,true,false,now()),('preview',true,true,true,false,now()),
  ('test',true,true,true,false,now()),('production',false,false,false,false,now())
ON CONFLICT(deployment_environment) DO NOTHING;

INSERT INTO public.financial_assets(asset_key,rail_key,symbol,atomic_scale,classification_metadata)
VALUES('stripe_connect_sandbox_cad','stripe_sandbox','CAD',2,'{"purpose":"stripe_connect_sandbox_payout_review","approved":false,"production":false}'::jsonb)
ON CONFLICT(asset_key) DO NOTHING;
INSERT INTO public.financial_custody_accounts(custody_key,asset_id,provider_key,external_reference_hash,classification_metadata)
SELECT 'stripe_connect_sandbox_cad_clearing',id,'stripe_sandbox',encode(extensions.digest(pg_catalog.convert_to('stripe-connect-sandbox-cad','UTF8'),'sha256'),'hex'),
  '{"purpose":"stripe_connect_sandbox_cad_review","custody_claim":false}'::jsonb
FROM public.financial_assets WHERE asset_key='stripe_connect_sandbox_cad'
ON CONFLICT(custody_key) DO NOTHING;

ALTER TABLE public.user_withdrawal_requests DROP CONSTRAINT user_withdrawal_requests_currency_check;
ALTER TABLE public.user_withdrawal_requests ADD CONSTRAINT user_withdrawal_requests_currency_check CHECK(currency_code IN('USD','CAD'));

CREATE TABLE public.stripe_connect_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_account_id text NOT NULL UNIQUE,
  payout_route_id bigint UNIQUE REFERENCES public.user_payout_routes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  country_code text NOT NULL,
  default_currency text NOT NULL,
  onboarding_status text NOT NULL,
  details_submitted boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  external_account_enabled boolean NOT NULL DEFAULT false,
  external_account_last4 text,
  currently_due_count integer NOT NULL DEFAULT 0,
  eventually_due_count integer NOT NULL DEFAULT 0,
  disabled_reason text,
  provider_updated_at timestamptz NOT NULL,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
  CHECK(country_code IN('US','CA') AND default_currency IN('USD','CAD')),
  CHECK(onboarding_status IN('incomplete','requirements_due','ready','restricted')),
  CHECK(external_account_last4 IS NULL OR external_account_last4 ~ '^[0-9A-Za-z]{4}$'),
  CHECK(currently_due_count>=0 AND eventually_due_count>=0),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CHECK(production_enabled=false),
  CHECK(onboarding_status<>'ready' OR (details_submitted AND payouts_enabled AND external_account_enabled AND currently_due_count=0))
);
CREATE INDEX stripe_connect_accounts_status_idx ON public.stripe_connect_accounts(onboarding_status,user_id);

CREATE TABLE public.stripe_connect_account_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stripe_connect_account_id bigint NOT NULL REFERENCES public.stripe_connect_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_event_id text,
  event_type text NOT NULL,
  onboarding_status text NOT NULL,
  payouts_enabled boolean NOT NULL,
  external_account_enabled boolean NOT NULL,
  currently_due_count integer NOT NULL,
  disabled_reason text,
  provider_created_at timestamptz NOT NULL,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_event_id),
  CHECK(provider_event_id IS NULL OR provider_event_id ~ '^evt_[A-Za-z0-9]+$'),
  CHECK(event_type IN('api_sync','account.updated')),
  CHECK(onboarding_status IN('incomplete','requirements_due','ready','restricted')),
  CHECK(currently_due_count>=0 AND evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX stripe_connect_account_events_account_idx ON public.stripe_connect_account_events(stripe_connect_account_id,provider_created_at DESC,id DESC);

CREATE TABLE public.stripe_connect_payout_commands (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payout_intent_id bigint NOT NULL REFERENCES public.payout_intents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payout_execution_attempt_id bigint NOT NULL UNIQUE REFERENCES public.payout_execution_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  stripe_connect_account_id bigint NOT NULL REFERENCES public.stripe_connect_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  withdrawal_request_id uuid NOT NULL REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  attempt_no integer NOT NULL,
  currency_code text NOT NULL,
  gross_minor numeric(78,0) NOT NULL,
  user_fee_minor numeric(78,0) NOT NULL,
  net_minor numeric(78,0) NOT NULL,
  provider_payout_minor numeric(78,0) NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  command_hash text NOT NULL,
  provider_transfer_id text,
  provider_payout_id text UNIQUE,
  provider_request_id text,
  status text NOT NULL DEFAULT 'prepared',
  failure_code text,
  ledger_transaction_id bigint UNIQUE REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  submitted_at timestamptz,
  settled_at timestamptz,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payout_intent_id,attempt_no),
  CHECK(attempt_no>0 AND currency_code IN('USD','CAD')),
  CHECK(gross_minor>0 AND user_fee_minor>=0 AND net_minor>0 AND provider_payout_minor>0 AND gross_minor=user_fee_minor+net_minor),
  CHECK(idempotency_key ~ '^[a-zA-Z0-9:_-]{8,160}$' AND command_hash ~ '^[0-9a-f]{64}$'),
  CHECK(provider_transfer_id IS NULL OR provider_transfer_id ~ '^tr_[A-Za-z0-9]+$'),
  CHECK(provider_payout_id IS NULL OR provider_payout_id ~ '^po_[A-Za-z0-9]+$'),
  CHECK(status IN('prepared','transferred','submitted','in_transit','paid','failed','canceled','needs_remediation','reconciled')),
  CHECK(production_enabled=false),
  CHECK((status IN('submitted','in_transit','paid','reconciled') AND provider_transfer_id IS NOT NULL AND provider_payout_id IS NOT NULL AND submitted_at IS NOT NULL)
    OR status NOT IN('submitted','in_transit','paid','reconciled')),
  CHECK((status='reconciled' AND ledger_transaction_id IS NOT NULL AND settled_at IS NOT NULL) OR status<>'reconciled')
);
CREATE INDEX stripe_connect_payout_commands_account_idx ON public.stripe_connect_payout_commands(stripe_connect_account_id,created_at DESC,id DESC);
CREATE INDEX stripe_connect_payout_commands_status_idx ON public.stripe_connect_payout_commands(status,created_at,id);
CREATE INDEX stripe_connect_payout_commands_transfer_idx ON public.stripe_connect_payout_commands(provider_transfer_id) WHERE provider_transfer_id IS NOT NULL;

CREATE TABLE public.stripe_connect_webhook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_event_id text NOT NULL UNIQUE,
  provider_account_id text NOT NULL,
  event_type text NOT NULL,
  provider_object_id text NOT NULL,
  provider_created_at timestamptz NOT NULL,
  signature_timestamp bigint NOT NULL,
  payload_sha256 text NOT NULL,
  command_sha256 text NOT NULL,
  livemode boolean NOT NULL,
  observation_source text NOT NULL,
  ordering_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(provider_event_id ~ '^evt_[A-Za-z0-9]+$' AND provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
  CHECK(event_type IN('account.updated','payout.created','payout.updated','payout.paid','payout.failed','payout.canceled')),
  CHECK(provider_object_id ~ '^(acct|po)_[A-Za-z0-9]+$'),
  CHECK(payload_sha256 ~ '^[0-9a-f]{64}$' AND command_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK(NOT livemode AND observation_source='stripe_sdk_v1'),
  CHECK(ordering_status IN('in_order','out_of_order'))
);

CREATE TABLE public.stripe_connect_payout_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  webhook_event_id bigint NOT NULL UNIQUE REFERENCES public.stripe_connect_webhook_events(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  stripe_connect_payout_command_id bigint NOT NULL REFERENCES public.stripe_connect_payout_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_status text NOT NULL,
  amount_minor numeric(78,0) NOT NULL,
  currency_code text NOT NULL,
  destination_last4 text,
  failure_code text,
  arrival_at timestamptz,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(provider_status IN('pending','in_transit','paid','failed','canceled')),
  CHECK(amount_minor>0 AND currency_code IN('USD','CAD')),
  CHECK(destination_last4 IS NULL OR destination_last4 ~ '^[0-9A-Za-z]{4}$'),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX stripe_connect_payout_observations_command_idx ON public.stripe_connect_payout_observations(stripe_connect_payout_command_id,created_at DESC,id DESC);

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions) VALUES
  ('stripe_user_payout_control','debit','provisional_user_payout_settlement','["user"]'::jsonb),
  ('stripe_custody_control','credit','provisional_stripe_custody_reduction','["user"]'::jsonb)
ON CONFLICT(account_key) DO NOTHING;

CREATE FUNCTION public.prevent_stripe_connect_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'stripe_connect_evidence_is_append_only'; END; $$;
CREATE TRIGGER stripe_connect_account_events_append_only BEFORE UPDATE OR DELETE ON public.stripe_connect_account_events FOR EACH ROW EXECUTE FUNCTION public.prevent_stripe_connect_evidence_mutation();
CREATE TRIGGER stripe_connect_webhook_events_append_only BEFORE UPDATE OR DELETE ON public.stripe_connect_webhook_events FOR EACH ROW EXECUTE FUNCTION public.prevent_stripe_connect_evidence_mutation();
CREATE TRIGGER stripe_connect_payout_observations_append_only BEFORE UPDATE OR DELETE ON public.stripe_connect_payout_observations FOR EACH ROW EXECUTE FUNCTION public.prevent_stripe_connect_evidence_mutation();

CREATE FUNCTION public.stripe_connect_runtime_enabled(p_environment text,p_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.stripe_connect_runtime_controls c WHERE c.deployment_environment=lower(p_environment)
      AND NOT c.production_value_flow_enabled AND CASE p_capability WHEN 'onboarding' THEN c.onboarding_enabled WHEN 'payout' THEN c.payout_enabled WHEN 'webhook' THEN c.webhook_enabled ELSE false END
  );
$$;

CREATE FUNCTION public.bind_stripe_withdrawal_request_currency() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_symbol text;
BEGIN
  IF NEW.rail_key='stripe_bank_transfer' THEN
    SELECT symbol INTO v_symbol FROM public.financial_assets WHERE id=NEW.financial_asset_id;
    IF v_symbol NOT IN('USD','CAD') THEN RAISE EXCEPTION 'stripe_connect_currency_unsupported'; END IF;
    NEW.currency_code:=v_symbol;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER user_withdrawal_stripe_currency BEFORE INSERT OR UPDATE OF financial_asset_id,rail_key ON public.user_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.bind_stripe_withdrawal_request_currency();
CREATE FUNCTION public.bind_stripe_payout_intent_currency() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_symbol text;
BEGIN
  IF NEW.rail='fiat_stub' AND NEW.withdrawal_request_id IS NOT NULL THEN
    SELECT symbol INTO v_symbol FROM public.financial_assets WHERE id=NEW.financial_asset_id;
    IF v_symbol NOT IN('USD','CAD') THEN RAISE EXCEPTION 'stripe_connect_currency_unsupported'; END IF;
    NEW.currency_code:=v_symbol;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER payout_intent_stripe_currency BEFORE INSERT OR UPDATE OF financial_asset_id,rail ON public.payout_intents
FOR EACH ROW EXECUTE FUNCTION public.bind_stripe_payout_intent_currency();

CREATE FUNCTION public.sync_stripe_connect_account(p_actor_user_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_account public.stripe_connect_accounts%ROWTYPE;
  v_status text;v_route_id bigint;v_hash text:=encode(extensions.digest(pg_catalog.convert_to(p_command::text,'UTF8'),'sha256'),'hex');
  v_last4 text:=nullif(p_command->>'externalAccountLast4','');v_now timestamptz:=(p_command->>'providerUpdatedAt')::timestamptz;
BEGIN
  IF NOT public.stripe_connect_runtime_enabled(v_environment,'onboarding') THEN RAISE EXCEPTION 'stripe_connect_runtime_disabled'; END IF;
  IF p_command->>'contractVersion'<>'stripe_connect_account_sync.v1' OR p_actor_user_id IS NULL
    OR coalesce(p_command->>'providerAccountId','')!~'^acct_[A-Za-z0-9]+$' OR p_command->>'countryCode' NOT IN('US','CA')
    OR p_command->>'defaultCurrency' NOT IN('USD','CAD') THEN RAISE EXCEPTION 'stripe_connect_account_contract_invalid'; END IF;
  v_status:=CASE
    WHEN (p_command->>'detailsSubmitted')::boolean IS NOT TRUE THEN 'incomplete'
    WHEN (p_command->>'payoutsEnabled')::boolean IS TRUE AND (p_command->>'externalAccountEnabled')::boolean IS TRUE AND (p_command->>'currentlyDueCount')::integer=0 THEN 'ready'
    WHEN (p_command->>'currentlyDueCount')::integer>0 THEN 'requirements_due' ELSE 'restricted' END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-connect-account:'||p_actor_user_id::text,0));
  SELECT * INTO v_account FROM public.stripe_connect_accounts WHERE user_id=p_actor_user_id FOR UPDATE;
  IF FOUND AND v_account.provider_account_id<>p_command->>'providerAccountId' THEN RAISE EXCEPTION 'stripe_connect_account_identity_conflict'; END IF;
  INSERT INTO public.stripe_connect_accounts(user_id,provider_account_id,country_code,default_currency,onboarding_status,details_submitted,
    payouts_enabled,external_account_enabled,external_account_last4,currently_due_count,eventually_due_count,disabled_reason,provider_updated_at,evidence_hash)
  VALUES(p_actor_user_id,p_command->>'providerAccountId',p_command->>'countryCode',p_command->>'defaultCurrency',v_status,
    (p_command->>'detailsSubmitted')::boolean,(p_command->>'payoutsEnabled')::boolean,(p_command->>'externalAccountEnabled')::boolean,v_last4,
    (p_command->>'currentlyDueCount')::integer,(p_command->>'eventuallyDueCount')::integer,nullif(p_command->>'disabledReason',''),v_now,v_hash)
  ON CONFLICT(user_id) DO UPDATE SET country_code=excluded.country_code,default_currency=excluded.default_currency,onboarding_status=excluded.onboarding_status,
    details_submitted=excluded.details_submitted,payouts_enabled=excluded.payouts_enabled,external_account_enabled=excluded.external_account_enabled,
    external_account_last4=excluded.external_account_last4,currently_due_count=excluded.currently_due_count,eventually_due_count=excluded.eventually_due_count,
    disabled_reason=excluded.disabled_reason,provider_updated_at=excluded.provider_updated_at,evidence_hash=excluded.evidence_hash,updated_at=clock_timestamp()
  RETURNING * INTO v_account;
  IF v_status='ready' THEN
    IF v_account.payout_route_id IS NULL THEN
      INSERT INTO public.user_payout_routes(user_id,rail,label,currency_code,destination,is_default,status,created_by_user_id,updated_by_user_id)
      VALUES(p_actor_user_id,'fiat_stub','Stripe Connect · bank '||coalesce('••••'||v_last4,'verified'),p_command->>'defaultCurrency',
        jsonb_build_object('provider','stripe_connect','providerAccountId',v_account.provider_account_id,'country',v_account.country_code,'last4',v_last4),
        NOT EXISTS(SELECT 1 FROM public.user_payout_routes WHERE user_id=p_actor_user_id AND is_default AND status='active'),'active',p_actor_user_id,p_actor_user_id)
      RETURNING id INTO v_route_id;
      UPDATE public.stripe_connect_accounts SET payout_route_id=v_route_id WHERE id=v_account.id;
    ELSE
      UPDATE public.user_payout_routes SET label='Stripe Connect · bank '||coalesce('••••'||v_last4,'verified'),currency_code=p_command->>'defaultCurrency',
        destination=jsonb_build_object('provider','stripe_connect','providerAccountId',v_account.provider_account_id,'country',v_account.country_code,'last4',v_last4),status='active',updated_at=clock_timestamp()
      WHERE id=v_account.payout_route_id;
    END IF;
  ELSIF v_account.payout_route_id IS NOT NULL THEN UPDATE public.user_payout_routes SET status='disabled',is_default=false,updated_at=clock_timestamp() WHERE id=v_account.payout_route_id; END IF;
  INSERT INTO public.stripe_connect_account_events(stripe_connect_account_id,event_type,onboarding_status,payouts_enabled,external_account_enabled,
    currently_due_count,disabled_reason,provider_created_at,evidence_hash)
  VALUES(v_account.id,'api_sync',v_status,(p_command->>'payoutsEnabled')::boolean,(p_command->>'externalAccountEnabled')::boolean,
    (p_command->>'currentlyDueCount')::integer,nullif(p_command->>'disabledReason',''),v_now,v_hash);
  IF v_status<>'ready' THEN
    UPDATE public.user_withdrawal_requests SET status='held',status_reason='stripe_connect_account_not_ready' WHERE user_id=p_actor_user_id AND rail_key='stripe_bank_transfer' AND status='reserved';
    UPDATE public.user_withdrawal_obligation_claims SET status='held',updated_at=clock_timestamp() WHERE withdrawal_request_id IN(
      SELECT id FROM public.user_withdrawal_requests WHERE user_id=p_actor_user_id AND rail_key='stripe_bank_transfer' AND status='held');
    UPDATE public.payout_inventory_reservations SET status='held' WHERE withdrawal_request_id IN(
      SELECT id FROM public.user_withdrawal_requests WHERE user_id=p_actor_user_id AND rail_key='stripe_bank_transfer' AND status='held') AND status='reserved';
  END IF;
  RETURN jsonb_build_object('accountId',v_account.id,'providerAccountId',v_account.provider_account_id,'status',v_status,'payoutRouteId',(SELECT payout_route_id FROM public.stripe_connect_accounts WHERE id=v_account.id),'ready',v_status='ready');
END; $$;

CREATE FUNCTION public.prepare_stripe_connect_payout(p_actor_user_id uuid,p_payout_intent_id bigint,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.payout_intents%ROWTYPE;v_request public.user_withdrawal_requests%ROWTYPE;v_account public.stripe_connect_accounts%ROWTYPE;
  v_attempt_no integer;v_attempt_id bigint;v_command_id bigint;v_key text;v_hash text;v_fee numeric(78,0);v_net numeric(78,0);v_provider_minor numeric(78,0);v_prior_transfer text;
BEGIN
  IF NOT public.stripe_connect_runtime_enabled(p_environment,'payout') THEN RAISE EXCEPTION 'stripe_connect_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE user_id=p_actor_user_id) THEN RAISE EXCEPTION 'stripe_connect_operator_invalid'; END IF;
  SELECT * INTO v_intent FROM public.payout_intents WHERE id=p_payout_intent_id FOR UPDATE;
  IF v_intent.id IS NULL OR v_intent.rail<>'fiat_stub' OR v_intent.withdrawal_request_id IS NULL OR v_intent.status NOT IN('draft','failed') THEN RAISE EXCEPTION 'stripe_connect_payout_intent_unavailable'; END IF;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=v_intent.withdrawal_request_id FOR UPDATE;
  SELECT * INTO v_account FROM public.stripe_connect_accounts WHERE user_id=v_intent.user_id AND payout_route_id=v_intent.payout_route_id FOR UPDATE;
  IF v_request.status NOT IN('reserved','held') OR v_account.id IS NULL OR v_account.onboarding_status<>'ready' OR NOT v_account.payouts_enabled OR NOT v_account.external_account_enabled THEN RAISE EXCEPTION 'stripe_connect_account_not_ready'; END IF;
  IF v_intent.currency_code NOT IN('USD','CAD') THEN RAISE EXCEPTION 'stripe_connect_currency_unsupported'; END IF;
  v_fee:=round(v_intent.fee_amount_usd*100);v_net:=round(v_intent.amount_usd*100);v_provider_minor:=v_intent.native_atomic_amount;
  IF v_net<=0 OR v_provider_minor<=0 OR v_request.requested_minor<>v_net+v_fee OR v_request.net_minor<>v_net THEN RAISE EXCEPTION 'stripe_connect_payout_amount_mismatch'; END IF;
  v_attempt_no:=coalesce((SELECT max(attempt_no) FROM public.payout_execution_attempts WHERE payout_intent_id=v_intent.id),0)+1;
  SELECT provider_transfer_id INTO v_prior_transfer FROM public.stripe_connect_payout_commands
    WHERE payout_intent_id=v_intent.id AND status IN('needs_remediation','canceled') AND provider_transfer_id IS NOT NULL
    ORDER BY attempt_no DESC LIMIT 1;
  v_key:='stripe-connect:'||v_intent.id::text||':'||v_attempt_no::text;
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('payoutIntentId',v_intent.id,'accountId',v_account.id,'currency',v_intent.currency_code,
    'grossMinor',v_request.requested_minor::text,'feeMinor',v_fee::text,'netMinor',v_net::text,'attemptNo',v_attempt_no)::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.payout_execution_attempts(withdrawal_request_id,payout_intent_id,attempt_no,rail_key,financial_asset_id,destination_hash,request_hash,status)
  VALUES(v_request.id,v_intent.id,v_attempt_no,'stripe_bank_transfer',v_intent.financial_asset_id,v_request.destination_hash,v_request.request_hash,'planned') RETURNING id INTO v_attempt_id;
  INSERT INTO public.stripe_connect_payout_commands(payout_intent_id,payout_execution_attempt_id,stripe_connect_account_id,withdrawal_request_id,
    attempt_no,currency_code,gross_minor,user_fee_minor,net_minor,provider_payout_minor,idempotency_key,command_hash,provider_transfer_id,status)
  VALUES(v_intent.id,v_attempt_id,v_account.id,v_request.id,v_attempt_no,v_intent.currency_code,v_request.requested_minor,v_fee,v_net,v_provider_minor,v_key,v_hash,
    v_prior_transfer,CASE WHEN v_prior_transfer IS NULL THEN 'prepared' ELSE 'transferred' END) RETURNING id INTO v_command_id;
  UPDATE public.payout_intents SET status='processing',status_reason='stripe_connect_submission_pending',updated_at=clock_timestamp() WHERE id=v_intent.id;
  RETURN jsonb_build_object('commandId',v_command_id,'attemptId',v_attempt_id,'providerAccountId',v_account.provider_account_id,'currencyCode',lower(v_intent.currency_code),
    'grossMinor',v_request.requested_minor::text,'feeMinor',v_fee::text,'canonicalNetMinor',v_net::text,'netMinor',v_provider_minor::text,
    'existingTransferId',coalesce(v_prior_transfer,''),'transferIdempotencyKey',v_key||':transfer','payoutIdempotencyKey',v_key||':payout');
END; $$;

CREATE FUNCTION public.record_stripe_connect_payout_submission(p_command_id bigint,p_transfer_id text,p_payout_id text,p_provider_request_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_connect_payout_commands%ROWTYPE;
BEGIN
  SELECT * INTO v_command FROM public.stripe_connect_payout_commands WHERE id=p_command_id FOR UPDATE;
  IF v_command.id IS NULL OR v_command.status NOT IN('prepared','transferred') THEN RAISE EXCEPTION 'stripe_connect_payout_command_unavailable'; END IF;
  IF p_transfer_id!~'^tr_[A-Za-z0-9]+$' OR p_payout_id!~'^po_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'stripe_connect_provider_reference_invalid'; END IF;
  UPDATE public.stripe_connect_payout_commands SET provider_transfer_id=p_transfer_id,provider_payout_id=p_payout_id,provider_request_id=nullif(p_provider_request_id,''),status='submitted',submitted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_command_id;
  UPDATE public.payout_execution_attempts SET status='submitted',provider_reference=p_payout_id WHERE id=v_command.payout_execution_attempt_id;
  RETURN jsonb_build_object('commandId',p_command_id,'status','submitted','providerPayoutId',p_payout_id);
END; $$;

CREATE FUNCTION public.record_stripe_connect_payout_failure(p_command_id bigint,p_transfer_id text,p_failure_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_connect_payout_commands%ROWTYPE;
BEGIN
  SELECT * INTO v_command FROM public.stripe_connect_payout_commands WHERE id=p_command_id FOR UPDATE;
  IF v_command.id IS NULL THEN RAISE EXCEPTION 'stripe_connect_payout_command_unavailable'; END IF;
  UPDATE public.stripe_connect_payout_commands SET provider_transfer_id=nullif(p_transfer_id,''),status='needs_remediation',failure_code=left(coalesce(p_failure_code,'provider_error'),120),updated_at=clock_timestamp() WHERE id=p_command_id;
  UPDATE public.payout_execution_attempts SET status='failed',provider_reference=nullif(p_transfer_id,'') WHERE id=v_command.payout_execution_attempt_id;
  UPDATE public.payout_intents SET status='failed',status_reason='stripe_connect_submission_failed',updated_at=clock_timestamp() WHERE id=v_command.payout_intent_id;
  UPDATE public.user_withdrawal_requests SET status='held',status_reason='stripe_connect_submission_failed' WHERE id=v_command.withdrawal_request_id;
  UPDATE public.user_withdrawal_obligation_claims SET status='held',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_command.withdrawal_request_id;
  UPDATE public.payout_inventory_reservations SET status='held' WHERE withdrawal_request_id=v_command.withdrawal_request_id AND status='reserved';
  RETURN jsonb_build_object('commandId',p_command_id,'status','needs_remediation');
END; $$;

CREATE FUNCTION public.ingest_stripe_connect_webhook(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment');v_existing public.stripe_connect_webhook_events%ROWTYPE;
  v_event_id bigint;v_ordering text:='in_order';v_connect public.stripe_connect_accounts%ROWTYPE;v_payout public.stripe_connect_payout_commands%ROWTYPE;
  v_latest timestamptz;v_provider_at timestamptz:=(p_command->>'providerCreatedAt')::timestamptz;v_status text:=p_command->>'providerStatus';
  v_hash text:=encode(extensions.digest(pg_catalog.convert_to(p_command::text,'UTF8'),'sha256'),'hex');v_ledger_id bigint;v_period_key text;v_asset_key text;v_custody_key text;
BEGIN
  IF NOT public.stripe_connect_runtime_enabled(v_environment,'webhook') THEN RAISE EXCEPTION 'stripe_connect_runtime_disabled'; END IF;
  IF p_command->>'contractVersion'<>'stripe_connect_webhook.v1' OR (p_command->>'livemode')::boolean
    OR p_command->>'observationSource'<>'stripe_sdk_v1' THEN RAISE EXCEPTION 'stripe_connect_webhook_contract_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-connect-event:'||coalesce(p_command->>'providerEventId',''),0));
  SELECT * INTO v_existing FROM public.stripe_connect_webhook_events WHERE provider_event_id=p_command->>'providerEventId';
  IF FOUND THEN
    IF v_existing.command_sha256<>v_hash THEN RAISE EXCEPTION 'stripe_connect_webhook_dedupe_conflict'; END IF;
    RETURN jsonb_build_object('eventId',v_existing.id,'replayed',true,'orderingStatus',v_existing.ordering_status);
  END IF;
  SELECT * INTO v_connect FROM public.stripe_connect_accounts WHERE provider_account_id=p_command->>'providerAccountId' FOR UPDATE;
  IF v_connect.id IS NULL THEN RAISE EXCEPTION 'stripe_connect_account_unknown'; END IF;
  IF p_command->>'eventType'='account.updated' THEN
    IF p_command->>'onboardingStatus'<>(CASE
      WHEN (p_command->>'detailsSubmitted')::boolean IS NOT TRUE THEN 'incomplete'
      WHEN (p_command->>'payoutsEnabled')::boolean IS TRUE AND (p_command->>'externalAccountEnabled')::boolean IS TRUE AND (p_command->>'currentlyDueCount')::integer=0 THEN 'ready'
      WHEN (p_command->>'currentlyDueCount')::integer>0 THEN 'requirements_due' ELSE 'restricted' END)
    THEN RAISE EXCEPTION 'stripe_connect_account_snapshot_inconsistent'; END IF;
    SELECT max(provider_created_at) INTO v_latest FROM public.stripe_connect_account_events WHERE stripe_connect_account_id=v_connect.id;
  ELSE
    SELECT * INTO v_payout FROM public.stripe_connect_payout_commands WHERE provider_payout_id=p_command->>'providerObjectId' AND stripe_connect_account_id=v_connect.id FOR UPDATE;
    IF v_payout.id IS NULL THEN RAISE EXCEPTION 'stripe_connect_payout_unknown'; END IF;
    SELECT max(e.provider_created_at) INTO v_latest FROM public.stripe_connect_payout_observations o JOIN public.stripe_connect_webhook_events e ON e.id=o.webhook_event_id WHERE o.stripe_connect_payout_command_id=v_payout.id;
  END IF;
  IF v_latest IS NOT NULL AND v_provider_at<v_latest THEN v_ordering:='out_of_order'; END IF;
  INSERT INTO public.stripe_connect_webhook_events(provider_event_id,provider_account_id,event_type,provider_object_id,provider_created_at,
    signature_timestamp,payload_sha256,command_sha256,livemode,observation_source,ordering_status)
  VALUES(p_command->>'providerEventId',p_command->>'providerAccountId',p_command->>'eventType',p_command->>'providerObjectId',v_provider_at,
    (p_command->>'signatureTimestamp')::bigint,p_command->>'payloadSha256',v_hash,false,'stripe_sdk_v1',v_ordering) RETURNING id INTO v_event_id;
  IF p_command->>'eventType'='account.updated' THEN
    INSERT INTO public.stripe_connect_account_events(stripe_connect_account_id,provider_event_id,event_type,onboarding_status,payouts_enabled,external_account_enabled,
      currently_due_count,disabled_reason,provider_created_at,evidence_hash)
    VALUES(v_connect.id,p_command->>'providerEventId','account.updated',p_command->>'onboardingStatus',(p_command->>'payoutsEnabled')::boolean,
      (p_command->>'externalAccountEnabled')::boolean,(p_command->>'currentlyDueCount')::integer,nullif(p_command->>'disabledReason',''),v_provider_at,v_hash);
    IF v_ordering='in_order' THEN
      UPDATE public.stripe_connect_accounts SET onboarding_status=p_command->>'onboardingStatus',details_submitted=(p_command->>'detailsSubmitted')::boolean,
        payouts_enabled=(p_command->>'payoutsEnabled')::boolean,external_account_enabled=(p_command->>'externalAccountEnabled')::boolean,
        external_account_last4=nullif(p_command->>'externalAccountLast4',''),currently_due_count=(p_command->>'currentlyDueCount')::integer,
        eventually_due_count=(p_command->>'eventuallyDueCount')::integer,disabled_reason=nullif(p_command->>'disabledReason',''),provider_updated_at=v_provider_at,evidence_hash=v_hash,updated_at=clock_timestamp()
      WHERE id=v_connect.id;
      IF p_command->>'onboardingStatus'='ready' THEN
        UPDATE public.user_payout_routes SET status='active',label='Stripe Connect · bank '||coalesce('••••'||nullif(p_command->>'externalAccountLast4',''),'verified'),
          currency_code=p_command->>'defaultCurrency',destination=jsonb_build_object('provider','stripe_connect','providerAccountId',v_connect.provider_account_id,
            'country',p_command->>'countryCode','last4',nullif(p_command->>'externalAccountLast4','')),updated_at=clock_timestamp()
        WHERE id=v_connect.payout_route_id;
      ELSE
        UPDATE public.user_payout_routes SET status='disabled',is_default=false WHERE id=v_connect.payout_route_id;
        UPDATE public.user_withdrawal_requests SET status='held',status_reason='stripe_connect_requirements_changed' WHERE user_id=v_connect.user_id AND rail_key='stripe_bank_transfer' AND status='reserved';
        UPDATE public.user_withdrawal_obligation_claims SET status='held',updated_at=clock_timestamp() WHERE withdrawal_request_id IN(
          SELECT id FROM public.user_withdrawal_requests WHERE user_id=v_connect.user_id AND rail_key='stripe_bank_transfer' AND status='held');
        UPDATE public.payout_inventory_reservations SET status='held' WHERE withdrawal_request_id IN(
          SELECT id FROM public.user_withdrawal_requests WHERE user_id=v_connect.user_id AND rail_key='stripe_bank_transfer' AND status='held') AND status='reserved';
      END IF;
    END IF;
    RETURN jsonb_build_object('eventId',v_event_id,'accountId',v_connect.id,'orderingStatus',v_ordering);
  END IF;
  INSERT INTO public.stripe_connect_payout_observations(webhook_event_id,stripe_connect_payout_command_id,provider_status,amount_minor,currency_code,destination_last4,failure_code,arrival_at,evidence_hash)
  VALUES(v_event_id,v_payout.id,v_status,(p_command->>'amountMinor')::numeric,upper(p_command->>'currencyCode'),nullif(p_command->>'destinationLast4',''),
    nullif(p_command->>'failureCode',''),nullif(p_command->>'arrivalAt','')::timestamptz,v_hash);
  IF (p_command->>'amountMinor')::numeric<>v_payout.provider_payout_minor OR upper(p_command->>'currencyCode')<>v_payout.currency_code THEN RAISE EXCEPTION 'stripe_connect_payout_observation_mismatch'; END IF;
  IF v_ordering='out_of_order' THEN RETURN jsonb_build_object('eventId',v_event_id,'payoutCommandId',v_payout.id,'orderingStatus',v_ordering,'status',v_payout.status); END IF;
  IF v_payout.status IN('needs_remediation','canceled') AND v_status NOT IN('failed','canceled') THEN RAISE EXCEPTION 'stripe_connect_terminal_status_conflict'; END IF;
  IF v_payout.status='reconciled' AND v_status='paid' THEN RETURN jsonb_build_object('eventId',v_event_id,'payoutCommandId',v_payout.id,'orderingStatus',v_ordering,'status','reconciled','ledgerTransactionId',v_payout.ledger_transaction_id); END IF;
  IF v_status IN('failed','canceled') THEN
    UPDATE public.stripe_connect_payout_commands SET status=CASE v_status WHEN 'failed' THEN 'needs_remediation' ELSE 'canceled' END,failure_code=nullif(p_command->>'failureCode',''),updated_at=clock_timestamp() WHERE id=v_payout.id;
    UPDATE public.payout_execution_attempts SET status='failed' WHERE id=v_payout.payout_execution_attempt_id;
    UPDATE public.payout_intents SET status='failed',status_reason='stripe_connect_'||v_status,updated_at=clock_timestamp() WHERE id=v_payout.payout_intent_id;
    UPDATE public.user_withdrawal_requests SET status='held',status_reason='stripe_connect_'||v_status WHERE id=v_payout.withdrawal_request_id;
    UPDATE public.user_withdrawal_obligation_claims SET status='held',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_payout.withdrawal_request_id;
    UPDATE public.payout_inventory_reservations SET status='held' WHERE withdrawal_request_id=v_payout.withdrawal_request_id AND status='reserved';
  ELSIF v_status='paid' THEN
    SELECT period_key INTO v_period_key FROM public.accounting_periods WHERE status='open' AND starts_at<=v_provider_at AND ends_at>v_provider_at ORDER BY starts_at DESC LIMIT 1;
    SELECT asset.asset_key,custody.custody_key INTO v_asset_key,v_custody_key FROM public.payout_intents intent
      JOIN public.financial_assets asset ON asset.id=intent.financial_asset_id
      JOIN public.financial_custody_accounts custody ON custody.asset_id=asset.id AND custody.provider_key='stripe_sandbox'
      WHERE intent.id=v_payout.payout_intent_id ORDER BY custody.id LIMIT 1;
    IF v_period_key IS NULL OR v_asset_key IS NULL OR v_custody_key IS NULL THEN RAISE EXCEPTION 'stripe_connect_ledger_context_unavailable'; END IF;
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
      'periodKey',v_period_key,'transactionType','stripe_connect_payout_settlement','idempotencyKey','stripe-payout:'||v_payout.id::text,
      'evidenceHash',v_hash,'actorType','service','actorUserId','', 'effectiveAt',v_provider_at,
      'postings',jsonb_build_array(
        jsonb_build_object('accountKey','stripe_user_payout_control','side','debit','functionalUsdAmount',(v_payout.net_minor/100)::text,'assetKey',v_asset_key,'custodyKey',v_custody_key,'nativeAtomicAmount',v_payout.provider_payout_minor::text,'fxUsdPerUnit',(v_payout.net_minor/v_payout.provider_payout_minor)::text,'userId',v_connect.user_id),
        jsonb_build_object('accountKey','stripe_custody_control','side','credit','functionalUsdAmount',(v_payout.net_minor/100)::text,'assetKey',v_asset_key,'custodyKey',v_custody_key,'nativeAtomicAmount',v_payout.provider_payout_minor::text,'fxUsdPerUnit',(v_payout.net_minor/v_payout.provider_payout_minor)::text,'userId',v_connect.user_id))));
    UPDATE public.stripe_connect_payout_commands SET status='reconciled',ledger_transaction_id=v_ledger_id,settled_at=v_provider_at,updated_at=clock_timestamp() WHERE id=v_payout.id;
    UPDATE public.payout_execution_attempts SET status='reconciled' WHERE id=v_payout.payout_execution_attempt_id;
    UPDATE public.payout_intents SET status='paid',status_reason='stripe_connect_paid_and_reconciled',updated_at=clock_timestamp() WHERE id=v_payout.payout_intent_id;
    UPDATE public.user_withdrawal_requests SET status='paid',status_reason='stripe_connect_paid_and_reconciled',closed_at=clock_timestamp() WHERE id=v_payout.withdrawal_request_id;
    UPDATE public.user_withdrawal_obligation_claims SET status='paid',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_payout.withdrawal_request_id;
    UPDATE public.payout_inventory_reservations SET status='consumed' WHERE withdrawal_request_id=v_payout.withdrawal_request_id AND status IN('reserved','held');
    INSERT INTO public.withdrawal_lifecycle_events(withdrawal_request_id,event_type,from_status,to_status,evidence)
    VALUES(v_payout.withdrawal_request_id,'paid','reserved','paid',jsonb_build_object('rail','stripe_connect','providerPayoutId',v_payout.provider_payout_id,'ledgerTransactionId',v_ledger_id));
  ELSE UPDATE public.stripe_connect_payout_commands SET status=CASE v_status WHEN 'in_transit' THEN 'in_transit' ELSE 'submitted' END,updated_at=clock_timestamp() WHERE id=v_payout.id; END IF;
  RETURN jsonb_build_object('eventId',v_event_id,'payoutCommandId',v_payout.id,'orderingStatus',v_ordering,'status',(SELECT status FROM public.stripe_connect_payout_commands WHERE id=v_payout.id),'ledgerTransactionId',v_ledger_id);
END; $$;

CREATE VIEW public.user_stripe_connect_payouts WITH (security_invoker=true) AS
SELECT command.id,account.user_id,command.currency_code,command.gross_minor,command.user_fee_minor,command.net_minor,command.status,
  command.failure_code,command.created_at,command.submitted_at,command.settled_at,command.ledger_transaction_id
FROM public.stripe_connect_payout_commands command JOIN public.stripe_connect_accounts account ON account.id=command.stripe_connect_account_id;

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_account_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_payout_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_payout_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stripe_connect_accounts_self_select ON public.stripe_connect_accounts FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY stripe_connect_payouts_self_select ON public.stripe_connect_payout_commands FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.stripe_connect_accounts a WHERE a.id=stripe_connect_account_id AND a.user_id=(SELECT auth.uid())));
CREATE POLICY stripe_connect_observations_self_select ON public.stripe_connect_payout_observations FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.stripe_connect_payout_commands c JOIN public.stripe_connect_accounts a ON a.id=c.stripe_connect_account_id
  WHERE c.id=stripe_connect_payout_command_id AND a.user_id=(SELECT auth.uid())));

REVOKE ALL ON TABLE public.stripe_connect_runtime_controls,public.stripe_connect_accounts,public.stripe_connect_account_events,
  public.stripe_connect_payout_commands,public.stripe_connect_webhook_events,public.stripe_connect_payout_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.stripe_connect_accounts,public.stripe_connect_payout_commands,public.stripe_connect_payout_observations TO authenticated;
GRANT SELECT ON public.stripe_connect_runtime_controls,public.stripe_connect_accounts,public.stripe_connect_account_events,
  public.stripe_connect_payout_commands,public.stripe_connect_webhook_events,public.stripe_connect_payout_observations TO service_role;
GRANT SELECT ON public.user_stripe_connect_payouts TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.stripe_connect_runtime_enabled(text,text),public.sync_stripe_connect_account(uuid,jsonb),
  public.prepare_stripe_connect_payout(uuid,bigint,text),public.record_stripe_connect_payout_submission(bigint,text,text,text),
  public.record_stripe_connect_payout_failure(bigint,text,text),public.ingest_stripe_connect_webhook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stripe_connect_runtime_enabled(text,text),public.sync_stripe_connect_account(uuid,jsonb),
  public.prepare_stripe_connect_payout(uuid,bigint,text),public.record_stripe_connect_payout_submission(bigint,text,text,text),
  public.record_stripe_connect_payout_failure(bigint,text,text),public.ingest_stripe_connect_webhook(jsonb) TO service_role;
