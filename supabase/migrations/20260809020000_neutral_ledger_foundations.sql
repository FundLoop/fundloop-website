CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.financial_runtime_controls (
  deployment_environment text PRIMARY KEY,
  neutral_posting_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  professional_approval_reference text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_runtime_controls_environment_check CHECK (deployment_environment ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_runtime_controls_production_fail_closed_check CHECK (
    deployment_environment <> 'production'
    OR (neutral_posting_enabled = false AND production_value_flow_enabled = false AND professional_approval_reference IS NULL)
  ),
  CONSTRAINT financial_runtime_controls_value_flow_disabled_check CHECK (production_value_flow_enabled = false)
);

INSERT INTO public.financial_runtime_controls (deployment_environment, neutral_posting_enabled)
VALUES ('local', true), ('development', true), ('dev', true), ('preview', true), ('test', true), ('production', false)
ON CONFLICT (deployment_environment) DO NOTHING;

CREATE TABLE public.financial_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_key text NOT NULL UNIQUE,
  rail_key text NOT NULL,
  symbol text NOT NULL,
  atomic_scale smallint NOT NULL,
  classification_status text NOT NULL DEFAULT 'provisional',
  classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_assets_asset_key_check CHECK (asset_key ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_assets_rail_key_check CHECK (rail_key ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_assets_symbol_check CHECK (symbol ~ '^[A-Z][A-Z0-9]{1,11}$'),
  CONSTRAINT financial_assets_atomic_scale_check CHECK (atomic_scale BETWEEN 0 AND 78),
  CONSTRAINT financial_assets_classification_status_check CHECK (classification_status = 'provisional'),
  CONSTRAINT financial_assets_classification_metadata_check CHECK (jsonb_typeof(classification_metadata) = 'object'),
  CONSTRAINT financial_assets_production_disabled_check CHECK (production_enabled = false)
);

CREATE TABLE public.financial_custody_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  custody_key text NOT NULL UNIQUE,
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_key text NOT NULL,
  external_reference_hash text NOT NULL,
  classification_status text NOT NULL DEFAULT 'provisional',
  classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_custody_accounts_custody_key_check CHECK (custody_key ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_custody_accounts_provider_key_check CHECK (provider_key ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_custody_accounts_reference_hash_check CHECK (external_reference_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT financial_custody_accounts_classification_status_check CHECK (classification_status = 'provisional'),
  CONSTRAINT financial_custody_accounts_classification_metadata_check CHECK (jsonb_typeof(classification_metadata) = 'object'),
  CONSTRAINT financial_custody_accounts_production_disabled_check CHECK (production_enabled = false),
  CONSTRAINT financial_custody_accounts_asset_key_unique UNIQUE (asset_id, custody_key)
);
CREATE INDEX financial_custody_accounts_asset_idx ON public.financial_custody_accounts (asset_id);

CREATE TABLE public.financial_references (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference_key text NOT NULL UNIQUE,
  reference_type text NOT NULL,
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_limit numeric(78, 0) NOT NULL,
  evidence_hash text NOT NULL,
  classification_status text NOT NULL DEFAULT 'provisional',
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_references_key_check CHECK (reference_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT financial_references_type_check CHECK (reference_type ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT financial_references_limit_check CHECK (native_atomic_limit > 0),
  CONSTRAINT financial_references_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT financial_references_classification_status_check CHECK (classification_status = 'provisional'),
  CONSTRAINT financial_references_production_disabled_check CHECK (production_enabled = false)
);
CREATE INDEX financial_references_asset_idx ON public.financial_references (asset_id);
CREATE INDEX financial_references_custody_idx ON public.financial_references (custody_account_id);

CREATE TABLE public.ledger_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_key text NOT NULL UNIQUE,
  normal_balance text NOT NULL,
  provisional_classification_key text NOT NULL,
  required_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_posting_enabled boolean NOT NULL DEFAULT true,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_accounts_key_check CHECK (account_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT ledger_accounts_normal_balance_check CHECK (normal_balance IN ('debit', 'credit')),
  CONSTRAINT ledger_accounts_classification_key_check CHECK (provisional_classification_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT ledger_accounts_required_dimensions_check CHECK (jsonb_typeof(required_dimensions) = 'array'),
  CONSTRAINT ledger_accounts_production_disabled_check CHECK (production_enabled = false)
);

CREATE TABLE public.accounting_periods (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_key text NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone_name text NOT NULL DEFAULT 'America/Los_Angeles',
  status text NOT NULL DEFAULT 'open',
  production_enabled boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  close_evidence_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_periods_key_check CHECK (period_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT accounting_periods_range_check CHECK (starts_at < ends_at),
  CONSTRAINT accounting_periods_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT accounting_periods_close_state_check CHECK (
    (status = 'open' AND closed_at IS NULL AND close_evidence_hash IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL AND close_evidence_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT accounting_periods_production_disabled_check CHECK (production_enabled = false)
);
CREATE INDEX accounting_periods_open_starts_idx ON public.accounting_periods (starts_at, ends_at) WHERE status = 'open';

CREATE TABLE public.ledger_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accounting_period_id bigint NOT NULL REFERENCES public.accounting_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  financial_reference_id bigint REFERENCES public.financial_references(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reversal_of_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  contract_version text NOT NULL DEFAULT 'ledger_post.v1',
  transaction_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  command_hash text NOT NULL,
  evidence_hash text NOT NULL,
  actor_type text NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  classification_status text NOT NULL DEFAULT 'provisional',
  effective_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_transactions_contract_check CHECK (contract_version IN ('ledger_post.v1', 'ledger_reversal.v1')),
  CONSTRAINT ledger_transactions_type_check CHECK (transaction_type ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT ledger_transactions_idempotency_check CHECK (idempotency_key ~ '^[a-zA-Z0-9:_-]{8,160}$'),
  CONSTRAINT ledger_transactions_command_hash_check CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ledger_transactions_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ledger_transactions_actor_type_check CHECK (actor_type IN ('operator', 'service', 'system')),
  CONSTRAINT ledger_transactions_classification_status_check CHECK (classification_status = 'provisional'),
  CONSTRAINT ledger_transactions_reversal_contract_check CHECK (
    (reversal_of_transaction_id IS NULL AND contract_version = 'ledger_post.v1')
    OR (reversal_of_transaction_id IS NOT NULL AND contract_version = 'ledger_reversal.v1' AND transaction_type = 'reversal')
  )
);
CREATE INDEX ledger_transactions_period_idx ON public.ledger_transactions (accounting_period_id, effective_at, id);
CREATE INDEX ledger_transactions_financial_reference_idx ON public.ledger_transactions (financial_reference_id) WHERE financial_reference_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_transactions_one_reversal_idx ON public.ledger_transactions (reversal_of_transaction_id) WHERE reversal_of_transaction_id IS NOT NULL;
CREATE INDEX ledger_transactions_actor_idx ON public.ledger_transactions (actor_user_id, recorded_at DESC) WHERE actor_user_id IS NOT NULL;

CREATE TABLE public.ledger_postings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id bigint NOT NULL REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sequence_no integer NOT NULL,
  account_id bigint NOT NULL REFERENCES public.ledger_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  asset_id bigint REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  side text NOT NULL,
  native_atomic_amount numeric(78, 0),
  functional_usd_amount numeric(38, 18) NOT NULL,
  fx_usd_per_unit numeric(38, 18),
  project_id bigint REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_postings_transaction_sequence_unique UNIQUE (transaction_id, sequence_no),
  CONSTRAINT ledger_postings_sequence_check CHECK (sequence_no > 0),
  CONSTRAINT ledger_postings_side_check CHECK (side IN ('debit', 'credit')),
  CONSTRAINT ledger_postings_native_amount_check CHECK (native_atomic_amount IS NULL OR native_atomic_amount > 0),
  CONSTRAINT ledger_postings_functional_amount_check CHECK (functional_usd_amount > 0),
  CONSTRAINT ledger_postings_fx_check CHECK (fx_usd_per_unit IS NULL OR fx_usd_per_unit > 0),
  CONSTRAINT ledger_postings_native_dimensions_check CHECK (
    (native_atomic_amount IS NULL AND asset_id IS NULL AND custody_account_id IS NULL AND fx_usd_per_unit IS NULL)
    OR (native_atomic_amount IS NOT NULL AND asset_id IS NOT NULL AND custody_account_id IS NOT NULL AND fx_usd_per_unit IS NOT NULL)
  )
);
CREATE INDEX ledger_postings_account_idx ON public.ledger_postings (account_id, transaction_id);
CREATE INDEX ledger_postings_asset_custody_idx ON public.ledger_postings (asset_id, custody_account_id, transaction_id) WHERE asset_id IS NOT NULL;
CREATE INDEX ledger_postings_project_idx ON public.ledger_postings (project_id, transaction_id) WHERE project_id IS NOT NULL;
CREATE INDEX ledger_postings_user_idx ON public.ledger_postings (user_id, transaction_id) WHERE user_id IS NOT NULL;

CREATE FUNCTION public.prevent_financial_record_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'financial_records_are_append_only';
END;
$$;

CREATE TRIGGER ledger_transactions_append_only BEFORE UPDATE OR DELETE ON public.ledger_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();
CREATE TRIGGER ledger_postings_append_only BEFORE UPDATE OR DELETE ON public.ledger_postings
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();

CREATE FUNCTION public.post_neutral_ledger_transaction(p_command jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_environment text := lower(trim(p_command->>'deploymentEnvironment'));
  v_idempotency_key text := p_command->>'idempotencyKey';
  v_command_hash text := encode(extensions.digest(convert_to(p_command::text, 'UTF8'), 'sha256'), 'hex');
  v_existing public.ledger_transactions%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_reference public.financial_references%ROWTYPE;
  v_transaction_id bigint;
  v_posting jsonb;
  v_sequence integer := 0;
  v_account public.ledger_accounts%ROWTYPE;
  v_asset public.financial_assets%ROWTYPE;
  v_custody public.financial_custody_accounts%ROWTYPE;
  v_debits numeric(38, 18);
  v_credits numeric(38, 18);
  v_applied numeric(78, 0);
BEGIN
  IF p_command->>'contractVersion' <> 'ledger_post.v1' OR jsonb_typeof(p_command->'postings') <> 'array'
    OR jsonb_array_length(p_command->'postings') < 2 THEN
    RAISE EXCEPTION 'invalid_ledger_post_contract';
  END IF;
  IF v_environment = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.financial_runtime_controls control
    WHERE control.deployment_environment = v_environment AND control.neutral_posting_enabled
      AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'neutral_ledger_runtime_disabled'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledger-post:' || coalesce(v_idempotency_key, ''), 0));
  SELECT * INTO v_existing FROM public.ledger_transactions transaction_row WHERE transaction_row.idempotency_key = v_idempotency_key;
  IF FOUND THEN
    IF v_existing.command_hash <> v_command_hash THEN RAISE EXCEPTION 'ledger_idempotency_conflict'; END IF;
    RETURN v_existing.id;
  END IF;

  SELECT * INTO v_period FROM public.accounting_periods period
  WHERE period.period_key = p_command->>'periodKey' FOR UPDATE;
  IF NOT FOUND OR v_period.status <> 'open' OR v_period.production_enabled THEN RAISE EXCEPTION 'ledger_period_not_open'; END IF;

  IF p_command ? 'financialReferenceKey' THEN
    SELECT * INTO v_reference FROM public.financial_references reference
    WHERE reference.reference_key = p_command->>'financialReferenceKey' FOR UPDATE;
    IF NOT FOUND OR v_reference.production_enabled THEN RAISE EXCEPTION 'financial_reference_unavailable'; END IF;
  END IF;

  PERFORM 1 FROM public.ledger_accounts account
  WHERE account.account_key IN (SELECT value->>'accountKey' FROM jsonb_array_elements(p_command->'postings'))
  ORDER BY account.id FOR UPDATE;

  INSERT INTO public.ledger_transactions (
    accounting_period_id, financial_reference_id, contract_version, transaction_type,
    idempotency_key, command_hash, evidence_hash, actor_type, actor_user_id,
    deployment_environment, effective_at
  ) VALUES (
    v_period.id, v_reference.id, 'ledger_post.v1', p_command->>'transactionType',
    v_idempotency_key, v_command_hash, p_command->>'evidenceHash', p_command->>'actorType',
    nullif(p_command->>'actorUserId', '')::uuid, v_environment, (p_command->>'effectiveAt')::timestamptz
  ) RETURNING id INTO v_transaction_id;

  FOR v_posting IN SELECT value FROM jsonb_array_elements(p_command->'postings') LOOP
    v_sequence := v_sequence + 1;
    SELECT * INTO v_account FROM public.ledger_accounts account WHERE account.account_key = v_posting->>'accountKey';
    IF NOT FOUND OR NOT v_account.review_posting_enabled OR v_account.production_enabled THEN RAISE EXCEPTION 'ledger_account_unavailable'; END IF;
    IF v_account.required_dimensions ? 'project' AND NOT (v_posting ? 'projectId') THEN RAISE EXCEPTION 'ledger_project_dimension_required'; END IF;
    IF v_account.required_dimensions ? 'user' AND NOT (v_posting ? 'userId') THEN RAISE EXCEPTION 'ledger_user_dimension_required'; END IF;

    v_asset := NULL; v_custody := NULL;
    IF v_posting ? 'assetKey' OR v_posting ? 'custodyKey' OR v_posting ? 'nativeAtomicAmount' OR v_posting ? 'fxUsdPerUnit' THEN
      IF NOT (v_posting ? 'assetKey' AND v_posting ? 'custodyKey' AND v_posting ? 'nativeAtomicAmount' AND v_posting ? 'fxUsdPerUnit') THEN
        RAISE EXCEPTION 'ledger_native_dimensions_incomplete';
      END IF;
      SELECT * INTO v_asset FROM public.financial_assets asset WHERE asset.asset_key = v_posting->>'assetKey';
      SELECT * INTO v_custody FROM public.financial_custody_accounts custody WHERE custody.custody_key = v_posting->>'custodyKey';
      IF v_asset.id IS NULL OR v_custody.id IS NULL OR v_custody.asset_id <> v_asset.id OR v_asset.production_enabled OR v_custody.production_enabled THEN
        RAISE EXCEPTION 'ledger_asset_custody_mismatch';
      END IF;
    END IF;

    INSERT INTO public.ledger_postings (
      transaction_id, sequence_no, account_id, asset_id, custody_account_id, side,
      native_atomic_amount, functional_usd_amount, fx_usd_per_unit, project_id, user_id
    ) VALUES (
      v_transaction_id, v_sequence, v_account.id, v_asset.id, v_custody.id, v_posting->>'side',
      nullif(v_posting->>'nativeAtomicAmount', '')::numeric(78, 0),
      (v_posting->>'functionalUsdAmount')::numeric(38, 18),
      nullif(v_posting->>'fxUsdPerUnit', '')::numeric(38, 18),
      nullif(v_posting->>'projectId', '')::bigint, nullif(v_posting->>'userId', '')::uuid
    );
  END LOOP;

  SELECT coalesce(sum(functional_usd_amount) FILTER (WHERE side = 'debit'), 0),
    coalesce(sum(functional_usd_amount) FILTER (WHERE side = 'credit'), 0)
  INTO v_debits, v_credits FROM public.ledger_postings WHERE transaction_id = v_transaction_id;
  IF v_debits <> v_credits THEN RAISE EXCEPTION 'ledger_transaction_unbalanced'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ledger_postings WHERE transaction_id = v_transaction_id AND native_atomic_amount IS NOT NULL
    GROUP BY asset_id, custody_account_id
    HAVING sum(native_atomic_amount) FILTER (WHERE side = 'debit') IS DISTINCT FROM sum(native_atomic_amount) FILTER (WHERE side = 'credit')
  ) THEN RAISE EXCEPTION 'ledger_native_amount_unbalanced'; END IF;

  IF v_reference.id IS NOT NULL THEN
    SELECT coalesce(sum(posting.native_atomic_amount), 0) INTO v_applied
    FROM public.ledger_transactions transaction_row
    JOIN public.ledger_postings posting ON posting.transaction_id = transaction_row.id
    WHERE transaction_row.financial_reference_id = v_reference.id
      AND transaction_row.reversal_of_transaction_id IS NULL AND posting.side = 'debit'
      AND posting.asset_id = v_reference.asset_id AND posting.custody_account_id = v_reference.custody_account_id
      AND NOT EXISTS (SELECT 1 FROM public.ledger_transactions reversal WHERE reversal.reversal_of_transaction_id = transaction_row.id);
    IF v_applied > v_reference.native_atomic_limit THEN RAISE EXCEPTION 'financial_reference_over_applied'; END IF;
  END IF;
  RETURN v_transaction_id;
END;
$$;

CREATE FUNCTION public.reverse_neutral_ledger_transaction(p_command jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_environment text := lower(trim(p_command->>'deploymentEnvironment'));
  v_idempotency_key text := p_command->>'idempotencyKey';
  v_command_hash text := encode(extensions.digest(convert_to(p_command::text, 'UTF8'), 'sha256'), 'hex');
  v_original public.ledger_transactions%ROWTYPE;
  v_existing public.ledger_transactions%ROWTYPE;
  v_period public.accounting_periods%ROWTYPE;
  v_transaction_id bigint;
BEGIN
  IF p_command->>'contractVersion' <> 'ledger_reversal.v1' THEN RAISE EXCEPTION 'invalid_ledger_reversal_contract'; END IF;
  IF v_environment = 'production' OR NOT EXISTS (
    SELECT 1 FROM public.financial_runtime_controls control
    WHERE control.deployment_environment = v_environment AND control.neutral_posting_enabled
      AND NOT control.production_value_flow_enabled
  ) THEN RAISE EXCEPTION 'neutral_ledger_runtime_disabled'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock((p_command->>'originalTransactionId')::bigint);

  SELECT * INTO v_existing FROM public.ledger_transactions transaction_row WHERE transaction_row.idempotency_key = v_idempotency_key;
  IF FOUND THEN
    IF v_existing.command_hash <> v_command_hash THEN RAISE EXCEPTION 'ledger_idempotency_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  SELECT * INTO v_original FROM public.ledger_transactions transaction_row
  WHERE transaction_row.id = (p_command->>'originalTransactionId')::bigint FOR UPDATE;
  IF NOT FOUND OR v_original.reversal_of_transaction_id IS NOT NULL THEN RAISE EXCEPTION 'ledger_original_not_reversible'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_transactions reversal WHERE reversal.reversal_of_transaction_id = v_original.id) THEN
    RAISE EXCEPTION 'ledger_transaction_already_reversed';
  END IF;
  SELECT * INTO v_period FROM public.accounting_periods period WHERE period.period_key = p_command->>'periodKey' FOR UPDATE;
  IF NOT FOUND OR v_period.status <> 'open' OR v_period.production_enabled THEN RAISE EXCEPTION 'ledger_period_not_open'; END IF;

  INSERT INTO public.ledger_transactions (
    accounting_period_id, reversal_of_transaction_id, contract_version, transaction_type,
    idempotency_key, command_hash, evidence_hash, actor_type, actor_user_id,
    deployment_environment, effective_at
  ) VALUES (
    v_period.id, v_original.id, 'ledger_reversal.v1', 'reversal', v_idempotency_key,
    v_command_hash, p_command->>'evidenceHash', p_command->>'actorType',
    nullif(p_command->>'actorUserId', '')::uuid, v_environment, (p_command->>'effectiveAt')::timestamptz
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.ledger_postings (
    transaction_id, sequence_no, account_id, asset_id, custody_account_id, side,
    native_atomic_amount, functional_usd_amount, fx_usd_per_unit, project_id, user_id
  )
  SELECT v_transaction_id, posting.sequence_no, posting.account_id, posting.asset_id,
    posting.custody_account_id, CASE posting.side WHEN 'debit' THEN 'credit' ELSE 'debit' END,
    posting.native_atomic_amount, posting.functional_usd_amount, posting.fx_usd_per_unit,
    posting.project_id, posting.user_id
  FROM public.ledger_postings posting WHERE posting.transaction_id = v_original.id ORDER BY posting.sequence_no;
  RETURN v_transaction_id;
END;
$$;

CREATE FUNCTION public.can_read_ledger_transaction(p_transaction_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ledger_postings posting
    WHERE posting.transaction_id = p_transaction_id
      AND (posting.user_id = (SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.participants participant
        WHERE participant.project_id = posting.project_id AND participant.user_id = (SELECT auth.uid())
      ))
  );
$$;

ALTER TABLE public.financial_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_transactions_scoped_select ON public.ledger_transactions FOR SELECT TO authenticated
USING ((SELECT public.can_read_ledger_transaction(id)));
CREATE POLICY ledger_postings_scoped_select ON public.ledger_postings FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.participants participant
    WHERE participant.project_id = ledger_postings.project_id AND participant.user_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.financial_runtime_controls, public.financial_assets,
  public.financial_custody_accounts, public.financial_references, public.ledger_accounts,
  public.accounting_periods, public.ledger_transactions, public.ledger_postings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ledger_transactions, public.ledger_postings TO authenticated;
GRANT SELECT ON TABLE public.financial_runtime_controls, public.financial_assets,
  public.financial_custody_accounts, public.financial_references, public.ledger_accounts,
  public.accounting_periods, public.ledger_transactions, public.ledger_postings TO service_role;
REVOKE ALL ON FUNCTION public.post_neutral_ledger_transaction(jsonb),
  public.reverse_neutral_ledger_transaction(jsonb), public.can_read_ledger_transaction(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_neutral_ledger_transaction(jsonb),
  public.reverse_neutral_ledger_transaction(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_read_ledger_transaction(bigint) TO authenticated, service_role;
