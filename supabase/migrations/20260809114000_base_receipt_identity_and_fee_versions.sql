CREATE FUNCTION public.lock_base_intake_v2_enabled_deployment_coordinates() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.base_intake_v2_assets a
    WHERE a.deployment_id = OLD.id AND a.is_enabled
  ) AND (
    NEW.deployment_environment IS DISTINCT FROM OLD.deployment_environment
    OR NEW.chain_id IS DISTINCT FROM OLD.chain_id
    OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
    OR NEW.contract_address IS DISTINCT FROM OLD.contract_address
    OR NEW.platform_treasury_address IS DISTINCT FROM OLD.platform_treasury_address
    OR NEW.epoch_treasury_address IS DISTINCT FROM OLD.epoch_treasury_address
  ) THEN
    RAISE EXCEPTION 'base_intake_v2_enabled_asset_coordinates_locked';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER base_intake_v2_enabled_deployment_coordinates
BEFORE UPDATE OF deployment_environment, chain_id, contract_version, contract_address,
  platform_treasury_address, epoch_treasury_address
ON public.base_intake_v2_deployments
FOR EACH ROW EXECUTE FUNCTION public.lock_base_intake_v2_enabled_deployment_coordinates();

ALTER TABLE public.base_intake_v2_receipts
  ADD COLUMN receipt_reference text,
  ADD COLUMN project_fee_version integer,
  ADD CONSTRAINT base_intake_v2_receipts_reference_check
    CHECK (receipt_reference IS NULL OR receipt_reference ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT base_intake_v2_receipts_fee_version_check
    CHECK (project_fee_version IS NULL OR project_fee_version > 0);

CREATE UNIQUE INDEX base_intake_v2_receipts_reference_idx
  ON public.base_intake_v2_receipts(deployment_id, receipt_reference)
  WHERE receipt_reference IS NOT NULL;

ALTER TABLE public.base_intake_v2_reconciliation_events
  ADD COLUMN observed_receipt_block_number bigint,
  ADD COLUMN observed_log_index integer,
  ADD COLUMN observed_receipt_reference text,
  ADD CONSTRAINT base_intake_v2_reconciliation_block_check
    CHECK (observed_receipt_block_number IS NULL OR observed_receipt_block_number > 0),
  ADD CONSTRAINT base_intake_v2_reconciliation_log_check
    CHECK (observed_log_index IS NULL OR observed_log_index >= 0),
  ADD CONSTRAINT base_intake_v2_reconciliation_reference_check
    CHECK (observed_receipt_reference IS NULL OR observed_receipt_reference ~ '^0x[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION public.record_base_intake_v2_receipt(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.base_intake_v2_deployments%ROWTYPE;
  a public.base_intake_v2_assets%ROWTYPE;
  f public.base_project_fee_versions%ROWTYPE;
  existing public.base_intake_v2_receipts%ROWTYPE;
  receipt_id bigint;
  environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
  receipt_reference text := lower(p_command->>'receiptReference');
  fee_version integer := (p_command->>'projectFeeVersion')::integer;
BEGIN
  IF environment NOT IN ('local', 'dev', 'test') THEN RAISE EXCEPTION 'base_intake_v2_disabled'; END IF;
  IF receipt_reference IS NULL OR receipt_reference !~ '^0x[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'base_intake_v2_receipt_reference_required';
  END IF;
  IF fee_version IS NULL OR fee_version <= 0 THEN RAISE EXCEPTION 'base_intake_v2_fee_version_required'; END IF;
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
  WHERE project_id = (p_command->>'projectId')::bigint AND version = fee_version
    AND fee_bps = (p_command->>'projectFeeBps')::integer;
  IF f.id IS NULL THEN RAISE EXCEPTION 'base_intake_v2_fee_snapshot_mismatch'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('base:' || (p_command->>'providerEventId'), 0));
  SELECT * INTO existing FROM public.base_intake_v2_receipts WHERE deployment_id = d.id AND provider_event_id = p_command->>'providerEventId';
  IF FOUND THEN
    IF existing.project_id <> (p_command->>'projectId')::bigint
      OR existing.accounting_period_id <> (p_command->>'accountingPeriodId')::bigint
      OR existing.fee_version_id <> f.id OR existing.project_fee_version IS DISTINCT FROM fee_version
      OR existing.receipt_reference IS DISTINCT FROM receipt_reference
      OR existing.tx_hash <> lower(p_command->>'txHash') OR existing.log_index <> (p_command->>'logIndex')::integer
      OR existing.block_number <> (p_command->>'blockNumber')::bigint
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
    evidence_hash, observed_at, receipt_reference, project_fee_version
  ) VALUES (
    d.id, (p_command->>'projectId')::bigint, (p_command->>'accountingPeriodId')::bigint, f.id,
    p_command->>'providerEventId', lower(p_command->>'txHash'), (p_command->>'logIndex')::integer,
    (p_command->>'blockNumber')::bigint, lower(p_command->>'blockHash'), lower(p_command->>'senderAddress'),
    p_command->>'tokenSymbol', lower(p_command->>'tokenAddress'), (p_command->>'grossNativeAmount')::numeric,
    (p_command->>'projectFeeBps')::integer, (p_command->>'platformFeeNativeAmount')::numeric,
    (p_command->>'netEpochNativeAmount')::numeric, lower(p_command->>'platformTreasuryAddress'),
    lower(p_command->>'epochTreasuryAddress'), p_command->>'evidenceHash', (p_command->>'observedAt')::timestamptz,
    receipt_reference, fee_version
  ) RETURNING id INTO receipt_id;
  RETURN receipt_id;
END
$$;

CREATE OR REPLACE FUNCTION public.reconcile_base_intake_v2_receipt_trusted_internal(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.base_intake_v2_receipts%ROWTYPE;
  d public.base_intake_v2_deployments%ROWTYPE;
  reconciliation_id bigint;
  status text;
  confirmations integer;
  environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
  observed_receipt_block bigint := (p_command->>'observedReceiptBlockNumber')::bigint;
  observed_log integer := (p_command->>'observedLogIndex')::integer;
  observed_reference text := lower(p_command->>'observedReceiptReference');
BEGIN
  IF environment NOT IN ('local', 'dev', 'test') THEN RAISE EXCEPTION 'base_intake_v2_disabled'; END IF;
  IF p_command->>'observationSource' IS DISTINCT FROM 'trusted_viem_v1' THEN RAISE EXCEPTION 'base_intake_v2_trusted_observation_required'; END IF;
  SELECT * INTO r FROM public.base_intake_v2_receipts WHERE id = (p_command->>'receiptId')::bigint;
  SELECT * INTO d FROM public.base_intake_v2_deployments WHERE id = r.deployment_id AND deployment_environment = environment;
  IF r.id IS NULL OR d.id IS NULL OR NOT d.is_active OR d.is_paused THEN RAISE EXCEPTION 'base_intake_v2_reconciliation_disabled'; END IF;
  IF observed_receipt_block IS NULL THEN RAISE EXCEPTION 'base_intake_v2_observed_block_required'; END IF;
  confirmations := greatest(0, (p_command->>'currentBlockNumber')::bigint - observed_receipt_block + 1);
  status := CASE
    WHEN lower(p_command->>'observedBlockHash') <> r.block_hash THEN 'reorged'
    WHEN p_command ? 'replacementTxHash' AND lower(p_command->>'replacementTxHash') <> r.tx_hash THEN 'replaced'
    WHEN lower(p_command->>'observedTxHash') <> r.tx_hash THEN 'mismatch'
    WHEN observed_receipt_block IS DISTINCT FROM r.block_number THEN 'mismatch'
    WHEN coalesce((p_command->>'receiptEventMatched')::boolean, false) = false THEN 'mismatch'
    WHEN observed_log IS DISTINCT FROM r.log_index OR observed_reference IS DISTINCT FROM r.receipt_reference THEN 'mismatch'
    WHEN confirmations < d.minimum_confirmation_depth THEN 'confirming'
    WHEN (p_command->>'platformObservedNativeAmount')::numeric = r.platform_fee_native_amount
      AND (p_command->>'epochObservedNativeAmount')::numeric = r.net_epoch_native_amount THEN 'exact'
    ELSE 'mismatch'
  END;
  INSERT INTO public.base_intake_v2_reconciliation_events(
    receipt_id, status, current_block_number, observed_block_hash, observed_tx_hash, replacement_tx_hash,
    confirmation_count, platform_observed_native_amount, epoch_observed_native_amount, evidence_hash, observed_at,
    observation_source, receipt_event_matched, observed_receipt_block_number, observed_log_index, observed_receipt_reference
  ) VALUES (
    r.id, status, (p_command->>'currentBlockNumber')::bigint, lower(p_command->>'observedBlockHash'),
    lower(p_command->>'observedTxHash'), nullif(lower(p_command->>'replacementTxHash'), ''), confirmations,
    (p_command->>'platformObservedNativeAmount')::numeric, (p_command->>'epochObservedNativeAmount')::numeric,
    p_command->>'evidenceHash', (p_command->>'observedAt')::timestamptz, 'trusted_viem_v1',
    coalesce((p_command->>'receiptEventMatched')::boolean, false), observed_receipt_block, observed_log, observed_reference
  ) RETURNING id INTO reconciliation_id;
  RETURN reconciliation_id;
END
$$;

DROP VIEW public.base_intake_v2_receipt_observability;
CREATE VIEW public.base_intake_v2_receipt_observability WITH (security_invoker = true) AS
SELECT r.*, latest.status AS reconciliation_status, latest.confirmation_count, latest.replacement_tx_hash,
  latest.platform_observed_native_amount, latest.epoch_observed_native_amount,
  latest.observed_receipt_block_number, latest.observed_log_index, latest.observed_receipt_reference,
  latest.observed_at AS reconciled_observed_at
FROM public.base_intake_v2_receipts r
LEFT JOIN LATERAL (
  SELECT e.status, e.confirmation_count, e.replacement_tx_hash, e.platform_observed_native_amount,
    e.epoch_observed_native_amount, e.observed_receipt_block_number, e.observed_log_index,
    e.observed_receipt_reference, e.observed_at
  FROM public.base_intake_v2_reconciliation_events e
  WHERE e.receipt_id = r.id ORDER BY e.observed_at DESC, e.id DESC LIMIT 1
) latest ON true;

REVOKE ALL ON TABLE public.base_intake_v2_receipt_observability FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.base_intake_v2_receipt_observability TO service_role;
