CREATE TABLE public.base_intake_v2_deployments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_environment text NOT NULL,
  chain_id bigint NOT NULL,
  contract_version text NOT NULL DEFAULT 'fundloop-base-intake-v2',
  contract_address text NOT NULL,
  platform_treasury_address text NOT NULL,
  epoch_treasury_address text NOT NULL,
  minimum_confirmation_depth integer NOT NULL DEFAULT 12,
  is_paused boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deployment_environment, chain_id, contract_version),
  CHECK (deployment_environment IN ('local', 'dev', 'test', 'production')),
  CHECK (chain_id IN (31337, 84532, 8453)),
  CHECK (contract_version = 'fundloop-base-intake-v2'),
  CHECK (contract_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (platform_treasury_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (epoch_treasury_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (platform_treasury_address <> epoch_treasury_address),
  CHECK (minimum_confirmation_depth > 0),
  CHECK (production_value_flow_enabled = false),
  CHECK (deployment_environment <> 'production' OR (is_active = false AND is_paused = true))
);

CREATE TABLE public.base_intake_v2_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id bigint NOT NULL REFERENCES public.base_intake_v2_deployments(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  token_address text NOT NULL,
  financial_asset_id bigint REFERENCES public.financial_assets(id) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT false,
  address_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (deployment_id, symbol),
  UNIQUE (deployment_id, token_address),
  CHECK (symbol IN ('USDC', 'USDT', 'PYUSD')),
  CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (jsonb_typeof(address_evidence) = 'object')
);

CREATE TABLE public.base_project_fee_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  fee_bps integer NOT NULL,
  evidence_hash text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  CHECK (fee_bps BETWEEN 0 AND 1000),
  CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX base_project_fee_versions_current_idx ON public.base_project_fee_versions(project_id) WHERE is_current;

CREATE TABLE public.base_intake_v2_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id bigint NOT NULL REFERENCES public.base_intake_v2_deployments(id) ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  accounting_period_id bigint NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  fee_version_id bigint NOT NULL REFERENCES public.base_project_fee_versions(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  tx_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  sender_address text NOT NULL,
  token_symbol text NOT NULL,
  token_address text NOT NULL,
  gross_native_amount numeric(78,0) NOT NULL,
  project_fee_bps integer NOT NULL,
  platform_fee_native_amount numeric(78,0) NOT NULL,
  net_epoch_native_amount numeric(78,0) NOT NULL,
  platform_treasury_address text NOT NULL,
  epoch_treasury_address text NOT NULL,
  evidence_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, provider_event_id),
  UNIQUE (deployment_id, tx_hash, log_index),
  CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK (block_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK (sender_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (token_symbol IN ('USDC', 'USDT', 'PYUSD')),
  CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  CHECK (gross_native_amount > 0),
  CHECK (project_fee_bps BETWEEN 0 AND 1000),
  CHECK (platform_fee_native_amount = trunc(gross_native_amount * project_fee_bps / 10000)),
  CHECK (gross_native_amount = platform_fee_native_amount + net_epoch_native_amount),
  CHECK (platform_treasury_address <> epoch_treasury_address),
  CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CHECK (production_enabled = false)
);

CREATE TABLE public.base_intake_v2_reconciliation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id bigint NOT NULL REFERENCES public.base_intake_v2_receipts(id) ON DELETE RESTRICT,
  status text NOT NULL,
  current_block_number bigint NOT NULL,
  observed_block_hash text NOT NULL,
  observed_tx_hash text NOT NULL,
  replacement_tx_hash text,
  confirmation_count integer NOT NULL,
  platform_observed_native_amount numeric(78,0) NOT NULL,
  epoch_observed_native_amount numeric(78,0) NOT NULL,
  evidence_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('confirming', 'exact', 'mismatch', 'reorged', 'replaced')),
  CHECK (observed_block_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK (observed_tx_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK (replacement_tx_hash IS NULL OR replacement_tx_hash ~ '^0x[0-9a-f]{64}$'),
  CHECK (confirmation_count >= 0),
  CHECK (platform_observed_native_amount >= 0 AND epoch_observed_native_amount >= 0),
  CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX base_intake_v2_reconciliation_latest_idx ON public.base_intake_v2_reconciliation_events(receipt_id, observed_at DESC, id DESC);

CREATE FUNCTION public.base_intake_v2_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'base_intake_v2_append_only';
END
$$;
CREATE TRIGGER base_intake_v2_receipts_append_only BEFORE UPDATE OR DELETE ON public.base_intake_v2_receipts FOR EACH ROW EXECUTE FUNCTION public.base_intake_v2_append_only();
CREATE TRIGGER base_intake_v2_reconciliation_append_only BEFORE UPDATE OR DELETE ON public.base_intake_v2_reconciliation_events FOR EACH ROW EXECUTE FUNCTION public.base_intake_v2_append_only();

CREATE FUNCTION public.record_base_intake_v2_receipt(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.base_intake_v2_deployments%ROWTYPE;
  a public.base_intake_v2_assets%ROWTYPE;
  f public.base_project_fee_versions%ROWTYPE;
  existing public.base_intake_v2_receipts%ROWTYPE;
  receipt_id bigint;
  environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
BEGIN
  IF environment NOT IN ('local', 'dev', 'test') THEN RAISE EXCEPTION 'base_intake_v2_disabled'; END IF;
  SELECT * INTO d FROM public.base_intake_v2_deployments
  WHERE deployment_environment = environment AND chain_id = (p_command->>'chainId')::bigint
    AND contract_version = 'fundloop-base-intake-v2' AND is_active AND NOT is_paused AND NOT production_value_flow_enabled;
  IF d.id IS NULL OR d.contract_address <> lower(p_command->>'contractAddress')
    OR d.platform_treasury_address <> lower(p_command->>'platformTreasuryAddress')
    OR d.epoch_treasury_address <> lower(p_command->>'epochTreasuryAddress') THEN
    RAISE EXCEPTION 'base_intake_v2_deployment_mismatch';
  END IF;
  SELECT * INTO a FROM public.base_intake_v2_assets WHERE deployment_id = d.id
    AND symbol = p_command->>'tokenSymbol' AND token_address = lower(p_command->>'tokenAddress') AND is_enabled;
  IF a.id IS NULL THEN RAISE EXCEPTION 'base_intake_v2_token_not_allowed'; END IF;
  SELECT * INTO f FROM public.base_project_fee_versions
  WHERE project_id = (p_command->>'projectId')::bigint AND is_current;
  IF f.id IS NULL OR f.fee_bps <> (p_command->>'projectFeeBps')::integer THEN
    RAISE EXCEPTION 'base_intake_v2_fee_snapshot_mismatch';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('base:' || (p_command->>'providerEventId'), 0));
  SELECT * INTO existing FROM public.base_intake_v2_receipts WHERE deployment_id = d.id AND provider_event_id = p_command->>'providerEventId';
  IF FOUND THEN
    IF existing.project_id <> (p_command->>'projectId')::bigint
      OR existing.accounting_period_id <> (p_command->>'accountingPeriodId')::bigint
      OR existing.fee_version_id <> f.id OR existing.tx_hash <> lower(p_command->>'txHash')
      OR existing.log_index <> (p_command->>'logIndex')::integer OR existing.block_number <> (p_command->>'blockNumber')::bigint
      OR existing.block_hash <> lower(p_command->>'blockHash') OR existing.sender_address <> lower(p_command->>'senderAddress')
      OR existing.token_symbol <> p_command->>'tokenSymbol' OR existing.token_address <> lower(p_command->>'tokenAddress')
      OR existing.gross_native_amount <> (p_command->>'grossNativeAmount')::numeric
      OR existing.project_fee_bps <> (p_command->>'projectFeeBps')::integer
      OR existing.platform_fee_native_amount <> (p_command->>'platformFeeNativeAmount')::numeric
      OR existing.net_epoch_native_amount <> (p_command->>'netEpochNativeAmount')::numeric
      OR existing.platform_treasury_address <> lower(p_command->>'platformTreasuryAddress')
      OR existing.epoch_treasury_address <> lower(p_command->>'epochTreasuryAddress')
      OR existing.evidence_hash <> p_command->>'evidenceHash'
      OR existing.observed_at <> (p_command->>'observedAt')::timestamptz
    THEN RAISE EXCEPTION 'base_intake_v2_dedupe_conflict'; END IF;
    RETURN existing.id;
  END IF;
  INSERT INTO public.base_intake_v2_receipts(
    deployment_id, project_id, accounting_period_id, fee_version_id, provider_event_id, tx_hash, log_index,
    block_number, block_hash, sender_address, token_symbol, token_address, gross_native_amount, project_fee_bps,
    platform_fee_native_amount, net_epoch_native_amount, platform_treasury_address, epoch_treasury_address,
    evidence_hash, observed_at
  ) VALUES (
    d.id, (p_command->>'projectId')::bigint, (p_command->>'accountingPeriodId')::bigint, f.id,
    p_command->>'providerEventId', lower(p_command->>'txHash'), (p_command->>'logIndex')::integer,
    (p_command->>'blockNumber')::bigint, lower(p_command->>'blockHash'), lower(p_command->>'senderAddress'),
    p_command->>'tokenSymbol', lower(p_command->>'tokenAddress'), (p_command->>'grossNativeAmount')::numeric,
    (p_command->>'projectFeeBps')::integer, (p_command->>'platformFeeNativeAmount')::numeric,
    (p_command->>'netEpochNativeAmount')::numeric, lower(p_command->>'platformTreasuryAddress'),
    lower(p_command->>'epochTreasuryAddress'), p_command->>'evidenceHash', (p_command->>'observedAt')::timestamptz
  ) RETURNING id INTO receipt_id;
  RETURN receipt_id;
END
$$;

CREATE FUNCTION public.reconcile_base_intake_v2_receipt(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.base_intake_v2_receipts%ROWTYPE;
  d public.base_intake_v2_deployments%ROWTYPE;
  reconciliation_id bigint;
  status text;
  confirmations integer;
  environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
BEGIN
  IF environment NOT IN ('local', 'dev', 'test') THEN RAISE EXCEPTION 'base_intake_v2_disabled'; END IF;
  SELECT * INTO r FROM public.base_intake_v2_receipts WHERE id = (p_command->>'receiptId')::bigint;
  SELECT * INTO d FROM public.base_intake_v2_deployments WHERE id = r.deployment_id AND deployment_environment = environment;
  IF r.id IS NULL OR d.id IS NULL OR NOT d.is_active OR d.is_paused THEN RAISE EXCEPTION 'base_intake_v2_reconciliation_disabled'; END IF;
  confirmations := greatest(0, (p_command->>'currentBlockNumber')::bigint - r.block_number + 1);
  status := CASE
    WHEN lower(p_command->>'observedBlockHash') <> r.block_hash THEN 'reorged'
    WHEN p_command ? 'replacementTxHash' AND lower(p_command->>'replacementTxHash') <> r.tx_hash THEN 'replaced'
    WHEN lower(p_command->>'observedTxHash') <> r.tx_hash THEN 'mismatch'
    WHEN confirmations < d.minimum_confirmation_depth THEN 'confirming'
    WHEN (p_command->>'platformObservedNativeAmount')::numeric = r.platform_fee_native_amount
      AND (p_command->>'epochObservedNativeAmount')::numeric = r.net_epoch_native_amount THEN 'exact'
    ELSE 'mismatch'
  END;
  INSERT INTO public.base_intake_v2_reconciliation_events(
    receipt_id, status, current_block_number, observed_block_hash, observed_tx_hash, replacement_tx_hash,
    confirmation_count, platform_observed_native_amount, epoch_observed_native_amount, evidence_hash, observed_at
  ) VALUES (
    r.id, status, (p_command->>'currentBlockNumber')::bigint, lower(p_command->>'observedBlockHash'),
    lower(p_command->>'observedTxHash'), nullif(lower(p_command->>'replacementTxHash'), ''), confirmations,
    (p_command->>'platformObservedNativeAmount')::numeric, (p_command->>'epochObservedNativeAmount')::numeric,
    p_command->>'evidenceHash', (p_command->>'observedAt')::timestamptz
  ) RETURNING id INTO reconciliation_id;
  RETURN reconciliation_id;
END
$$;

CREATE VIEW public.base_intake_v2_receipt_observability WITH (security_invoker = true) AS
SELECT r.*, latest.status AS reconciliation_status, latest.confirmation_count, latest.replacement_tx_hash,
  latest.platform_observed_native_amount, latest.epoch_observed_native_amount, latest.observed_at AS reconciled_observed_at
FROM public.base_intake_v2_receipts r
LEFT JOIN LATERAL (
  SELECT e.status, e.confirmation_count, e.replacement_tx_hash, e.platform_observed_native_amount,
    e.epoch_observed_native_amount, e.observed_at
  FROM public.base_intake_v2_reconciliation_events e WHERE e.receipt_id = r.id ORDER BY e.observed_at DESC, e.id DESC LIMIT 1
) latest ON true;

INSERT INTO public.base_intake_v2_deployments(
  deployment_environment, chain_id, contract_address, platform_treasury_address, epoch_treasury_address,
  minimum_confirmation_depth, is_paused, is_active
) VALUES ('local', 31337, '0x0000000000000000000000000000000000000132',
  '0x0000000000000000000000000000000000000201', '0x0000000000000000000000000000000000000202', 2, true, false);
INSERT INTO public.base_intake_v2_assets(deployment_id, symbol, token_address, is_enabled, address_evidence)
SELECT d.id, v.symbol, v.token_address, false, jsonb_build_object('source', 'local-hardhat-fixture', 'productionApproved', false)
FROM public.base_intake_v2_deployments d
CROSS JOIN (VALUES
  ('USDC', '0x0000000000000000000000000000000000000301'),
  ('USDT', '0x0000000000000000000000000000000000000302'),
  ('PYUSD', '0x0000000000000000000000000000000000000303')
) v(symbol, token_address)
WHERE d.deployment_environment = 'local' AND d.chain_id = 31337;

ALTER TABLE public.base_intake_v2_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_intake_v2_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_project_fee_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_intake_v2_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_intake_v2_reconciliation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_intake_v2_deployments, public.base_intake_v2_assets, public.base_project_fee_versions,
  public.base_intake_v2_receipts, public.base_intake_v2_reconciliation_events, public.base_intake_v2_receipt_observability
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.base_intake_v2_deployments, public.base_intake_v2_assets,
  public.base_project_fee_versions, public.base_intake_v2_receipts, public.base_intake_v2_reconciliation_events FROM service_role;
GRANT SELECT ON TABLE public.base_intake_v2_deployments, public.base_intake_v2_assets, public.base_project_fee_versions,
  public.base_intake_v2_receipts, public.base_intake_v2_reconciliation_events, public.base_intake_v2_receipt_observability TO service_role;
REVOKE ALL ON FUNCTION public.record_base_intake_v2_receipt(jsonb), public.reconcile_base_intake_v2_receipt(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_base_intake_v2_receipt(jsonb), public.reconcile_base_intake_v2_receipt(jsonb) TO service_role;
