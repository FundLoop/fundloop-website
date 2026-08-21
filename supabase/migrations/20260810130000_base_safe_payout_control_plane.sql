-- Review-only Base Safe/paymaster payout control plane for #140.
-- No production deployment, key, provider call, payable conclusion, or value flow is enabled here.

CREATE TABLE public.base_payout_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  authorization_enabled boolean NOT NULL DEFAULT false,
  observation_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  CHECK(production_value_flow_enabled=false),
  CHECK(deployment_environment<>'production' OR (NOT authorization_enabled AND NOT observation_enabled))
);
INSERT INTO public.base_payout_runtime_controls VALUES
  ('local',true,true,false),('development',true,true,false),('dev',true,true,false),('preview',true,true,false),('test',true,true,false),('production',false,false,false)
ON CONFLICT(deployment_environment) DO NOTHING;

CREATE TABLE public.base_safe_payout_deployments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_environment text NOT NULL REFERENCES public.base_payout_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  chain_id bigint NOT NULL,
  safe_role text NOT NULL,
  safe_address text NOT NULL,
  module_address text NOT NULL,
  paymaster_policy_address text NOT NULL,
  limited_signer_address text NOT NULL,
  module_owner_address text NOT NULL,
  paymaster_owner_address text NOT NULL,
  paymaster_controller_address text NOT NULL,
  max_per_transaction_native numeric(78,0) NOT NULL,
  max_rolling_24h_native numeric(78,0) NOT NULL,
  max_per_epoch_native numeric(78,0) NOT NULL,
  is_paused boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deployment_environment,chain_id,safe_role),
  UNIQUE(deployment_environment,chain_id,safe_address),
  UNIQUE(deployment_environment,chain_id,module_address),
  CHECK(deployment_environment IN('local','development','dev','preview','test','production')),
  CHECK(chain_id IN(31337,84532,8453)),
  CHECK(safe_role IN('epoch','platform')),
  CHECK(safe_address ~* '^0x[0-9a-f]{40}$' AND module_address ~* '^0x[0-9a-f]{40}$'
    AND paymaster_policy_address ~* '^0x[0-9a-f]{40}$' AND limited_signer_address ~* '^0x[0-9a-f]{40}$'),
  CHECK(module_owner_address ~* '^0x[0-9a-f]{40}$' AND paymaster_owner_address ~* '^0x[0-9a-f]{40}$' AND paymaster_controller_address ~* '^0x[0-9a-f]{40}$'),
  CHECK(lower(module_owner_address)=lower(safe_address) AND lower(paymaster_owner_address)=lower(safe_address)
    AND lower(paymaster_controller_address)=lower(module_address)),
  CHECK(max_per_transaction_native>0 AND max_rolling_24h_native>=max_per_transaction_native AND max_per_epoch_native>=max_per_transaction_native),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CHECK(production_enabled=false),
  CHECK(deployment_environment<>'production' OR (NOT is_active AND is_paused))
);

CREATE TABLE public.base_safe_payout_assets (
  deployment_id bigint NOT NULL REFERENCES public.base_safe_payout_deployments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  token_address text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  evidence_hash text NOT NULL,
  PRIMARY KEY(deployment_id,financial_asset_id),
  UNIQUE(deployment_id,token_address),
  CHECK(token_address ~* '^0x[0-9a-f]{40}$'),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE public.base_paymaster_budgets (
  deployment_id bigint PRIMARY KEY REFERENCES public.base_safe_payout_deployments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  remaining_native numeric(78,0) NOT NULL,
  max_per_request_native numeric(78,0) NOT NULL,
  is_paused boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1,
  evidence_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(remaining_native>=0 AND max_per_request_native>0 AND version>0),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE public.base_payout_execution_commands (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payout_execution_attempt_id bigint NOT NULL UNIQUE REFERENCES public.payout_execution_attempts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  withdrawal_request_id uuid NOT NULL UNIQUE REFERENCES public.user_withdrawal_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payout_intent_id bigint NOT NULL UNIQUE REFERENCES public.payout_intents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_id bigint NOT NULL REFERENCES public.base_safe_payout_deployments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  token_address text NOT NULL,
  recipient_address text NOT NULL,
  fee_recipient_address text NOT NULL,
  native_atomic_amount numeric(78,0) NOT NULL,
  user_fee_native_amount numeric(78,0) NOT NULL DEFAULT 0,
  request_hash text NOT NULL UNIQUE,
  epoch_key text NOT NULL,
  module_nonce numeric(78,0) NOT NULL,
  expires_at timestamptz NOT NULL,
  gas_budget_native numeric(78,0) NOT NULL,
  status text NOT NULL DEFAULT 'authorized',
  authorized_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(deployment_id,module_nonce),
  CHECK(token_address ~* '^0x[0-9a-f]{40}$' AND recipient_address ~* '^0x[0-9a-f]{40}$' AND fee_recipient_address ~* '^0x[0-9a-f]{40}$'),
  CHECK(request_hash ~ '^0x[0-9a-f]{64}$' AND epoch_key ~ '^0x[0-9a-f]{64}$'),
  CHECK(native_atomic_amount>0 AND user_fee_native_amount>=0 AND gas_budget_native>=0 AND module_nonce>0),
  CHECK(status IN('authorized','submitted','confirming','finalized','failed','replaced','reorged','reconciled')),
  CHECK(production_enabled=false)
);
CREATE INDEX base_payout_commands_rolling_idx ON public.base_payout_execution_commands(deployment_id,authorized_at,id)
WHERE status IN('authorized','submitted','confirming','finalized','reconciled');
CREATE INDEX base_payout_commands_epoch_idx ON public.base_payout_execution_commands(deployment_id,monthly_cycle_id,id)
WHERE status IN('authorized','submitted','confirming','finalized','reconciled');

CREATE TABLE public.base_payout_fee_inventory_reservations (
  command_id bigint NOT NULL REFERENCES public.base_payout_execution_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  inventory_lot_id bigint NOT NULL REFERENCES public.payout_inventory_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_amount numeric(78,0) NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  PRIMARY KEY(command_id,inventory_lot_id),
  CHECK(native_atomic_amount>0),
  CHECK(status IN('reserved','consumed','released'))
);
CREATE INDEX base_payout_fee_inventory_active_idx ON public.base_payout_fee_inventory_reservations(inventory_lot_id,status,command_id)
WHERE status IN('reserved','consumed');

CREATE TABLE public.base_payout_execution_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  command_id bigint NOT NULL REFERENCES public.base_payout_execution_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL,
  tx_hash text NOT NULL,
  replacement_tx_hash text,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  current_block_number bigint NOT NULL,
  confirmation_count integer NOT NULL,
  l1_batch_finalized boolean NOT NULL DEFAULT false,
  receipt_success boolean NOT NULL,
  observed_token_address text NOT NULL,
  observed_recipient_address text NOT NULL,
  observed_native_atomic_amount numeric(78,0) NOT NULL,
  observed_fee_recipient_address text NOT NULL,
  observed_user_fee_native_amount numeric(78,0) NOT NULL,
  observed_gas_budget_native numeric(78,0) NOT NULL,
  observed_request_hash text NOT NULL,
  observation_source text NOT NULL,
  ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(command_id,tx_hash,block_hash,status),
  CHECK(status IN('submitted','confirming','finalized','failed','replaced','reorged','reconciled')),
  CHECK(tx_hash ~ '^0x[0-9a-f]{64}$' AND (replacement_tx_hash IS NULL OR replacement_tx_hash ~ '^0x[0-9a-f]{64}$')
    AND block_hash ~ '^0x[0-9a-f]{64}$' AND observed_request_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK(observed_token_address ~* '^0x[0-9a-f]{40}$' AND observed_recipient_address ~* '^0x[0-9a-f]{40}$'
    AND observed_fee_recipient_address ~* '^0x[0-9a-f]{40}$'),
  CHECK(block_number>=0 AND current_block_number>=block_number AND confirmation_count>=0 AND observed_native_atomic_amount>=0
    AND observed_user_fee_native_amount>=0 AND observed_gas_budget_native>=0),
  CHECK(observation_source='trusted_viem_v1' AND evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX base_payout_observations_latest_idx ON public.base_payout_execution_observations(command_id,observed_at DESC,id DESC);

CREATE TABLE public.base_payout_reconciliation_links (
  command_id bigint PRIMARY KEY REFERENCES public.base_payout_execution_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  observation_id bigint NOT NULL UNIQUE REFERENCES public.base_payout_execution_observations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ledger_transaction_id bigint NOT NULL UNIQUE REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions,review_posting_enabled,production_enabled)
VALUES('review_epoch_payout_custody','credit','review_asset_control','["project","user"]',true,false),
  ('review_user_payout_control','debit','review_equity_control','["project","user"]',true,false),
  ('review_platform_fee_control','debit','review_equity_control','["project","user"]',true,false)
ON CONFLICT(account_key) DO UPDATE SET review_posting_enabled=true,production_enabled=false;

CREATE FUNCTION public.base_payout_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'base_payout_evidence_append_only'; END; $$;
CREATE TRIGGER base_payout_observations_append_only BEFORE UPDATE OR DELETE ON public.base_payout_execution_observations
FOR EACH ROW EXECUTE FUNCTION public.base_payout_append_only();

CREATE FUNCTION public.authorize_base_safe_payout(p_actor_user_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment'); v_deployment public.base_safe_payout_deployments%ROWTYPE;
  v_platform public.base_safe_payout_deployments%ROWTYPE;
  v_intent public.payout_intents%ROWTYPE; v_request public.user_withdrawal_requests%ROWTYPE; v_route public.user_payout_routes%ROWTYPE;
  v_budget public.base_paymaster_budgets%ROWTYPE; v_attempt_id bigint; v_command_id bigint; v_rolling numeric(78,0); v_epoch numeric(78,0);
  v_recipient text:=lower(p_command->>'recipientAddress'); v_fee_recipient text:=lower(p_command->>'feeRecipientAddress');
  v_token text:=lower(p_command->>'tokenAddress'); v_amount numeric(78,0):=(p_command->>'nativeAtomicAmount')::numeric;
  v_fee numeric(78,0); v_total numeric(78,0); v_fee_remaining numeric(78,0); v_take numeric(78,0); v_lot record;
BEGIN
  IF p_command->>'contractVersion'<>'base_safe_payout_authorize.v1' OR v_environment NOT IN('local','development','dev','preview','test')
    OR NOT EXISTS(SELECT 1 FROM public.base_payout_runtime_controls WHERE deployment_environment=v_environment AND authorization_enabled AND NOT production_value_flow_enabled)
  THEN RAISE EXCEPTION 'base_payout_runtime_disabled'; END IF;
  IF p_actor_user_id IS NULL OR p_command->>'requestHash' !~ '^0x[0-9a-f]{64}$' OR p_command->>'epochKey' !~ '^0x[0-9a-f]{64}$'
    OR v_recipient !~ '^0x[0-9a-f]{40}$' OR v_fee_recipient !~ '^0x[0-9a-f]{40}$' OR v_token !~ '^0x[0-9a-f]{40}$'
  THEN RAISE EXCEPTION 'base_payout_contract_invalid'; END IF;
  SELECT * INTO v_deployment FROM public.base_safe_payout_deployments WHERE id=(p_command->>'deploymentId')::bigint FOR UPDATE;
  IF v_deployment.id IS NULL OR v_deployment.deployment_environment<>v_environment OR v_deployment.safe_role<>'epoch'
    OR NOT v_deployment.is_active OR v_deployment.is_paused OR v_deployment.production_enabled THEN RAISE EXCEPTION 'base_payout_deployment_unavailable'; END IF;
  SELECT * INTO v_platform FROM public.base_safe_payout_deployments WHERE deployment_environment=v_environment AND chain_id=v_deployment.chain_id
    AND safe_role='platform' FOR UPDATE;
  IF v_platform.id IS NULL OR NOT v_platform.is_active OR v_platform.is_paused OR v_platform.production_enabled
    OR lower(v_platform.safe_address)<>v_fee_recipient THEN RAISE EXCEPTION 'base_payout_platform_safe_unavailable'; END IF;
  SELECT * INTO v_intent FROM public.payout_intents WHERE id=(p_command->>'payoutIntentId')::bigint FOR UPDATE;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=v_intent.withdrawal_request_id FOR UPDATE;
  SELECT * INTO v_route FROM public.user_payout_routes WHERE id=v_intent.payout_route_id;
  IF v_intent.id IS NULL OR v_intent.rail<>'evm' OR v_intent.status NOT IN('draft','ready') OR v_request.status<>'reserved'
    OR v_request.project_id IS NULL OR v_request.financial_asset_id<>v_intent.financial_asset_id OR v_request.net_minor<>v_intent.amount_usd*100
    OR lower(v_route.destination->>'address')<>v_recipient OR v_intent.native_atomic_amount<>v_amount
  THEN RAISE EXCEPTION 'base_payout_intent_mismatch'; END IF;
  v_fee:=CASE WHEN v_request.fee_minor=0 THEN 0 ELSE ceil(v_amount*v_request.fee_minor/v_request.net_minor) END;
  IF (p_command->>'userFeeNativeAmount')::numeric<>v_fee THEN RAISE EXCEPTION 'base_payout_user_fee_mismatch'; END IF;
  v_total:=v_amount+v_fee;
  IF NOT EXISTS(SELECT 1 FROM public.base_safe_payout_assets WHERE deployment_id=v_deployment.id AND financial_asset_id=v_intent.financial_asset_id
    AND lower(token_address)=v_token AND is_enabled) THEN RAISE EXCEPTION 'base_payout_token_not_allowed'; END IF;
  IF v_total>v_deployment.max_per_transaction_native THEN RAISE EXCEPTION 'base_payout_transaction_limit'; END IF;
  SELECT coalesce(sum(native_atomic_amount+user_fee_native_amount),0) INTO v_rolling FROM public.base_payout_execution_commands
    WHERE deployment_id=v_deployment.id AND authorized_at>clock_timestamp()-interval '24 hours' AND status IN('authorized','submitted','confirming','finalized','reconciled');
  SELECT coalesce(sum(native_atomic_amount+user_fee_native_amount),0) INTO v_epoch FROM public.base_payout_execution_commands
    WHERE deployment_id=v_deployment.id AND monthly_cycle_id=v_intent.monthly_cycle_id AND status IN('authorized','submitted','confirming','finalized','reconciled');
  IF v_rolling+v_total>v_deployment.max_rolling_24h_native THEN RAISE EXCEPTION 'base_payout_rolling_limit'; END IF;
  IF v_epoch+v_total>v_deployment.max_per_epoch_native THEN RAISE EXCEPTION 'base_payout_epoch_limit'; END IF;
  SELECT * INTO v_budget FROM public.base_paymaster_budgets WHERE deployment_id=v_deployment.id FOR UPDATE;
  IF v_budget.deployment_id IS NULL OR v_budget.is_paused OR (p_command->>'gasBudgetNative')::numeric>v_budget.max_per_request_native
    OR (p_command->>'gasBudgetNative')::numeric>v_budget.remaining_native THEN RAISE EXCEPTION 'base_paymaster_budget_unavailable'; END IF;
  INSERT INTO public.payout_execution_attempts(withdrawal_request_id,payout_intent_id,attempt_no,rail_key,financial_asset_id,destination_hash,request_hash,status)
  VALUES(v_request.id,v_intent.id,1,'base_stablecoin',v_intent.financial_asset_id,v_request.destination_hash,substring(p_command->>'requestHash' from 3),'planned')
  RETURNING id INTO v_attempt_id;
  INSERT INTO public.base_payout_execution_commands(payout_execution_attempt_id,withdrawal_request_id,payout_intent_id,deployment_id,monthly_cycle_id,
    project_id,financial_asset_id,token_address,recipient_address,fee_recipient_address,native_atomic_amount,user_fee_native_amount,request_hash,epoch_key,module_nonce,
    expires_at,gas_budget_native,authorized_by_user_id)
  VALUES(v_attempt_id,v_request.id,v_intent.id,v_deployment.id,v_intent.monthly_cycle_id,v_request.project_id,v_intent.financial_asset_id,v_token,
    v_recipient,v_fee_recipient,v_amount,v_fee,p_command->>'requestHash',p_command->>'epochKey',(p_command->>'moduleNonce')::numeric,
    (p_command->>'expiresAt')::timestamptz,(p_command->>'gasBudgetNative')::numeric,p_actor_user_id) RETURNING id INTO v_command_id;
  v_fee_remaining:=v_fee;
  IF v_fee_remaining>0 THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('base-payout-inventory:'||v_request.user_id::text||':'||v_request.project_id::text||':'||v_request.financial_asset_id::text,0));
    PERFORM 1 FROM public.payout_inventory_lots lot WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
      AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key ORDER BY lot.id FOR UPDATE;
    FOR v_lot IN
      SELECT lot.id,lot.native_atomic_total-coalesce((SELECT sum(r.native_atomic_amount) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)-coalesce((SELECT sum(f.native_atomic_amount)
        FROM public.base_payout_fee_inventory_reservations f WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','consumed')),0) available_native
      FROM public.payout_inventory_lots lot WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
        AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key ORDER BY lot.deterministic_sequence,lot.id
    LOOP
      EXIT WHEN v_fee_remaining=0; v_take:=least(v_fee_remaining,greatest(v_lot.available_native,0));
      IF v_take>0 THEN INSERT INTO public.base_payout_fee_inventory_reservations VALUES(v_command_id,v_lot.id,v_take,'reserved'); v_fee_remaining:=v_fee_remaining-v_take; END IF;
    END LOOP;
    IF v_fee_remaining>0 THEN RAISE EXCEPTION 'base_payout_user_fee_inventory_unavailable'; END IF;
  END IF;
  UPDATE public.base_paymaster_budgets SET remaining_native=remaining_native-(p_command->>'gasBudgetNative')::numeric,version=version+1,updated_at=clock_timestamp()
    WHERE deployment_id=v_deployment.id;
  RETURN jsonb_build_object('commandId',v_command_id,'attemptId',v_attempt_id,'requestHash',p_command->>'requestHash','safeAddress',lower(v_deployment.safe_address),
    'moduleAddress',lower(v_deployment.module_address),'paymasterPolicyAddress',lower(v_deployment.paymaster_policy_address),'status','authorized','noValueTransferred',true);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS(SELECT 1 FROM public.base_payout_execution_commands WHERE payout_intent_id=(p_command->>'payoutIntentId')::bigint AND request_hash=p_command->>'requestHash') THEN
    RETURN (SELECT jsonb_build_object('commandId',id,'attemptId',payout_execution_attempt_id,'requestHash',request_hash,'status',status,'noValueTransferred',true)
      FROM public.base_payout_execution_commands WHERE payout_intent_id=(p_command->>'payoutIntentId')::bigint);
  END IF;
  RAISE EXCEPTION 'base_payout_idempotency_conflict';
END; $$;

CREATE FUNCTION public.get_base_safe_payout_authorization_input(p_payout_intent_id bigint,p_deployment_id bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.payout_intents%ROWTYPE; v_request public.user_withdrawal_requests%ROWTYPE; v_route public.user_payout_routes%ROWTYPE;
  v_deployment public.base_safe_payout_deployments%ROWTYPE; v_platform public.base_safe_payout_deployments%ROWTYPE;
  v_token text; v_cycle_key text; v_nonce numeric(78,0); v_fee numeric(78,0);
BEGIN
  SELECT * INTO v_intent FROM public.payout_intents WHERE id=p_payout_intent_id;
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=v_intent.withdrawal_request_id;
  SELECT * INTO v_route FROM public.user_payout_routes WHERE id=v_intent.payout_route_id;
  SELECT * INTO v_deployment FROM public.base_safe_payout_deployments WHERE id=p_deployment_id;
  SELECT * INTO v_platform FROM public.base_safe_payout_deployments WHERE deployment_environment=v_deployment.deployment_environment
    AND chain_id=v_deployment.chain_id AND safe_role='platform';
  SELECT token_address INTO v_token FROM public.base_safe_payout_assets WHERE deployment_id=p_deployment_id
    AND financial_asset_id=v_intent.financial_asset_id AND is_enabled;
  SELECT cycle_key INTO v_cycle_key FROM public.monthly_cycles WHERE id=v_intent.monthly_cycle_id;
  SELECT coalesce(max(module_nonce),0)+1 INTO v_nonce FROM public.base_payout_execution_commands WHERE deployment_id=p_deployment_id;
  IF v_intent.id IS NULL OR v_request.id IS NULL OR v_route.id IS NULL OR v_deployment.id IS NULL OR v_platform.id IS NULL OR v_token IS NULL THEN
    RAISE EXCEPTION 'base_payout_authorization_input_unavailable';
  END IF;
  v_fee:=CASE WHEN v_request.fee_minor=0 THEN 0 ELSE ceil(v_intent.native_atomic_amount*v_request.fee_minor/v_request.net_minor) END;
  RETURN jsonb_build_object('deploymentId',v_deployment.id,'chainId',v_deployment.chain_id,'safeAddress',lower(v_deployment.safe_address),
    'moduleAddress',lower(v_deployment.module_address),'paymasterPolicyAddress',lower(v_deployment.paymaster_policy_address),
    'payoutIntentId',v_intent.id,'recipientAddress',lower(v_route.destination->>'address'),'feeRecipientAddress',lower(v_platform.safe_address),'tokenAddress',lower(v_token),
    'nativeAtomicAmount',v_intent.native_atomic_amount::text,'userFeeNativeAmount',v_fee::text,'epochKey','0x'||encode(extensions.digest(
      pg_catalog.convert_to('fundloop-base-payout-epoch:'||v_cycle_key,'UTF8'),'sha256'),'hex'),'moduleNonce',v_nonce::text);
END; $$;

CREATE FUNCTION public.reconcile_base_safe_payout(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(p_command->>'deploymentEnvironment'); v_command public.base_payout_execution_commands%ROWTYPE;
  v_request public.user_withdrawal_requests%ROWTYPE; v_intent public.payout_intents%ROWTYPE; v_cycle public.monthly_cycles%ROWTYPE;
  v_asset public.financial_assets%ROWTYPE; v_custody public.financial_custody_accounts%ROWTYPE; v_ledger_id bigint; v_status text:=p_command->>'status';
BEGIN
  IF p_command->>'contractVersion'<>'base_safe_payout_observation.v1' OR p_command->>'observationSource'<>'trusted_viem_v1'
    OR v_environment NOT IN('local','development','dev','preview','test') OR NOT EXISTS(SELECT 1 FROM public.base_payout_runtime_controls
      WHERE deployment_environment=v_environment AND observation_enabled AND NOT production_value_flow_enabled)
  THEN RAISE EXCEPTION 'base_payout_observation_disabled'; END IF;
  SELECT * INTO v_command FROM public.base_payout_execution_commands WHERE id=(p_command->>'commandId')::bigint FOR UPDATE;
  IF v_command.id IS NULL THEN RAISE EXCEPTION 'base_payout_command_not_found'; END IF;
  IF lower(p_command->>'observedTokenAddress')<>lower(v_command.token_address)
    OR lower(p_command->>'observedRecipientAddress')<>lower(v_command.recipient_address)
    OR lower(p_command->>'observedFeeRecipientAddress')<>lower(v_command.fee_recipient_address)
    OR (p_command->>'observedNativeAtomicAmount')::numeric<>v_command.native_atomic_amount
    OR (p_command->>'observedUserFeeNativeAmount')::numeric<>v_command.user_fee_native_amount
    OR (p_command->>'observedGasBudgetNative')::numeric<>v_command.gas_budget_native
    OR p_command->>'observedRequestHash'<>v_command.request_hash THEN RAISE EXCEPTION 'base_payout_observation_mismatch'; END IF;
  IF v_status='finalized' AND (NOT (p_command->>'receiptSuccess')::boolean OR NOT (p_command->>'l1BatchFinalized')::boolean)
  THEN RAISE EXCEPTION 'base_payout_finality_required'; END IF;
  INSERT INTO public.base_payout_execution_observations(command_id,status,tx_hash,replacement_tx_hash,block_number,block_hash,current_block_number,
    confirmation_count,l1_batch_finalized,receipt_success,observed_token_address,observed_recipient_address,observed_native_atomic_amount,
    observed_fee_recipient_address,observed_user_fee_native_amount,observed_gas_budget_native,
    observed_request_hash,observation_source,evidence_hash,observed_at)
  VALUES(v_command.id,v_status,lower(p_command->>'txHash'),nullif(lower(p_command->>'replacementTxHash'),''),(p_command->>'blockNumber')::bigint,
    lower(p_command->>'blockHash'),(p_command->>'currentBlockNumber')::bigint,(p_command->>'confirmationCount')::integer,
    (p_command->>'l1BatchFinalized')::boolean,(p_command->>'receiptSuccess')::boolean,lower(p_command->>'observedTokenAddress'),
    lower(p_command->>'observedRecipientAddress'),(p_command->>'observedNativeAtomicAmount')::numeric,
    lower(p_command->>'observedFeeRecipientAddress'),(p_command->>'observedUserFeeNativeAmount')::numeric,(p_command->>'observedGasBudgetNative')::numeric,p_command->>'observedRequestHash',
    'trusted_viem_v1',p_command->>'evidenceHash',(p_command->>'observedAt')::timestamptz);
  UPDATE public.base_payout_execution_commands SET status=v_status WHERE id=v_command.id;
  UPDATE public.payout_execution_attempts SET status=CASE v_status WHEN 'finalized' THEN 'confirmed' WHEN 'failed' THEN 'failed'
    WHEN 'reorged' THEN 'failed' WHEN 'replaced' THEN 'submitted' WHEN 'confirming' THEN 'submitted' ELSE 'submitted' END,provider_reference=p_command->>'txHash'
    WHERE id=v_command.payout_execution_attempt_id;
  IF v_status='finalized' THEN
    SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=v_command.withdrawal_request_id;
    SELECT * INTO v_intent FROM public.payout_intents WHERE id=v_command.payout_intent_id;
    SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id=v_command.monthly_cycle_id;
    SELECT * INTO v_asset FROM public.financial_assets WHERE id=v_command.financial_asset_id;
    SELECT custody.* INTO v_custody FROM public.payout_inventory_reservations reservation JOIN public.payout_inventory_lots lot ON lot.id=reservation.inventory_lot_id
      JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id WHERE reservation.withdrawal_request_id=v_request.id ORDER BY reservation.sequence_no LIMIT 1;
    v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
      'periodKey',(SELECT period_key FROM public.accounting_periods period JOIN public.epoch_shadow_states state ON state.accounting_period_id=period.id WHERE state.monthly_cycle_id=v_cycle.id),
      'transactionType','base_payout_review','idempotencyKey','base-payout:'||v_command.id::text,'evidenceHash',p_command->>'evidenceHash',
      'actorType','service','actorUserId','', 'effectiveAt',p_command->>'observedAt','postings',CASE WHEN v_command.user_fee_native_amount>0 THEN jsonb_build_array(
        jsonb_build_object('accountKey','review_user_payout_control','side','debit','assetKey',v_asset.asset_key,'custodyKey',v_custody.custody_key,
          'nativeAtomicAmount',v_command.native_atomic_amount::text,'functionalUsdAmount',v_intent.amount_usd::text,'fxUsdPerUnit',(v_intent.amount_usd/(v_command.native_atomic_amount/power(10,v_asset.atomic_scale)))::text,
          'projectId',v_command.project_id,'userId',v_request.user_id),
        jsonb_build_object('accountKey','review_platform_fee_control','side','debit','assetKey',v_asset.asset_key,'custodyKey',v_custody.custody_key,
          'nativeAtomicAmount',v_command.user_fee_native_amount::text,'functionalUsdAmount',(v_request.fee_minor/100)::text,
          'fxUsdPerUnit',((v_request.fee_minor/100)/(v_command.user_fee_native_amount/power(10,v_asset.atomic_scale)))::text,
          'projectId',v_command.project_id,'userId',v_request.user_id),
        jsonb_build_object('accountKey','review_epoch_payout_custody','side','credit','assetKey',v_asset.asset_key,'custodyKey',v_custody.custody_key,
          'nativeAtomicAmount',(v_command.native_atomic_amount+v_command.user_fee_native_amount)::text,'functionalUsdAmount',(v_intent.amount_usd+v_request.fee_minor/100)::text,
          'fxUsdPerUnit',((v_intent.amount_usd+v_request.fee_minor/100)/((v_command.native_atomic_amount+v_command.user_fee_native_amount)/power(10,v_asset.atomic_scale)))::text,
          'projectId',v_command.project_id,'userId',v_request.user_id)) ELSE jsonb_build_array(
        jsonb_build_object('accountKey','review_user_payout_control','side','debit','assetKey',v_asset.asset_key,'custodyKey',v_custody.custody_key,
          'nativeAtomicAmount',v_command.native_atomic_amount::text,'functionalUsdAmount',v_intent.amount_usd::text,'fxUsdPerUnit',(v_intent.amount_usd/(v_command.native_atomic_amount/power(10,v_asset.atomic_scale)))::text,
          'projectId',v_command.project_id,'userId',v_request.user_id),
        jsonb_build_object('accountKey','review_epoch_payout_custody','side','credit','assetKey',v_asset.asset_key,'custodyKey',v_custody.custody_key,
          'nativeAtomicAmount',v_command.native_atomic_amount::text,'functionalUsdAmount',v_intent.amount_usd::text,'fxUsdPerUnit',(v_intent.amount_usd/(v_command.native_atomic_amount/power(10,v_asset.atomic_scale)))::text,
          'projectId',v_command.project_id,'userId',v_request.user_id)) END));
    INSERT INTO public.base_payout_reconciliation_links(command_id,observation_id,ledger_transaction_id)
    SELECT v_command.id,id,v_ledger_id FROM public.base_payout_execution_observations
      WHERE command_id=v_command.id AND tx_hash=lower(p_command->>'txHash') AND block_hash=lower(p_command->>'blockHash') AND status='finalized';
    UPDATE public.base_payout_execution_commands SET status='reconciled' WHERE id=v_command.id;
    UPDATE public.payout_execution_attempts SET status='reconciled' WHERE id=v_command.payout_execution_attempt_id;
    UPDATE public.payout_inventory_reservations SET status='consumed' WHERE withdrawal_request_id=v_request.id AND status IN('reserved','held');
    UPDATE public.base_payout_fee_inventory_reservations SET status='consumed' WHERE command_id=v_command.id AND status='reserved';
    UPDATE public.user_withdrawal_obligation_claims SET status='paid',updated_at=clock_timestamp() WHERE withdrawal_request_id=v_request.id AND status IN('reserved','held');
    UPDATE public.user_withdrawal_requests SET status='paid',closed_at=clock_timestamp(),status_reason='base_finalized_and_reconciled' WHERE id=v_request.id;
    UPDATE public.payout_intents SET status='paid',status_reason='base_finalized_and_reconciled' WHERE id=v_intent.id;
    INSERT INTO public.payout_reconciliation_events(payout_intent_id,status,rail,external_reference,observed_amount_usd,metadata,note)
    VALUES(v_intent.id,'matched','evm',lower(p_command->>'txHash'),v_intent.amount_usd,jsonb_build_object('ledgerTransactionId',v_ledger_id,'l1BatchFinalized',true),'trusted Base payout reconciliation');
  END IF;
  RETURN jsonb_build_object('commandId',v_command.id,'status',CASE WHEN v_status='finalized' THEN 'reconciled' ELSE v_status END,
    'ledgerTransactionId',v_ledger_id,'paid',v_status='finalized','noUnmatchedPaidState',true);
END; $$;

-- Keep later withdrawal reservations from reusing native inventory already bound to an authorized platform-fee transfer.
CREATE OR REPLACE FUNCTION public.reserve_withdrawal_inventory(p_request_id uuid,p_now timestamptz DEFAULT clock_timestamp())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.user_withdrawal_requests%ROWTYPE; v_need numeric(78,0); v_remaining numeric(78,0); v_lot record; v_take numeric(78,0); v_native numeric(78,0); v_seq integer:=0;
BEGIN
  SELECT * INTO v_request FROM public.user_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.net_minor IS NULL OR v_request.net_minor=0 THEN RETURN true; END IF;
  IF v_request.project_id IS NULL THEN RAISE EXCEPTION 'withdrawal_project_scope_required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('base-payout-inventory:'||v_request.user_id::text||':'||v_request.project_id::text||':'||v_request.financial_asset_id::text,0));
  v_need:=v_request.net_minor; v_remaining:=v_need;
  FOR v_lot IN
    SELECT lot.*,asset.atomic_scale,fx.rate_usd_per_unit,
      lot.canonical_minor_total-coalesce((SELECT sum(r.reserved_minor) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0) AS available_minor,
      lot.native_atomic_total-coalesce((SELECT sum(r.native_atomic_amount) FROM public.payout_inventory_reservations r
        WHERE r.inventory_lot_id=lot.id AND r.status IN('reserved','held','consumed')),0)-coalesce((SELECT sum(f.native_atomic_amount)
        FROM public.base_payout_fee_inventory_reservations f WHERE f.inventory_lot_id=lot.id AND f.status IN('reserved','consumed')),0) AS available_native
    FROM public.payout_inventory_lots lot
    JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
    JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id
    WHERE lot.user_id=v_request.user_id AND lot.project_id=v_request.project_id
      AND lot.financial_asset_id=v_request.financial_asset_id AND lot.rail_key=v_request.rail_key
      AND lot.status IN('available','reserved')
      AND EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims claim
        WHERE claim.withdrawal_request_id=v_request.id AND claim.obligation_id=lot.obligation_id AND claim.status IN('queued','reserved','held'))
    ORDER BY lot.monthly_cycle_id,lot.deterministic_sequence,lot.id FOR UPDATE OF lot
  LOOP
    EXIT WHEN v_remaining=0;
    IF v_lot.available_minor<=0 OR v_lot.available_native<=0 THEN CONTINUE; END IF;
    v_take:=least(v_remaining,v_lot.available_minor);
    v_native:=ceil((v_take::numeric/100)/v_lot.rate_usd_per_unit*power(10,v_lot.atomic_scale));
    IF v_native>v_lot.available_native THEN
      v_take:=floor(v_lot.available_native/power(10,v_lot.atomic_scale)*v_lot.rate_usd_per_unit*100);
      IF v_take<=0 THEN CONTINUE; END IF;
      v_native:=ceil((v_take::numeric/100)/v_lot.rate_usd_per_unit*power(10,v_lot.atomic_scale));
    END IF;
    v_seq:=v_seq+1;
    INSERT INTO public.payout_inventory_reservations(withdrawal_request_id,inventory_lot_id,sequence_no,reserved_minor,
      native_atomic_amount,originating_fx_snapshot_id,reserved_at,expires_at)
    VALUES(v_request.id,v_lot.id,v_seq,v_take,v_native,v_lot.fx_snapshot_id,p_now,p_now+interval '48 hours');
    v_remaining:=v_remaining-v_take;
  END LOOP;
  IF v_remaining>0 THEN
    DELETE FROM public.payout_inventory_reservations WHERE withdrawal_request_id=v_request.id AND status='reserved';
    RETURN false;
  END IF;
  RETURN true;
END; $$;

ALTER TABLE public.base_safe_payout_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_safe_payout_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_paymaster_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payout_execution_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payout_fee_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payout_execution_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payout_reconciliation_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_payout_runtime_controls,public.base_safe_payout_deployments,public.base_safe_payout_assets,public.base_paymaster_budgets,
  public.base_payout_execution_commands,public.base_payout_fee_inventory_reservations,public.base_payout_execution_observations,public.base_payout_reconciliation_links
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.base_safe_payout_deployments,public.base_safe_payout_assets,public.base_paymaster_budgets,
  public.base_payout_execution_commands,public.base_payout_fee_inventory_reservations,public.base_payout_execution_observations,public.base_payout_reconciliation_links TO service_role;
REVOKE ALL ON FUNCTION public.authorize_base_safe_payout(uuid,jsonb),public.get_base_safe_payout_authorization_input(bigint,bigint),
  public.reconcile_base_safe_payout(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_base_safe_payout(uuid,jsonb),public.get_base_safe_payout_authorization_input(bigint,bigint),
  public.reconcile_base_safe_payout(jsonb) TO service_role;
