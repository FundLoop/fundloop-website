CREATE TABLE public.epoch_financial_prep_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  prep_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_financial_prep_production_closed CHECK (
    deployment_environment <> 'production' OR (prep_enabled = false AND production_value_flow_enabled = false)
  ),
  CONSTRAINT epoch_financial_prep_no_value_flow CHECK (production_value_flow_enabled = false)
);

INSERT INTO public.epoch_financial_prep_runtime_controls(deployment_environment,prep_enabled) VALUES
  ('local',true),('development',true),('dev',true),('preview',true),('test',true),('production',false)
ON CONFLICT(deployment_environment) DO NOTHING;

CREATE TABLE public.epoch_asset_custody_routes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_kind text NOT NULL,
  asset_code text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_kind,asset_code),
  CONSTRAINT epoch_asset_custody_kind CHECK(source_kind IN ('stripe_bank_transfer','base_stablecoin','carryover')),
  CONSTRAINT epoch_asset_custody_code CHECK(asset_code ~ '^[A-Z][A-Z0-9]{1,11}$'),
  CONSTRAINT epoch_asset_custody_pair FOREIGN KEY(financial_asset_id,custody_account_id)
    REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT epoch_asset_custody_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_asset_custody_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_asset_custody_asset_idx ON public.epoch_asset_custody_routes(financial_asset_id,custody_account_id);

INSERT INTO public.epoch_asset_custody_routes(source_kind,asset_code,financial_asset_id,custody_account_id,evidence_hash)
SELECT 'stripe_bank_transfer',route.currency_code,route.asset_id,route.custody_account_id,route.evidence_hash
FROM public.stripe_bank_transfer_custody_routes route WHERE route.sandbox_enabled AND NOT route.production_enabled
ON CONFLICT(source_kind,asset_code) DO NOTHING;

CREATE TABLE public.epoch_fx_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_key text NOT NULL,
  source_rank smallint NOT NULL,
  rate_usd_per_unit numeric(38,18) NOT NULL,
  observed_at timestamptz NOT NULL,
  freshness_expires_at timestamptz NOT NULL,
  reasonability_status text NOT NULL,
  evidence_hash text NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL REFERENCES public.epoch_financial_prep_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(monthly_cycle_id,financial_asset_id,source_key,observed_at),
  CONSTRAINT epoch_fx_observation_source CHECK(source_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_fx_observation_rank CHECK(source_rank BETWEEN 1 AND 100),
  CONSTRAINT epoch_fx_observation_rate CHECK(rate_usd_per_unit>0),
  CONSTRAINT epoch_fx_observation_freshness CHECK(freshness_expires_at>observed_at),
  CONSTRAINT epoch_fx_observation_reasonability CHECK(reasonability_status IN ('eligible','rejected_stale','rejected_cross_rate','rejected_prior_movement','rejected_peg')),
  CONSTRAINT epoch_fx_observation_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_fx_observation_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_fx_observation_candidate_idx ON public.epoch_fx_observations(monthly_cycle_id,financial_asset_id,source_rank,observed_at DESC)
  WHERE reasonability_status='eligible';
CREATE INDEX epoch_fx_observation_actor_idx ON public.epoch_fx_observations(actor_user_id) WHERE actor_user_id IS NOT NULL;

CREATE TABLE public.epoch_fx_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version integer NOT NULL,
  selected_observation_id bigint REFERENCES public.epoch_fx_observations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  method text NOT NULL,
  rate_usd_per_unit numeric(38,18) NOT NULL,
  status text NOT NULL,
  stablecoin_peg_status text NOT NULL,
  preanalysis jsonb NOT NULL,
  reviewed_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  posted_at timestamptz,
  evidence_hash text NOT NULL,
  deployment_environment text NOT NULL REFERENCES public.epoch_financial_prep_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(monthly_cycle_id,financial_asset_id,version),
  CONSTRAINT epoch_fx_snapshot_method CHECK(method IN ('primary','fallback','manual_after_exhaustion')),
  CONSTRAINT epoch_fx_snapshot_rate CHECK(rate_usd_per_unit>0),
  CONSTRAINT epoch_fx_snapshot_status CHECK(status IN ('posted','paused_depeg')),
  CONSTRAINT epoch_fx_snapshot_peg CHECK(stablecoin_peg_status IN ('within_band','outside_band','not_applicable')),
  CONSTRAINT epoch_fx_snapshot_shape CHECK(
    (method='manual_after_exhaustion' AND selected_observation_id IS NULL)
    OR (method<>'manual_after_exhaustion' AND selected_observation_id IS NOT NULL)
  ),
  CONSTRAINT epoch_fx_snapshot_analysis CHECK(jsonb_typeof(preanalysis)='object'),
  CONSTRAINT epoch_fx_snapshot_posted CHECK(posted_at IS NOT NULL),
  CONSTRAINT epoch_fx_snapshot_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_fx_snapshot_production_disabled CHECK(production_enabled=false)
);
CREATE UNIQUE INDEX epoch_fx_snapshot_posted_asset_idx ON public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id) WHERE status='posted';
CREATE INDEX epoch_fx_snapshot_observation_idx ON public.epoch_fx_snapshots(selected_observation_id) WHERE selected_observation_id IS NOT NULL;
CREATE INDEX epoch_fx_snapshot_actor_idx ON public.epoch_fx_snapshots(reviewed_by_user_id);

CREATE TABLE public.epoch_fee_policies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy_key text NOT NULL,
  version integer NOT NULL,
  rail_key text,
  project_fee_default_bps integer NOT NULL DEFAULT 100,
  project_fee_min_bps integer NOT NULL DEFAULT 0,
  project_fee_max_bps integer NOT NULL DEFAULT 1000,
  base_fee_bps integer NOT NULL DEFAULT 250,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  evidence_hash text NOT NULL,
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(policy_key,version),
  CONSTRAINT epoch_fee_policy_key CHECK(policy_key ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT epoch_fee_policy_bounds CHECK(
    project_fee_min_bps BETWEEN 0 AND 1000 AND project_fee_max_bps BETWEEN project_fee_min_bps AND 1000
    AND project_fee_default_bps BETWEEN project_fee_min_bps AND project_fee_max_bps AND base_fee_bps BETWEEN 0 AND 1000
  ),
  CONSTRAINT epoch_fee_policy_window CHECK(effective_until IS NULL OR effective_until>effective_from),
  CONSTRAINT epoch_fee_policy_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_fee_policy_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_fee_policy_active_idx ON public.epoch_fee_policies(rail_key,effective_from DESC) WHERE effective_until IS NULL;

CREATE FUNCTION public.clamp_epoch_fee_bps(p_requested integer,p_min integer,p_max integer) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT greatest(p_min,least(p_max,p_requested)); $$;

INSERT INTO public.epoch_fee_policies(policy_key,version,rail_key,effective_from,evidence_hash) VALUES
  ('review_default',1,NULL,'2026-01-01T00:00:00Z',repeat('f',64))
ON CONFLICT(policy_key,version) DO NOTHING;

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions) VALUES
  ('epoch_review_gross_control','debit','provisional_epoch_gross_control','["project"]'::jsonb),
  ('epoch_review_project_fee_control','credit','provisional_project_fee_control','["project"]'::jsonb),
  ('epoch_review_base_fee_control','credit','provisional_base_fee_control','["project"]'::jsonb),
  ('epoch_review_distributable_control','credit','provisional_funded_epoch_principal','["project"]'::jsonb)
ON CONFLICT(account_key) DO NOTHING;

CREATE TABLE public.epoch_valuation_source_lots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_lot_key text NOT NULL UNIQUE,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  package_source_id bigint REFERENCES public.epoch_project_package_funding_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origin_source_lot_id bigint REFERENCES public.epoch_valuation_source_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_position integer NOT NULL,
  source_kind text NOT NULL,
  rail_key text NOT NULL,
  financial_asset_id bigint NOT NULL REFERENCES public.financial_assets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  custody_account_id bigint NOT NULL REFERENCES public.financial_custody_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fx_snapshot_id bigint NOT NULL REFERENCES public.epoch_fx_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fee_policy_id bigint NOT NULL REFERENCES public.epoch_fee_policies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fee_ledger_transaction_id bigint NOT NULL REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  native_atomic_amount numeric(78,0) NOT NULL,
  source_preliminary_exact_usd numeric(38,18) NOT NULL,
  gross_exact_usd numeric(38,18) NOT NULL,
  fx_difference_exact_usd numeric(38,18) NOT NULL,
  project_fee_bps integer NOT NULL,
  project_fee_exact_usd numeric(38,18) NOT NULL,
  base_fee_bps integer NOT NULL,
  base_fee_exact_usd numeric(38,18) NOT NULL,
  distributable_exact_usd numeric(38,18) NOT NULL,
  canonical_minor_unit_scale smallint NOT NULL DEFAULT 2,
  deterministic_source_order bigint NOT NULL,
  project_fee_assessed_once boolean NOT NULL,
  classification_status text NOT NULL DEFAULT 'provisional_funded_epoch_principal',
  state text NOT NULL DEFAULT 'ready_for_lock',
  expires_after_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reserved_exact_usd numeric(38,18) NOT NULL DEFAULT 0,
  evidence_hash text NOT NULL,
  deployment_environment text NOT NULL REFERENCES public.epoch_financial_prep_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_source_lot_source_shape CHECK((package_source_id IS NOT NULL) <> (origin_source_lot_id IS NOT NULL)),
  CONSTRAINT epoch_source_lot_position CHECK(source_position>=0 AND deterministic_source_order>=0),
  CONSTRAINT epoch_source_lot_kind CHECK(source_kind IN ('stripe_bank_transfer','base_stablecoin','carryover')),
  CONSTRAINT epoch_source_lot_pair FOREIGN KEY(financial_asset_id,custody_account_id)
    REFERENCES public.financial_custody_accounts(asset_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT epoch_source_lot_amounts CHECK(
    native_atomic_amount>0 AND source_preliminary_exact_usd>0 AND gross_exact_usd>0
    AND gross_exact_usd=source_preliminary_exact_usd+fx_difference_exact_usd
    AND project_fee_exact_usd>=0 AND base_fee_exact_usd>=0
    AND distributable_exact_usd>0 AND gross_exact_usd=project_fee_exact_usd+base_fee_exact_usd+distributable_exact_usd
    AND reserved_exact_usd>=0 AND reserved_exact_usd<=distributable_exact_usd
  ),
  CONSTRAINT epoch_source_lot_fee_bounds CHECK(project_fee_bps BETWEEN 0 AND 1000 AND base_fee_bps BETWEEN 0 AND 1000),
  CONSTRAINT epoch_source_lot_minor_scale CHECK(canonical_minor_unit_scale BETWEEN 0 AND 18),
  CONSTRAINT epoch_source_lot_classification CHECK(classification_status='provisional_funded_epoch_principal'),
  CONSTRAINT epoch_source_lot_state CHECK(state IN ('ready_for_lock','reserved','harvested','carried_forward','returned_residue')),
  CONSTRAINT epoch_source_lot_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_source_lot_production_disabled CHECK(production_enabled=false)
);
CREATE UNIQUE INDEX epoch_source_lot_package_source_idx ON public.epoch_valuation_source_lots(package_source_id) WHERE package_source_id IS NOT NULL;
CREATE INDEX epoch_source_lot_cycle_state_idx ON public.epoch_valuation_source_lots(monthly_cycle_id,state,deterministic_source_order,id);
CREATE INDEX epoch_source_lot_project_idx ON public.epoch_valuation_source_lots(project_id,monthly_cycle_id,id);
CREATE INDEX epoch_source_lot_asset_custody_idx ON public.epoch_valuation_source_lots(financial_asset_id,custody_account_id,monthly_cycle_id);
CREATE INDEX epoch_source_lot_origin_idx ON public.epoch_valuation_source_lots(origin_source_lot_id) WHERE origin_source_lot_id IS NOT NULL;
CREATE INDEX epoch_source_lot_fx_idx ON public.epoch_valuation_source_lots(fx_snapshot_id);
CREATE INDEX epoch_source_lot_fee_idx ON public.epoch_valuation_source_lots(fee_policy_id);
CREATE INDEX epoch_source_lot_ledger_idx ON public.epoch_valuation_source_lots(fee_ledger_transaction_id);
CREATE INDEX epoch_source_lot_expiry_idx ON public.epoch_valuation_source_lots(expires_after_cycle_id,state) WHERE state IN ('ready_for_lock','reserved');

CREATE TABLE public.epoch_source_lot_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_lot_id bigint NOT NULL REFERENCES public.epoch_valuation_source_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  successor_source_lot_id bigint REFERENCES public.epoch_valuation_source_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type text NOT NULL,
  exact_usd_amount numeric(38,18) NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_source_event_type CHECK(event_type IN ('prepared','reserved','reservation_released','harvested','carried_forward','returned_residue')),
  CONSTRAINT epoch_source_event_amount CHECK(exact_usd_amount>0),
  CONSTRAINT epoch_source_event_hash CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_source_event_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX epoch_source_event_lot_idx ON public.epoch_source_lot_events(source_lot_id,created_at,id);
CREATE INDEX epoch_source_event_successor_idx ON public.epoch_source_lot_events(successor_source_lot_id) WHERE successor_source_lot_id IS NOT NULL;
CREATE INDEX epoch_source_event_actor_idx ON public.epoch_source_lot_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

CREATE FUNCTION public.prevent_epoch_financial_prep_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'epoch_financial_prep_records_are_append_only'; END; $$;
CREATE TRIGGER epoch_fx_observations_append_only BEFORE UPDATE OR DELETE ON public.epoch_fx_observations FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_financial_prep_mutation();
CREATE TRIGGER epoch_fx_snapshots_append_only BEFORE UPDATE OR DELETE ON public.epoch_fx_snapshots FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_financial_prep_mutation();
CREATE TRIGGER epoch_source_lot_events_append_only BEFORE UPDATE OR DELETE ON public.epoch_source_lot_events FOR EACH ROW EXECUTE FUNCTION public.prevent_epoch_financial_prep_mutation();

CREATE FUNCTION public.epoch_financial_prep_runtime_enabled(p_environment text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.epoch_financial_prep_runtime_controls c
    WHERE c.deployment_environment=lower(p_environment) AND c.prep_enabled AND NOT c.production_value_flow_enabled
  );
$$;

CREATE FUNCTION public.record_epoch_fx_observation(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle public.monthly_cycles%ROWTYPE; v_asset public.financial_assets%ROWTYPE; v_id bigint;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_fx_observation.v1' OR NOT public.epoch_financial_prep_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_financial_prep_runtime_disabled'; END IF;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key=p_command->>'cycleKey';
  SELECT * INTO v_asset FROM public.financial_assets WHERE asset_key=p_command->>'assetKey' AND NOT production_enabled;
  IF v_cycle.id IS NULL OR v_asset.id IS NULL THEN RAISE EXCEPTION 'epoch_fx_observation_dimensions_invalid'; END IF;
  INSERT INTO public.epoch_fx_observations(monthly_cycle_id,financial_asset_id,source_key,source_rank,rate_usd_per_unit,
    observed_at,freshness_expires_at,reasonability_status,evidence_hash,actor_user_id,deployment_environment)
  VALUES(v_cycle.id,v_asset.id,p_command->>'sourceKey',(p_command->>'sourceRank')::smallint,(p_command->>'rateUsdPerUnit')::numeric,
    (p_command->>'observedAt')::timestamptz,(p_command->>'freshnessExpiresAt')::timestamptz,p_command->>'reasonabilityStatus',
    p_command->>'evidenceHash',nullif(p_command->>'actorUserId','')::uuid,lower(p_command->>'deploymentEnvironment')) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE FUNCTION public.post_epoch_fx_snapshot(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle public.monthly_cycles%ROWTYPE; v_asset public.financial_assets%ROWTYPE; v_obs public.epoch_fx_observations%ROWTYPE;
  v_method text:=p_command->>'method'; v_rate numeric(38,18); v_peg text; v_id bigint; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_command->>'contractVersion'<>'epoch_fx_snapshot.v1' OR NOT public.epoch_financial_prep_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_financial_prep_runtime_disabled'; END IF;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key=p_command->>'cycleKey' FOR UPDATE;
  SELECT * INTO v_asset FROM public.financial_assets WHERE asset_key=p_command->>'assetKey' AND NOT production_enabled;
  IF v_cycle.id IS NULL OR v_asset.id IS NULL THEN RAISE EXCEPTION 'epoch_fx_snapshot_dimensions_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-fx:'||v_cycle.id||':'||v_asset.id,0));
  IF EXISTS(SELECT 1 FROM public.epoch_fx_snapshots s WHERE s.monthly_cycle_id=v_cycle.id AND s.financial_asset_id=v_asset.id AND s.status='posted') THEN
    RAISE EXCEPTION 'epoch_fx_snapshot_already_posted'; END IF;
  IF v_method='manual_after_exhaustion' THEN
    IF EXISTS(SELECT 1 FROM public.epoch_fx_observations o WHERE o.monthly_cycle_id=v_cycle.id AND o.financial_asset_id=v_asset.id
      AND o.reasonability_status='eligible' AND o.freshness_expires_at>=v_now) THEN RAISE EXCEPTION 'epoch_fx_manual_source_not_exhausted'; END IF;
    v_rate:=(p_command->>'manualRateUsdPerUnit')::numeric;
  ELSE
    SELECT * INTO v_obs FROM public.epoch_fx_observations o WHERE o.id=(p_command->>'observationId')::bigint
      AND o.monthly_cycle_id=v_cycle.id AND o.financial_asset_id=v_asset.id AND o.reasonability_status='eligible' AND o.freshness_expires_at>=v_now;
    IF v_obs.id IS NULL THEN RAISE EXCEPTION 'epoch_fx_observation_unavailable'; END IF;
    IF (v_method='primary' AND v_obs.source_rank<>1) OR (v_method='fallback' AND v_obs.source_rank=1) THEN RAISE EXCEPTION 'epoch_fx_source_rank_mismatch'; END IF;
    IF v_method='fallback' AND EXISTS(
      SELECT 1 FROM public.epoch_fx_observations better
      WHERE better.monthly_cycle_id=v_cycle.id AND better.financial_asset_id=v_asset.id
        AND better.reasonability_status='eligible' AND better.freshness_expires_at>=v_now
        AND better.source_rank<v_obs.source_rank
    ) THEN RAISE EXCEPTION 'epoch_fx_higher_priority_source_available'; END IF;
    v_rate:=v_obs.rate_usd_per_unit;
  END IF;
  v_peg:=CASE WHEN v_asset.symbol IN ('USD','USDC','USDT','PYUSD') THEN CASE WHEN v_rate BETWEEN .997 AND 1.003 THEN 'within_band' ELSE 'outside_band' END ELSE 'not_applicable' END;
  INSERT INTO public.epoch_fx_snapshots(monthly_cycle_id,financial_asset_id,version,selected_observation_id,method,rate_usd_per_unit,
    status,stablecoin_peg_status,preanalysis,reviewed_by_user_id,posted_at,evidence_hash,deployment_environment)
  VALUES(v_cycle.id,v_asset.id,coalesce((SELECT max(version)+1 FROM public.epoch_fx_snapshots WHERE monthly_cycle_id=v_cycle.id AND financial_asset_id=v_asset.id),1),
    v_obs.id,v_method,v_rate,CASE WHEN v_peg='outside_band' THEN 'paused_depeg' ELSE 'posted' END,v_peg,
    coalesce(p_command->'preanalysis','{}'::jsonb),(p_command->>'actorUserId')::uuid,v_now,p_command->>'evidenceHash',lower(p_command->>'deploymentEnvironment')) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE FUNCTION public.prepare_epoch_financial_sources(p_command jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_package public.epoch_project_packages%ROWTYPE; v_source public.epoch_project_package_funding_sources%ROWTYPE;
  v_route public.epoch_asset_custody_routes%ROWTYPE; v_asset public.financial_assets%ROWTYPE; v_fx public.epoch_fx_snapshots%ROWTYPE;
  v_stripe_intent public.stripe_bank_transfer_intents%ROWTYPE; v_base_receipt public.base_intake_v2_receipts%ROWTYPE;
  v_policy public.epoch_fee_policies%ROWTYPE; v_gross numeric(38,18); v_project_fee numeric(38,18); v_base_fee numeric(38,18);
  v_project_bps integer; v_count integer:=0; v_lot_id bigint; v_key text; v_expiry_cycle bigint;
  v_period public.accounting_periods%ROWTYPE; v_ledger_transaction_id bigint; v_postings jsonb;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_financial_prep.v1' OR NOT public.epoch_financial_prep_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_financial_prep_runtime_disabled'; END IF;
  SELECT * INTO v_package FROM public.epoch_project_packages p WHERE p.id=(p_command->>'packageId')::bigint FOR UPDATE;
  IF v_package.id IS NULL OR v_package.status NOT IN ('approved','silent_approved') OR v_package.list_status<>'valid'
    OR v_package.funding_status<>'settled' OR v_package.compliance_status<>'passed' OR v_package.cubid_status<>'eligible'
    OR v_package.production_enabled THEN RAISE EXCEPTION 'epoch_financial_prep_package_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-prep-package:'||v_package.id,0));
  SELECT id INTO v_expiry_cycle FROM public.monthly_cycles WHERE period_start=(SELECT period_start+interval '3 months' FROM public.monthly_cycles WHERE id=v_package.canonical_cycle_id)::date;
  SELECT period.* INTO v_period FROM public.accounting_periods period JOIN public.monthly_cycles cycle
    ON cycle.id=v_package.canonical_cycle_id AND period.starts_at::date=cycle.period_start AND period.ends_at::date=(cycle.period_end+1)
    WHERE period.status='open' AND NOT period.production_enabled LIMIT 1;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_accounting_period_missing'; END IF;
  FOR v_source IN SELECT * FROM public.epoch_project_package_funding_sources s WHERE s.package_id=v_package.id ORDER BY s.source_position,s.id LOOP
    IF v_source.source_kind='stripe_bank_transfer' THEN
      SELECT * INTO v_stripe_intent FROM public.stripe_bank_transfer_intents i WHERE i.id=v_source.stripe_intent_id;
      IF v_stripe_intent.id IS NULL OR v_stripe_intent.project_id<>v_package.project_id OR v_stripe_intent.currency_code<>v_source.asset_code
        OR v_stripe_intent.expected_amount_minor<>v_source.native_atomic_amount OR v_stripe_intent.production_enabled THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch'; END IF;
    ELSE
      SELECT * INTO v_base_receipt FROM public.base_intake_v2_receipts r WHERE r.id=v_source.base_receipt_id;
      IF v_base_receipt.id IS NULL OR v_base_receipt.project_id<>v_package.project_id OR v_base_receipt.token_symbol<>v_source.asset_code
        OR v_base_receipt.net_epoch_native_amount<>v_source.native_atomic_amount OR v_base_receipt.production_enabled
        OR NOT EXISTS(SELECT 1 FROM public.base_intake_v2_reconciliation_events e WHERE e.receipt_id=v_base_receipt.id
          AND e.status='exact' AND NOT EXISTS(SELECT 1 FROM public.base_intake_v2_reconciliation_events newer
            WHERE newer.receipt_id=e.receipt_id AND (newer.observed_at,newer.id)>(e.observed_at,e.id))) THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch'; END IF;
    END IF;
    SELECT * INTO v_route FROM public.epoch_asset_custody_routes r WHERE r.source_kind=v_source.source_kind AND r.asset_code=v_source.asset_code AND NOT r.production_enabled;
    IF v_route.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_custody_route_missing'; END IF;
    SELECT * INTO v_asset FROM public.financial_assets WHERE id=v_route.financial_asset_id;
    SELECT * INTO v_fx FROM public.epoch_fx_snapshots f WHERE f.monthly_cycle_id=v_package.canonical_cycle_id AND f.financial_asset_id=v_asset.id AND f.status='posted';
    IF v_fx.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_fx_missing'; END IF;
    SELECT * INTO v_policy FROM public.epoch_fee_policies p WHERE (p.rail_key IS NULL OR p.rail_key=v_asset.rail_key)
      AND p.effective_from<=clock_timestamp() AND (p.effective_until IS NULL OR p.effective_until>clock_timestamp()) AND NOT p.production_enabled
      ORDER BY (p.rail_key IS NOT NULL) DESC,p.version DESC LIMIT 1;
    IF v_policy.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_fee_policy_missing'; END IF;
    v_project_bps:=CASE WHEN v_source.project_fee_assessed_once THEN 0 ELSE public.clamp_epoch_fee_bps(
      v_policy.project_fee_default_bps,v_policy.project_fee_min_bps,v_policy.project_fee_max_bps) END;
    v_gross:=(v_source.native_atomic_amount/power(10::numeric,v_asset.atomic_scale))*v_fx.rate_usd_per_unit;
    v_project_fee:=v_gross*v_project_bps/10000;
    v_base_fee:=(v_gross-v_project_fee)*v_policy.base_fee_bps/10000;
    v_key:='package:'||v_package.id||':source:'||v_source.id;
    v_postings:=jsonb_build_array(jsonb_build_object('accountKey','epoch_review_gross_control','side','debit',
      'functionalUsdAmount',v_gross::text,'projectId',v_package.project_id));
    IF v_project_fee>0 THEN v_postings:=v_postings||jsonb_build_array(jsonb_build_object('accountKey','epoch_review_project_fee_control',
      'side','credit','functionalUsdAmount',v_project_fee::text,'projectId',v_package.project_id)); END IF;
    v_postings:=v_postings||jsonb_build_array(
      jsonb_build_object('accountKey','epoch_review_base_fee_control','side','credit','functionalUsdAmount',v_base_fee::text,'projectId',v_package.project_id),
      jsonb_build_object('accountKey','epoch_review_distributable_control','side','credit','functionalUsdAmount',(v_gross-v_project_fee-v_base_fee)::text,'projectId',v_package.project_id));
    v_ledger_transaction_id:=public.post_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_post.v1',
      'deploymentEnvironment',lower(p_command->>'deploymentEnvironment'),'idempotencyKey','epoch-fee:'||v_key,'periodKey',v_period.period_key,
      'transactionType','epoch_review_fee_processing','evidenceHash',v_source.source_evidence_hash,'actorType','operator',
      'actorUserId',p_command->>'actorUserId','effectiveAt',v_period.starts_at,'postings',v_postings));
    INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,package_source_id,project_id,monthly_cycle_id,source_position,
      source_kind,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,fee_ledger_transaction_id,native_atomic_amount,
      source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,
      project_fee_bps,project_fee_exact_usd,base_fee_bps,base_fee_exact_usd,distributable_exact_usd,deterministic_source_order,
      project_fee_assessed_once,expires_after_cycle_id,evidence_hash,deployment_environment)
    VALUES(v_key,v_package.id,v_source.id,v_package.project_id,v_package.canonical_cycle_id,v_source.source_position,v_source.source_kind,
      v_asset.rail_key,v_asset.id,v_route.custody_account_id,v_fx.id,v_policy.id,v_ledger_transaction_id,v_source.native_atomic_amount,
      v_source.preliminary_usd,v_gross,v_gross-v_source.preliminary_usd,v_project_bps,v_project_fee,
      v_policy.base_fee_bps,v_base_fee,v_gross-v_project_fee-v_base_fee,v_source.source_position,v_source.project_fee_assessed_once,
      v_expiry_cycle,encode(extensions.digest(convert_to(v_key||':'||v_source.source_evidence_hash||':'||v_fx.evidence_hash,'UTF8'),'sha256'),'hex'),
      lower(p_command->>'deploymentEnvironment')) ON CONFLICT DO NOTHING RETURNING id INTO v_lot_id;
    IF v_lot_id IS NOT NULL THEN
      INSERT INTO public.epoch_source_lot_events(source_lot_id,event_type,exact_usd_amount,actor_user_id,evidence_hash)
      SELECT v_lot_id,'prepared',lot.distributable_exact_usd,(p_command->>'actorUserId')::uuid,lot.evidence_hash FROM public.epoch_valuation_source_lots lot WHERE lot.id=v_lot_id;
      v_count:=v_count+1;
    END IF;
    v_lot_id:=NULL;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE FUNCTION public.harvest_epoch_source_lot(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_source public.epoch_valuation_source_lots%ROWTYPE; v_target public.monthly_cycles%ROWTYPE; v_successor bigint; v_key text;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_source_harvest.v1' OR NOT public.epoch_financial_prep_runtime_enabled(p_command->>'deploymentEnvironment') THEN
    RAISE EXCEPTION 'epoch_financial_prep_runtime_disabled'; END IF;
  SELECT * INTO v_source FROM public.epoch_valuation_source_lots WHERE id=(p_command->>'sourceLotId')::bigint FOR UPDATE;
  SELECT * INTO v_target FROM public.monthly_cycles WHERE cycle_key=p_command->>'targetCycleKey' FOR UPDATE;
  IF v_source.id IS NULL OR v_target.id IS NULL OR v_source.state NOT IN ('ready_for_lock','returned_residue') THEN RAISE EXCEPTION 'epoch_source_harvest_unavailable'; END IF;
  IF v_source.reserved_exact_usd<>0 THEN RAISE EXCEPTION 'epoch_source_harvest_reserved'; END IF;
  IF v_source.expires_after_cycle_id IS NULL OR v_target.period_start<=(SELECT period_start FROM public.monthly_cycles WHERE id=v_source.expires_after_cycle_id) THEN
    RAISE EXCEPTION 'epoch_source_harvest_not_expired'; END IF;
  IF v_target.period_start<=(SELECT period_start FROM public.monthly_cycles WHERE id=v_source.monthly_cycle_id) THEN RAISE EXCEPTION 'epoch_source_harvest_target_invalid'; END IF;
  v_key:=v_source.source_lot_key||':carry:'||v_target.cycle_key;
  UPDATE public.epoch_valuation_source_lots SET state='carried_forward' WHERE id=v_source.id;
  INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,origin_source_lot_id,project_id,monthly_cycle_id,source_position,source_kind,
    rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,fee_ledger_transaction_id,native_atomic_amount,
    source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,project_fee_bps,
    project_fee_exact_usd,base_fee_bps,base_fee_exact_usd,distributable_exact_usd,canonical_minor_unit_scale,deterministic_source_order,
    project_fee_assessed_once,classification_status,state,expires_after_cycle_id,evidence_hash,deployment_environment)
  VALUES(v_key,v_source.package_id,v_source.id,v_source.project_id,v_target.id,v_source.source_position,'carryover',v_source.rail_key,
    v_source.financial_asset_id,v_source.custody_account_id,v_source.fx_snapshot_id,v_source.fee_policy_id,v_source.fee_ledger_transaction_id,v_source.native_atomic_amount,
    v_source.distributable_exact_usd,v_source.distributable_exact_usd,0,0,0,0,0,v_source.distributable_exact_usd,v_source.canonical_minor_unit_scale,
    v_source.deterministic_source_order,true,v_source.classification_status,'ready_for_lock',NULL,
    encode(extensions.digest(convert_to(v_key||':'||v_source.evidence_hash,'UTF8'),'sha256'),'hex'),lower(p_command->>'deploymentEnvironment'))
  RETURNING id INTO v_successor;
  INSERT INTO public.epoch_source_lot_events(source_lot_id,successor_source_lot_id,event_type,exact_usd_amount,actor_user_id,evidence_hash)
  VALUES(v_source.id,v_successor,'carried_forward',v_source.distributable_exact_usd,(p_command->>'actorUserId')::uuid,
    encode(extensions.digest(convert_to(v_key||':event','UTF8'),'sha256'),'hex'));
  RETURN v_successor;
END; $$;

CREATE FUNCTION public.harvest_expired_epoch_source_lots(p_environment text,p_target_cycle_key text,p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_target public.monthly_cycles%ROWTYPE; v_lot record; v_count integer:=0;
BEGIN
  IF NOT public.epoch_financial_prep_runtime_enabled(p_environment) OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'epoch_financial_prep_runtime_disabled'; END IF;
  SELECT * INTO v_target FROM public.monthly_cycles WHERE cycle_key=p_target_cycle_key;
  IF v_target.id IS NULL THEN RAISE EXCEPTION 'epoch_source_harvest_target_invalid'; END IF;
  FOR v_lot IN SELECT lot.id FROM public.epoch_valuation_source_lots lot
    JOIN public.monthly_cycles expiry ON expiry.id=lot.expires_after_cycle_id
    WHERE lot.state IN ('ready_for_lock','returned_residue') AND lot.reserved_exact_usd=0 AND expiry.period_start<v_target.period_start
    ORDER BY expiry.period_start,lot.deterministic_source_order,lot.id FOR UPDATE OF lot SKIP LOCKED LIMIT p_limit
  LOOP
    PERFORM public.harvest_epoch_source_lot(jsonb_build_object('contractVersion','epoch_source_harvest.v1',
      'deploymentEnvironment',lower(p_environment),'sourceLotId',v_lot.id,'targetCycleKey',p_target_cycle_key));
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE VIEW public.epoch_financial_prep_operator_view WITH(security_invoker=true) AS
SELECT cycle.cycle_key,lot.monthly_cycle_id,lot.project_id,project.slug project_slug,lot.source_lot_key,lot.source_kind,lot.rail_key,
  asset.asset_key,asset.symbol,custody.custody_key,lot.native_atomic_amount,fx.rate_usd_per_unit,lot.gross_exact_usd,
  lot.source_preliminary_exact_usd,lot.fx_difference_exact_usd,lot.project_fee_exact_usd,lot.base_fee_exact_usd,lot.distributable_exact_usd,lot.reserved_exact_usd,lot.state,
  lot.classification_status,lot.deterministic_source_order,lot.created_at
FROM public.epoch_valuation_source_lots lot JOIN public.monthly_cycles cycle ON cycle.id=lot.monthly_cycle_id
JOIN public.projects project ON project.id=lot.project_id JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id;

CREATE VIEW public.epoch_funded_allocation_lock_candidates WITH(security_invoker=true) AS
SELECT lot.id source_lot_id,lot.source_lot_key,lot.package_id,lot.project_id,lot.monthly_cycle_id,lot.source_position,
  lot.source_kind,lot.rail_key,asset.asset_key,asset.atomic_scale,custody.custody_key,lot.native_atomic_amount,
  fx.rate_usd_per_unit,lot.source_preliminary_exact_usd,lot.gross_exact_usd,lot.fx_difference_exact_usd,
  lot.project_fee_exact_usd,lot.base_fee_exact_usd,lot.distributable_exact_usd,
  lot.canonical_minor_unit_scale,lot.deterministic_source_order,cohort.user_id,cohort.locked_cubid_score,
  cohort.locked_max_cubid_score,package.eligible_user_count,cohort.evidence_hash cubid_evidence_hash,lot.evidence_hash source_evidence_hash
FROM public.epoch_valuation_source_lots lot JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id JOIN public.epoch_fx_snapshots fx ON fx.id=lot.fx_snapshot_id
JOIN public.epoch_project_packages package ON package.id=lot.package_id
JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
WHERE lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled;

CREATE VIEW public.epoch_financial_prep_cycle_summary WITH(security_invoker=true) AS
SELECT cycle.cycle_key,lot.monthly_cycle_id,count(*) source_count,count(DISTINCT lot.project_id) project_count,
  sum(lot.native_atomic_amount) native_atomic_total,sum(lot.gross_exact_usd) gross_exact_usd,
  sum(lot.project_fee_exact_usd) project_fee_exact_usd,sum(lot.base_fee_exact_usd) base_fee_exact_usd,
  sum(lot.distributable_exact_usd) distributable_exact_usd,sum(lot.reserved_exact_usd) reserved_exact_usd,
  count(*) FILTER(WHERE lot.state='ready_for_lock' AND lot.reserved_exact_usd=0) ready_source_count,
  bool_and(lot.classification_status='provisional_funded_epoch_principal' AND NOT lot.production_enabled) neutral_provisional_only
FROM public.epoch_valuation_source_lots lot JOIN public.monthly_cycles cycle ON cycle.id=lot.monthly_cycle_id
GROUP BY cycle.cycle_key,lot.monthly_cycle_id;

ALTER TABLE public.epoch_financial_prep_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_asset_custody_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_fx_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_fx_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_fee_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_valuation_source_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_source_lot_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epoch_financial_prep_runtime_controls,public.epoch_asset_custody_routes,public.epoch_fx_observations,
  public.epoch_fx_snapshots,public.epoch_fee_policies,public.epoch_valuation_source_lots,public.epoch_source_lot_events,
  public.epoch_financial_prep_operator_view,public.epoch_funded_allocation_lock_candidates,public.epoch_financial_prep_cycle_summary FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_financial_prep_runtime_controls,public.epoch_asset_custody_routes,public.epoch_fx_observations,
  public.epoch_fx_snapshots,public.epoch_fee_policies,public.epoch_valuation_source_lots,public.epoch_source_lot_events,
  public.epoch_financial_prep_operator_view,public.epoch_funded_allocation_lock_candidates,public.epoch_financial_prep_cycle_summary TO service_role;
REVOKE ALL ON FUNCTION public.epoch_financial_prep_runtime_enabled(text),public.record_epoch_fx_observation(jsonb),
  public.post_epoch_fx_snapshot(jsonb),public.prepare_epoch_financial_sources(jsonb),public.harvest_epoch_source_lot(jsonb),
  public.harvest_expired_epoch_source_lots(text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.epoch_financial_prep_runtime_enabled(text),public.record_epoch_fx_observation(jsonb),
  public.post_epoch_fx_snapshot(jsonb),public.prepare_epoch_financial_sources(jsonb),public.harvest_epoch_source_lot(jsonb),
  public.harvest_expired_epoch_source_lots(text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.clamp_epoch_fee_bps(integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clamp_epoch_fee_bps(integer,integer,integer) TO service_role;
