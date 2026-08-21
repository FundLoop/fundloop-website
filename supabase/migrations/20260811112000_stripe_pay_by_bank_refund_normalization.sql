CREATE TABLE public.stripe_pay_by_bank_refund_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evidence_id bigint NOT NULL UNIQUE REFERENCES public.stripe_pay_by_bank_evidence(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  command_id uuid NOT NULL REFERENCES public.stripe_pay_by_bank_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_refund_id text NOT NULL,
  current_refund_amount_minor numeric(78,0) NOT NULL CHECK(current_refund_amount_minor>0),
  cumulative_successful_refund_amount_minor numeric(78,0) NOT NULL CHECK(cumulative_successful_refund_amount_minor>=0),
  evidence_type text NOT NULL CHECK(evidence_type IN('refund_pending','refunded','refund_failed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  production_enabled boolean NOT NULL DEFAULT false CHECK(production_enabled=false),
  UNIQUE(command_id,provider_refund_id,evidence_type)
);
CREATE INDEX stripe_pay_by_bank_refund_observations_command_idx
  ON public.stripe_pay_by_bank_refund_observations(command_id,created_at DESC,id DESC);
CREATE TRIGGER stripe_pay_by_bank_refund_observations_append_only
  BEFORE UPDATE OR DELETE ON public.stripe_pay_by_bank_refund_observations
  FOR EACH ROW EXECUTE FUNCTION public.reject_stripe_pay_by_bank_mutation();

ALTER FUNCTION public.ingest_stripe_pay_by_bank_webhook(jsonb)
  RENAME TO ingest_stripe_pay_by_bank_webhook_without_refund_normalization;

CREATE FUNCTION public.ingest_stripe_pay_by_bank_webhook(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_evidence_id bigint;v_current numeric;v_cumulative numeric;v_gross numeric;v_normalized jsonb;
BEGIN
  IF p_command->>'evidenceType' IN('refund_pending','refunded','refund_failed') THEN
    v_current:=nullif(p_command->>'refundAmountMinor','')::numeric;
    v_cumulative:=nullif(p_command->>'cumulativeRefundedAmountMinor','')::numeric;
    v_gross:=nullif(p_command->>'grossAmountMinor','')::numeric;
    IF nullif(p_command->>'providerRefundId','') IS NULL OR v_current IS NULL OR v_current<=0 OR v_current>v_gross
      OR v_cumulative IS NULL OR v_cumulative<0 OR v_cumulative>v_gross THEN
      RAISE EXCEPTION 'stripe_pay_by_bank_refund_normalization_missing';
    END IF;
    IF p_command->>'evidenceType'='refunded' AND v_cumulative<=0 THEN
      RAISE EXCEPTION 'stripe_pay_by_bank_cumulative_refund_missing';
    END IF;
    v_normalized:=jsonb_set(p_command,'{refundAmountMinor}',to_jsonb(CASE WHEN p_command->>'evidenceType'='refunded' THEN v_cumulative ELSE v_current END));
  ELSE
    v_normalized:=p_command;
  END IF;
  v_evidence_id:=public.ingest_stripe_pay_by_bank_webhook_without_refund_normalization(v_normalized);
  IF p_command->>'evidenceType' IN('refund_pending','refunded','refund_failed') THEN
    INSERT INTO public.stripe_pay_by_bank_refund_observations(evidence_id,command_id,provider_refund_id,current_refund_amount_minor,
      cumulative_successful_refund_amount_minor,evidence_type)
    VALUES(v_evidence_id,(p_command->>'commandId')::uuid,p_command->>'providerRefundId',v_current,v_cumulative,p_command->>'evidenceType')
    ON CONFLICT(evidence_id) DO NOTHING;
  END IF;
  RETURN v_evidence_id;
END $$;

ALTER TABLE public.stripe_pay_by_bank_refund_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_pay_by_bank_refund_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.stripe_pay_by_bank_refund_observations TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.stripe_pay_by_bank_refund_observations FROM service_role;
REVOKE ALL ON FUNCTION public.ingest_stripe_pay_by_bank_webhook_without_refund_normalization(jsonb),
  public.ingest_stripe_pay_by_bank_webhook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_stripe_pay_by_bank_webhook(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ingest_stripe_pay_by_bank_webhook_without_refund_normalization(jsonb) FROM service_role;
