ALTER TABLE public.stripe_pay_by_bank_refund_observations
  ADD COLUMN provider_event_id text,
  ADD COLUMN provider_created_at timestamptz,
  ADD COLUMN payload_sha256 text,
  ADD COLUMN command_sha256 text;

UPDATE public.stripe_pay_by_bank_refund_observations o
SET provider_event_id=w.provider_event_id,
    provider_created_at=w.provider_created_at,
    payload_sha256=w.payload_sha256,
    command_sha256=w.command_sha256
FROM public.stripe_pay_by_bank_evidence e
JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
WHERE e.id=o.evidence_id;

ALTER TABLE public.stripe_pay_by_bank_refund_observations
  ALTER COLUMN provider_event_id SET NOT NULL,
  ALTER COLUMN provider_created_at SET NOT NULL,
  ALTER COLUMN payload_sha256 SET NOT NULL,
  ALTER COLUMN command_sha256 SET NOT NULL,
  ADD CONSTRAINT stripe_pay_by_bank_refund_observations_provider_event_key UNIQUE(provider_event_id),
  ADD CONSTRAINT stripe_pay_by_bank_refund_observations_payload_hash_check CHECK(payload_sha256~'^[0-9a-f]{64}$'),
  ADD CONSTRAINT stripe_pay_by_bank_refund_observations_command_hash_check CHECK(command_sha256~'^[0-9a-f]{64}$');

DO $$
DECLARE v_constraint name;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid='public.stripe_pay_by_bank_refund_observations'::regclass
      AND c.contype='u'
      AND pg_catalog.pg_get_constraintdef(c.oid) IN(
        'UNIQUE (evidence_id)',
        'UNIQUE (command_id, provider_refund_id, evidence_type)'
      )
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.stripe_pay_by_bank_refund_observations DROP CONSTRAINT %I',v_constraint);
  END LOOP;
END $$;

CREATE INDEX stripe_pay_by_bank_refund_observations_cumulative_idx
  ON public.stripe_pay_by_bank_refund_observations(command_id,cumulative_successful_refund_amount_minor DESC,id DESC)
  WHERE evidence_type='refunded';

CREATE OR REPLACE FUNCTION public.ingest_stripe_pay_by_bank_webhook(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_evidence_id bigint;v_current numeric;v_cumulative numeric;v_gross numeric;v_max_cumulative numeric;
  v_normalized jsonb;v_command_hash text;v_existing public.stripe_pay_by_bank_refund_observations%ROWTYPE;
BEGIN
  IF p_command->>'evidenceType' IN('refund_pending','refunded','refund_failed') THEN
    v_current:=nullif(p_command->>'refundAmountMinor','')::numeric;
    v_cumulative:=nullif(p_command->>'cumulativeRefundedAmountMinor','')::numeric;
    v_gross:=nullif(p_command->>'grossAmountMinor','')::numeric;
    IF nullif(p_command->>'providerRefundId','') IS NULL OR nullif(p_command->>'providerEventId','') IS NULL
      OR v_current IS NULL OR v_current<=0 OR v_current>v_gross
      OR v_cumulative IS NULL OR v_cumulative<0 OR v_cumulative>v_gross THEN
      RAISE EXCEPTION 'stripe_pay_by_bank_refund_normalization_missing';
    END IF;
    IF p_command->>'evidenceType'='refunded' AND (v_cumulative<=0 OR v_cumulative<v_current) THEN
      RAISE EXCEPTION 'stripe_pay_by_bank_cumulative_refund_missing';
    END IF;
    v_command_hash:=encode(extensions.digest(convert_to((p_command-ARRAY['signatureTimestamp']::text[])::text,'UTF8'),'sha256'),'hex');
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stripe-pay-by-bank-refund:'||(p_command->>'commandId'),0));
    SELECT * INTO v_existing FROM public.stripe_pay_by_bank_refund_observations WHERE provider_event_id=p_command->>'providerEventId';
    IF FOUND THEN
      IF v_existing.command_sha256<>v_command_hash THEN RAISE EXCEPTION 'stripe_pay_by_bank_webhook_dedupe_conflict';END IF;
      RETURN v_existing.evidence_id;
    END IF;
    IF p_command->>'evidenceType'='refunded' THEN
      SELECT max(cumulative_successful_refund_amount_minor) INTO v_max_cumulative
      FROM public.stripe_pay_by_bank_refund_observations
      WHERE command_id=(p_command->>'commandId')::uuid AND evidence_type='refunded';
      IF v_max_cumulative IS NOT NULL AND v_cumulative<=v_max_cumulative THEN
        SELECT evidence_id INTO v_evidence_id
        FROM public.stripe_pay_by_bank_refund_observations
        WHERE command_id=(p_command->>'commandId')::uuid AND evidence_type='refunded'
          AND cumulative_successful_refund_amount_minor=v_max_cumulative
        ORDER BY id DESC LIMIT 1;
        INSERT INTO public.stripe_pay_by_bank_refund_observations(evidence_id,command_id,provider_refund_id,current_refund_amount_minor,
          cumulative_successful_refund_amount_minor,evidence_type,provider_event_id,provider_created_at,payload_sha256,command_sha256)
        VALUES(v_evidence_id,(p_command->>'commandId')::uuid,p_command->>'providerRefundId',v_current,v_cumulative,p_command->>'evidenceType',
          p_command->>'providerEventId',(p_command->>'providerCreatedAt')::timestamptz,p_command->>'payloadSha256',v_command_hash);
        RETURN v_evidence_id;
      END IF;
    END IF;
    v_normalized:=jsonb_set(p_command,'{refundAmountMinor}',to_jsonb(CASE WHEN p_command->>'evidenceType'='refunded' THEN v_cumulative ELSE v_current END));
  ELSE
    v_normalized:=p_command;
  END IF;
  v_evidence_id:=public.ingest_stripe_pay_by_bank_webhook_without_refund_normalization(v_normalized);
  IF p_command->>'evidenceType' IN('refund_pending','refunded','refund_failed') THEN
    INSERT INTO public.stripe_pay_by_bank_refund_observations(evidence_id,command_id,provider_refund_id,current_refund_amount_minor,
      cumulative_successful_refund_amount_minor,evidence_type,provider_event_id,provider_created_at,payload_sha256,command_sha256)
    VALUES(v_evidence_id,(p_command->>'commandId')::uuid,p_command->>'providerRefundId',v_current,v_cumulative,p_command->>'evidenceType',
      p_command->>'providerEventId',(p_command->>'providerCreatedAt')::timestamptz,p_command->>'payloadSha256',v_command_hash)
    ON CONFLICT(provider_event_id) DO NOTHING;
  END IF;
  RETURN v_evidence_id;
END $$;

REVOKE ALL ON FUNCTION public.ingest_stripe_pay_by_bank_webhook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_stripe_pay_by_bank_webhook(jsonb) TO service_role;
