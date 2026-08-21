ALTER TABLE public.financial_custody_accounts ADD CONSTRAINT financial_custody_accounts_asset_id_unique UNIQUE(asset_id,id);

CREATE TABLE public.external_financial_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_key text NOT NULL, provider_event_id text NOT NULL, custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id),
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id), event_type text NOT NULL,
  provider_sequence bigint, settled_native_amount numeric(78,0) NOT NULL,
  occurred_at timestamptz NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
  ordering_status text NOT NULL, evidence_hash text NOT NULL, legacy_timestamp_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(provider_key, provider_event_id),
  CONSTRAINT external_event_asset_custody_fk FOREIGN KEY(asset_id,custody_account_id) REFERENCES public.financial_custody_accounts(asset_id,id),
  CONSTRAINT external_event_amount_check CHECK(settled_native_amount >= 0),
  CONSTRAINT external_event_order_check CHECK(ordering_status IN ('in_order','out_of_order','unsequenced')),
  CONSTRAINT external_event_hash_check CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT external_event_legacy_check CHECK(jsonb_typeof(legacy_timestamp_evidence)='object'),
  CONSTRAINT external_event_prod_check CHECK(production_enabled=false)
);
CREATE INDEX external_financial_events_custody_asset_idx ON public.external_financial_events(custody_account_id,asset_id,occurred_at,id);

CREATE TABLE public.external_funding_applications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id bigint NOT NULL REFERENCES public.external_financial_events(id),
  financial_reference_id bigint NOT NULL REFERENCES public.financial_references(id),
  applied_native_amount numeric(78,0) NOT NULL CHECK(applied_native_amount>0), evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(event_id,financial_reference_id), CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), CHECK(production_enabled=false)
);

CREATE TABLE public.custody_reconciliation_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id),
  asset_id bigint NOT NULL REFERENCES public.financial_assets(id), provider_native_balance numeric(78,0) NOT NULL,
  shadow_native_balance numeric(78,0) NOT NULL, tolerance_native_amount numeric(78,0) NOT NULL CHECK(tolerance_native_amount>=0),
  variance_native_amount numeric(78,0) NOT NULL, variance_classification text NOT NULL,
  observed_at timestamptz NOT NULL, evidence_hash text NOT NULL, production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT custody_recon_asset_fk FOREIGN KEY(asset_id,custody_account_id) REFERENCES public.financial_custody_accounts(asset_id,id),
  CHECK(variance_native_amount=provider_native_balance-shadow_native_balance),
  CHECK(variance_classification IN ('exact','within_tolerance','outside_tolerance')),
  CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), CHECK(production_enabled=false)
);
CREATE INDEX custody_reconciliation_latest_idx ON public.custody_reconciliation_snapshots(custody_account_id,asset_id,observed_at DESC);

CREATE TABLE public.shadow_financial_journals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id bigint REFERENCES public.external_financial_events(id),
  journal_type text NOT NULL CHECK(journal_type IN ('receipt','fee','allocation','payout','suspense')),
  native_debits numeric(78,0) NOT NULL, native_credits numeric(78,0) NOT NULL,
  functional_debits numeric(38,18) NOT NULL, functional_credits numeric(38,18) NOT NULL,
  comparison_status text NOT NULL CHECK(comparison_status IN ('matched','explained_variance','unmatched','suspense')),
  comparison_detail jsonb NOT NULL DEFAULT '{}'::jsonb, evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(native_debits=native_credits), CHECK(functional_debits=functional_credits),
  CHECK(jsonb_typeof(comparison_detail)='object'), CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), CHECK(production_enabled=false)
);

CREATE TABLE public.shadow_close_packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, accounting_period_id bigint NOT NULL REFERENCES public.accounting_periods(id),
  status text NOT NULL DEFAULT 'scaffold' CHECK(status IN ('scaffold','review_ready')),
  unmatched_count integer NOT NULL DEFAULT 0, outside_tolerance_count integer NOT NULL DEFAULT 0,
  trial_balance_hash text, reconciliation_hash text, production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(production_enabled=false)
);

CREATE FUNCTION public.ingest_external_financial_event(
 p_provider_key text,p_provider_event_id text,p_custody_account_id bigint,p_asset_id bigint,p_event_type text,
 p_provider_sequence bigint,p_settled_native_amount numeric,p_occurred_at timestamptz,p_evidence_hash text,
 p_legacy_timestamp_evidence jsonb,p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing public.external_financial_events%ROWTYPE; v_id bigint; v_order text;
BEGIN
 IF lower(p_deployment_environment)='production' OR NOT EXISTS(SELECT 1 FROM public.financial_runtime_controls WHERE deployment_environment=lower(p_deployment_environment) AND neutral_posting_enabled) THEN RAISE EXCEPTION 'shadow_reconciliation_disabled'; END IF;
 SELECT * INTO v_existing FROM public.external_financial_events WHERE provider_key=p_provider_key AND provider_event_id=p_provider_event_id;
 IF FOUND THEN
  IF v_existing.custody_account_id<>p_custody_account_id OR v_existing.asset_id<>p_asset_id OR v_existing.event_type<>p_event_type OR v_existing.provider_sequence IS DISTINCT FROM p_provider_sequence OR v_existing.settled_native_amount<>p_settled_native_amount OR v_existing.occurred_at<>p_occurred_at OR v_existing.evidence_hash<>p_evidence_hash THEN RAISE EXCEPTION 'external_event_dedupe_conflict'; END IF;
  RETURN v_existing.id;
 END IF;
 v_order:=CASE WHEN p_provider_sequence IS NULL THEN 'unsequenced' WHEN EXISTS(SELECT 1 FROM public.external_financial_events WHERE provider_key=p_provider_key AND custody_account_id=p_custody_account_id AND provider_sequence>=p_provider_sequence) THEN 'out_of_order' ELSE 'in_order' END;
 INSERT INTO public.external_financial_events(provider_key,provider_event_id,custody_account_id,asset_id,event_type,provider_sequence,settled_native_amount,occurred_at,ordering_status,evidence_hash,legacy_timestamp_evidence)
 VALUES(p_provider_key,p_provider_event_id,p_custody_account_id,p_asset_id,p_event_type,p_provider_sequence,p_settled_native_amount,p_occurred_at,v_order,p_evidence_hash,coalesce(p_legacy_timestamp_evidence,'{}')) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE FUNCTION public.apply_external_funding(p_event_id bigint,p_financial_reference_id bigint,p_native_amount numeric,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.external_financial_events%ROWTYPE; v_id bigint; v_applied numeric;
BEGIN
 IF lower(p_deployment_environment)='production' THEN RAISE EXCEPTION 'shadow_reconciliation_disabled'; END IF;
 SELECT * INTO v_event FROM public.external_financial_events WHERE id=p_event_id FOR UPDATE;
 SELECT coalesce(sum(applied_native_amount),0) INTO v_applied FROM public.external_funding_applications WHERE event_id=p_event_id;
 IF v_event.id IS NULL OR v_applied+p_native_amount>v_event.settled_native_amount THEN RAISE EXCEPTION 'funding_application_exceeds_settled_native'; END IF;
 INSERT INTO public.external_funding_applications(event_id,financial_reference_id,applied_native_amount,evidence_hash) VALUES(p_event_id,p_financial_reference_id,p_native_amount,p_evidence_hash) RETURNING id INTO v_id; RETURN v_id;
END $$;

CREATE VIEW public.shadow_financial_reconciliation_observability WITH(security_invoker=true) AS
SELECT e.id event_id,e.provider_key,e.provider_event_id,e.event_type,e.ordering_status,e.settled_native_amount,
 coalesce(sum(a.applied_native_amount),0) applied_native_amount,e.settled_native_amount-coalesce(sum(a.applied_native_amount),0) unmatched_native_amount,
 e.occurred_at,e.observed_at,e.legacy_timestamp_evidence
FROM public.external_financial_events e LEFT JOIN public.external_funding_applications a ON a.event_id=e.id GROUP BY e.id;

ALTER TABLE public.external_financial_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_funding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_reconciliation_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.shadow_financial_journals ENABLE ROW LEVEL SECURITY; ALTER TABLE public.shadow_close_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_financial_events,public.external_funding_applications,public.custody_reconciliation_snapshots,public.shadow_financial_journals,public.shadow_close_packages,public.shadow_financial_reconciliation_observability FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.external_financial_events,public.external_funding_applications,public.custody_reconciliation_snapshots,public.shadow_financial_journals,public.shadow_close_packages,public.shadow_financial_reconciliation_observability TO service_role;
REVOKE ALL ON FUNCTION public.ingest_external_financial_event(text,text,bigint,bigint,text,bigint,numeric,timestamptz,text,jsonb,text),public.apply_external_funding(bigint,bigint,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_external_financial_event(text,text,bigint,bigint,text,bigint,numeric,timestamptz,text,jsonb,text),public.apply_external_funding(bigint,bigint,numeric,text,text) TO service_role;
