ALTER TABLE public.onchain_payment_submissions
  ADD COLUMN period_id integer,
  ADD COLUMN chain_network_key text,
  ADD COLUMN intake_contract_address text,
  ADD COLUMN intake_treasury_address text,
  ADD COLUMN intake_abi_version text,
  ADD COLUMN asset_token_address text,
  ADD COLUMN asset_is_native boolean,
  ADD COLUMN last_checked_at timestamp with time zone,
  ADD COLUMN reconciled_at timestamp with time zone,
  ADD COLUMN confirmation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN failure_code text,
  ADD COLUMN failure_reason text,
  ADD COLUMN matched_log_index integer;

UPDATE public.onchain_payment_submissions submissions
SET
  period_id = COALESCE(
    CASE
      WHEN jsonb_typeof(submissions.metadata -> 'period_id') = 'number' THEN (submissions.metadata ->> 'period_id')::integer
      WHEN jsonb_typeof(submissions.metadata -> 'period_id') = 'string'
        AND (submissions.metadata ->> 'period_id') ~ '^[0-9]+$'
      THEN (submissions.metadata ->> 'period_id')::integer
      ELSE NULL
    END,
    0
  ),
  chain_network_key = chains.network_key,
  intake_contract_address = intake.contract_address,
  intake_treasury_address = intake.treasury_address,
  intake_abi_version = intake.abi_version,
  asset_token_address = assets.token_address,
  asset_is_native = assets.is_native,
  last_checked_at = COALESCE(submissions.last_checked_at, submissions.confirmed_at),
  reconciled_at = COALESCE(submissions.reconciled_at, submissions.confirmed_at),
  status = CASE
    WHEN submissions.status IN ('submitted', 'confirming', 'confirmed', 'failed') THEN submissions.status
    WHEN submissions.confirmed_at IS NOT NULL THEN 'confirmed'
    ELSE 'submitted'
  END
FROM public.ref_chains chains
, public.chain_intake_contracts intake,
public.ref_chain_assets assets
WHERE chains.id = submissions.chain_id
  AND intake.id = submissions.intake_contract_id
  AND assets.id = submissions.chain_asset_id;

ALTER TABLE public.onchain_payment_submissions
  ALTER COLUMN period_id SET NOT NULL,
  ALTER COLUMN chain_network_key SET NOT NULL,
  ALTER COLUMN intake_contract_address SET NOT NULL,
  ALTER COLUMN intake_treasury_address SET NOT NULL,
  ALTER COLUMN intake_abi_version SET NOT NULL,
  ALTER COLUMN asset_is_native SET NOT NULL;

ALTER TABLE public.onchain_payment_submissions
  ADD CONSTRAINT onchain_payment_submissions_period_id_check
    CHECK (period_id >= 0 AND period_id <= 12),
  ADD CONSTRAINT onchain_payment_submissions_status_check
    CHECK (status IN ('submitted', 'confirming', 'confirmed', 'failed'));

CREATE INDEX idx_onchain_payment_submissions_unresolved
ON public.onchain_payment_submissions (status, submitted_at ASC)
WHERE status IN ('submitted', 'confirming');

CREATE UNIQUE INDEX idx_onchain_payment_submissions_single_unresolved_payment
ON public.onchain_payment_submissions (payment_id)
WHERE payment_id IS NOT NULL AND status IN ('submitted', 'confirming');
