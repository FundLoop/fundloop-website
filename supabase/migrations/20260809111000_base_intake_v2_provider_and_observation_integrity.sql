ALTER TABLE public.base_intake_v2_assets
  ADD COLUMN provider_evidence_status text NOT NULL DEFAULT 'unverified'
    CHECK (provider_evidence_status IN ('unverified', 'local_fixture_only', 'reviewed_issuer'));
UPDATE public.base_intake_v2_assets SET provider_evidence_status = 'local_fixture_only'
WHERE address_evidence->>'source' = 'local-hardhat-fixture';

CREATE FUNCTION public.enforce_base_intake_v2_asset_activation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d public.base_intake_v2_deployments%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.base_intake_v2_deployments WHERE id=NEW.deployment_id;
  IF NEW.is_enabled AND NOT (
    (d.deployment_environment='local' AND NEW.provider_evidence_status='local_fixture_only')
    OR (d.deployment_environment IN ('dev','test') AND d.chain_id=84532 AND NEW.symbol='USDC'
      AND NEW.token_address='0x036cbd53842c5426634e7929541ec2318f3dcf7e'
      AND NEW.provider_evidence_status='reviewed_issuer')
  ) THEN RAISE EXCEPTION 'base_intake_v2_provider_evidence_required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER base_intake_v2_asset_activation BEFORE INSERT OR UPDATE ON public.base_intake_v2_assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_base_intake_v2_asset_activation();

CREATE FUNCTION public.enforce_base_intake_v2_deployment_activation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.is_active AND (NEW.is_paused OR NOT EXISTS(
    SELECT 1 FROM public.base_intake_v2_assets a WHERE a.deployment_id=NEW.id AND a.is_enabled
  )) THEN RAISE EXCEPTION 'base_intake_v2_activation_evidence_missing'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER base_intake_v2_deployment_activation AFTER INSERT OR UPDATE ON public.base_intake_v2_deployments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_base_intake_v2_deployment_activation();

ALTER TABLE public.base_intake_v2_reconciliation_events
  ADD COLUMN observation_source text NOT NULL DEFAULT 'trusted_viem_v1'
  CHECK (observation_source='trusted_viem_v1'),
  ADD COLUMN receipt_event_matched boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.reconcile_base_intake_v2_receipt(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.base_intake_v2_receipts%ROWTYPE; d public.base_intake_v2_deployments%ROWTYPE;
  reconciliation_id bigint; status text; confirmations integer;
  environment text := lower(coalesce(p_command->>'deploymentEnvironment', ''));
BEGIN
  IF environment NOT IN ('local','dev','test') THEN RAISE EXCEPTION 'base_intake_v2_disabled'; END IF;
  IF p_command->>'observationSource' <> 'trusted_viem_v1' THEN RAISE EXCEPTION 'base_intake_v2_trusted_observation_required'; END IF;
  SELECT * INTO r FROM public.base_intake_v2_receipts WHERE id=(p_command->>'receiptId')::bigint;
  SELECT * INTO d FROM public.base_intake_v2_deployments WHERE id=r.deployment_id AND deployment_environment=environment;
  IF r.id IS NULL OR d.id IS NULL OR NOT d.is_active OR d.is_paused THEN RAISE EXCEPTION 'base_intake_v2_reconciliation_disabled'; END IF;
  confirmations:=greatest(0,(p_command->>'currentBlockNumber')::bigint-r.block_number+1);
  status:=CASE WHEN lower(p_command->>'observedBlockHash')<>r.block_hash THEN'reorged'
    WHEN p_command?'replacementTxHash' AND lower(p_command->>'replacementTxHash')<>r.tx_hash THEN'replaced'
    WHEN lower(p_command->>'observedTxHash')<>r.tx_hash THEN'mismatch'
    WHEN coalesce((p_command->>'receiptEventMatched')::boolean,false)=false THEN'mismatch'
    WHEN confirmations<d.minimum_confirmation_depth THEN'confirming'
    WHEN (p_command->>'platformObservedNativeAmount')::numeric=r.platform_fee_native_amount
      AND (p_command->>'epochObservedNativeAmount')::numeric=r.net_epoch_native_amount THEN'exact' ELSE'mismatch' END;
  INSERT INTO public.base_intake_v2_reconciliation_events(receipt_id,status,current_block_number,observed_block_hash,
    observed_tx_hash,replacement_tx_hash,confirmation_count,platform_observed_native_amount,epoch_observed_native_amount,
    evidence_hash,observed_at,observation_source,receipt_event_matched)
  VALUES(r.id,status,(p_command->>'currentBlockNumber')::bigint,lower(p_command->>'observedBlockHash'),
    lower(p_command->>'observedTxHash'),nullif(lower(p_command->>'replacementTxHash'),''),confirmations,
    (p_command->>'platformObservedNativeAmount')::numeric,(p_command->>'epochObservedNativeAmount')::numeric,
    p_command->>'evidenceHash',(p_command->>'observedAt')::timestamptz,'trusted_viem_v1',
    coalesce((p_command->>'receiptEventMatched')::boolean,false)) RETURNING id INTO reconciliation_id;
  RETURN reconciliation_id;
END $$;
