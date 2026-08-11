ALTER TABLE public.epoch_asset_custody_routes DROP CONSTRAINT epoch_asset_custody_kind;
ALTER TABLE public.epoch_asset_custody_routes ADD CONSTRAINT epoch_asset_custody_kind
  CHECK(source_kind IN('stripe_bank_transfer','base_stablecoin','stripe_acss_debit','stripe_pay_by_bank','carryover'));
ALTER TABLE public.epoch_valuation_source_lots DROP CONSTRAINT epoch_source_lot_kind;
ALTER TABLE public.epoch_valuation_source_lots ADD CONSTRAINT epoch_source_lot_kind
  CHECK(source_kind IN('stripe_bank_transfer','base_stablecoin','stripe_acss_debit','stripe_pay_by_bank','carryover'));

INSERT INTO public.financial_assets(asset_key,rail_key,symbol,atomic_scale,classification_metadata)
VALUES('base_usdc','base_stablecoin','USDC',6,jsonb_build_object('classification','provisional','environment','local')),
  ('base_usdt','base_stablecoin','USDT',6,jsonb_build_object('classification','provisional','environment','local')),
  ('base_pyusd','base_stablecoin','PYUSD',6,jsonb_build_object('classification','provisional','environment','local'))
ON CONFLICT(asset_key) DO NOTHING;

INSERT INTO public.financial_custody_accounts(custody_key,asset_id,provider_key,external_reference_hash,classification_metadata)
SELECT 'base_'||lower(asset.symbol)||'_epoch_treasury',asset.id,'base_review',
  encode(extensions.digest(pg_catalog.convert_to('epoch-prep:base-custody:'||asset.symbol,'UTF8'),'sha256'),'hex'),
  jsonb_build_object('classification','provisional','topology','epoch_treasury')
FROM public.financial_assets asset WHERE asset.asset_key IN('base_usdc','base_usdt','base_pyusd')
ON CONFLICT(custody_key) DO NOTHING;

UPDATE public.base_intake_v2_assets base_asset SET financial_asset_id=financial_asset.id
FROM public.financial_assets financial_asset
WHERE financial_asset.asset_key='base_'||lower(base_asset.symbol)
  AND (base_asset.financial_asset_id IS NULL OR base_asset.financial_asset_id=financial_asset.id);

INSERT INTO public.epoch_asset_custody_routes(source_kind,asset_code,financial_asset_id,custody_account_id,evidence_hash)
SELECT 'base_stablecoin',asset.symbol,asset.id,custody.id,
  encode(extensions.digest(pg_catalog.convert_to('epoch-prep:base-route:'||asset.symbol,'UTF8'),'sha256'),'hex')
FROM public.financial_assets asset JOIN public.financial_custody_accounts custody ON custody.asset_id=asset.id
WHERE asset.asset_key IN('base_usdc','base_usdt','base_pyusd')
  AND custody.custody_key='base_'||lower(asset.symbol)||'_epoch_treasury'
ON CONFLICT(source_kind,asset_code) DO NOTHING;

INSERT INTO public.epoch_asset_custody_routes(source_kind,asset_code,financial_asset_id,custody_account_id,evidence_hash)
SELECT 'stripe_acss_debit',route.currency_code,route.asset_id,route.custody_account_id,route.evidence_hash
FROM public.stripe_acss_debit_custody_routes route WHERE route.sandbox_enabled AND NOT route.production_enabled
ON CONFLICT(source_kind,asset_code) DO NOTHING;

INSERT INTO public.epoch_asset_custody_routes(source_kind,asset_code,financial_asset_id,custody_account_id,evidence_hash)
SELECT 'stripe_pay_by_bank',route.currency_code,route.asset_id,route.custody_account_id,route.evidence_hash
FROM public.stripe_pay_by_bank_custody_routes route WHERE route.sandbox_enabled AND NOT route.production_enabled
ON CONFLICT(source_kind,asset_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_epoch_financial_sources(p_command jsonb) RETURNS integer
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
  IF v_package.id IS NULL OR v_package.status NOT IN('approved','silent_approved') OR v_package.list_status<>'valid'
    OR v_package.funding_status<>'settled' OR v_package.compliance_status<>'passed' OR v_package.cubid_status<>'eligible'
    OR v_package.production_enabled THEN RAISE EXCEPTION 'epoch_financial_prep_package_unavailable';END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-prep-package:'||v_package.id,0));
  SELECT id INTO v_expiry_cycle FROM public.monthly_cycles WHERE period_start=(SELECT period_start+interval '3 months' FROM public.monthly_cycles WHERE id=v_package.canonical_cycle_id)::date;
  SELECT period.* INTO v_period FROM public.accounting_periods period JOIN public.monthly_cycles cycle
    ON cycle.id=v_package.canonical_cycle_id AND period.starts_at::date=cycle.period_start AND period.ends_at::date=(cycle.period_end+1)
    WHERE period.status='open' AND NOT period.production_enabled LIMIT 1;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_accounting_period_missing';END IF;
  FOR v_source IN SELECT * FROM public.epoch_project_package_funding_sources s WHERE s.package_id=v_package.id ORDER BY s.source_position,s.id LOOP
    IF v_source.source_kind='stripe_bank_transfer' THEN
      SELECT * INTO v_stripe_intent FROM public.stripe_bank_transfer_intents i WHERE i.id=v_source.stripe_intent_id;
      IF v_stripe_intent.id IS NULL OR v_stripe_intent.project_id<>v_package.project_id OR v_stripe_intent.currency_code<>v_source.asset_code
        OR v_stripe_intent.expected_amount_minor<>v_source.native_atomic_amount OR v_stripe_intent.production_enabled THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch';END IF;
    ELSIF v_source.source_kind='base_stablecoin' THEN
      SELECT * INTO v_base_receipt FROM public.base_intake_v2_receipts r WHERE r.id=v_source.base_receipt_id;
      IF v_base_receipt.id IS NULL OR v_base_receipt.project_id<>v_package.project_id OR v_base_receipt.token_symbol<>v_source.asset_code
        OR v_base_receipt.net_epoch_native_amount<>v_source.native_atomic_amount OR v_base_receipt.production_enabled
        OR NOT EXISTS(SELECT 1 FROM public.base_intake_v2_reconciliation_events e WHERE e.receipt_id=v_base_receipt.id
          AND e.status='exact' AND NOT EXISTS(SELECT 1 FROM public.base_intake_v2_reconciliation_events newer
            WHERE newer.receipt_id=e.receipt_id AND (newer.observed_at,newer.id)>(e.observed_at,e.id))) THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch';END IF;
    ELSIF v_source.source_kind='stripe_acss_debit' THEN
      IF NOT EXISTS(SELECT 1 FROM public.stripe_acss_debit_commands c JOIN public.stripe_acss_debit_status s ON s.command_id=c.id
        WHERE c.id=v_source.stripe_acss_debit_command_id AND c.project_id=v_package.project_id AND c.currency_code=v_source.asset_code
          AND c.expected_amount_minor=v_source.native_atomic_amount AND NOT c.production_enabled AND s.available_for_package) THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch';END IF;
    ELSIF v_source.source_kind='stripe_pay_by_bank' THEN
      IF NOT EXISTS(SELECT 1 FROM public.stripe_pay_by_bank_commands c JOIN public.stripe_pay_by_bank_status s ON s.command_id=c.id
        WHERE c.id=v_source.stripe_pay_by_bank_command_id AND c.project_id=v_package.project_id AND c.currency_code=v_source.asset_code
          AND c.expected_amount_minor=v_source.native_atomic_amount AND NOT c.production_enabled AND s.available_for_package) THEN
        RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch';END IF;
    ELSE
      RAISE EXCEPTION 'epoch_financial_prep_source_kind_unsupported';
    END IF;
    SELECT * INTO v_route FROM public.epoch_asset_custody_routes r
      WHERE r.source_kind=v_source.source_kind AND r.asset_code=v_source.asset_code AND NOT r.production_enabled;
    IF v_route.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_custody_route_missing';END IF;
    IF v_source.source_kind='base_stablecoin' AND NOT EXISTS(SELECT 1 FROM public.base_intake_v2_assets base_asset
      WHERE base_asset.deployment_id=v_base_receipt.deployment_id AND base_asset.symbol=v_base_receipt.token_symbol
        AND base_asset.token_address=v_base_receipt.token_address AND base_asset.financial_asset_id=v_route.financial_asset_id
        AND base_asset.is_enabled) THEN RAISE EXCEPTION 'epoch_financial_prep_source_evidence_mismatch';END IF;
    SELECT * INTO v_asset FROM public.financial_assets WHERE id=v_route.financial_asset_id;
    SELECT * INTO v_fx FROM public.epoch_fx_snapshots f WHERE f.monthly_cycle_id=v_package.canonical_cycle_id
      AND f.financial_asset_id=v_asset.id AND f.status='posted';
    IF v_fx.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_fx_missing';END IF;
    SELECT * INTO v_policy FROM public.epoch_fee_policies p WHERE (p.rail_key IS NULL OR p.rail_key=v_asset.rail_key)
      AND p.effective_from<=clock_timestamp() AND (p.effective_until IS NULL OR p.effective_until>clock_timestamp()) AND NOT p.production_enabled
      ORDER BY (p.rail_key IS NOT NULL) DESC,p.version DESC LIMIT 1;
    IF v_policy.id IS NULL THEN RAISE EXCEPTION 'epoch_financial_prep_fee_policy_missing';END IF;
    v_project_bps:=CASE WHEN v_source.project_fee_assessed_once THEN 0 ELSE public.clamp_epoch_fee_bps(
      v_policy.project_fee_default_bps,v_policy.project_fee_min_bps,v_policy.project_fee_max_bps) END;
    v_gross:=(v_source.native_atomic_amount/power(10::numeric,v_asset.atomic_scale))*v_fx.rate_usd_per_unit;
    v_project_fee:=v_gross*v_project_bps/10000;
    v_base_fee:=(v_gross-v_project_fee)*v_policy.base_fee_bps/10000;
    v_key:='package:'||v_package.id||':source:'||v_source.id;
    v_postings:=jsonb_build_array(jsonb_build_object('accountKey','epoch_review_gross_control','side','debit',
      'functionalUsdAmount',v_gross::text,'projectId',v_package.project_id));
    IF v_project_fee>0 THEN v_postings:=v_postings||jsonb_build_array(jsonb_build_object('accountKey','epoch_review_project_fee_control',
      'side','credit','functionalUsdAmount',v_project_fee::text,'projectId',v_package.project_id));END IF;
    v_postings:=v_postings||jsonb_build_array(
      jsonb_build_object('accountKey','epoch_review_base_fee_control','side','credit','functionalUsdAmount',v_base_fee::text,'projectId',v_package.project_id),
      jsonb_build_object('accountKey','epoch_review_distributable_control','side','credit','functionalUsdAmount',(v_gross-v_project_fee-v_base_fee)::text,'projectId',v_package.project_id));
    v_ledger_transaction_id:=public.post_neutral_ledger_transaction(jsonb_build_object('contractVersion','ledger_post.v1',
      'deploymentEnvironment',lower(p_command->>'deploymentEnvironment'),'idempotencyKey','epoch-fee:'||v_key,'periodKey',v_period.period_key,
      'transactionType','epoch_review_fee_processing','evidenceHash',v_source.source_evidence_hash,'actorType','operator',
      'actorUserId',p_command->>'actorUserId','effectiveAt',v_period.starts_at,'postings',v_postings));
    INSERT INTO public.epoch_valuation_source_lots(source_lot_key,package_id,package_source_id,project_id,monthly_cycle_id,source_position,
      source_kind,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,fee_policy_id,fee_ledger_transaction_id,native_atomic_amount,
      source_preliminary_exact_usd,gross_exact_usd,fx_difference_exact_usd,project_fee_bps,project_fee_exact_usd,base_fee_bps,
      base_fee_exact_usd,distributable_exact_usd,deterministic_source_order,project_fee_assessed_once,expires_after_cycle_id,evidence_hash,deployment_environment)
    VALUES(v_key,v_package.id,v_source.id,v_package.project_id,v_package.canonical_cycle_id,v_source.source_position,v_source.source_kind,
      v_asset.rail_key,v_asset.id,v_route.custody_account_id,v_fx.id,v_policy.id,v_ledger_transaction_id,v_source.native_atomic_amount,
      v_source.preliminary_usd,v_gross,v_gross-v_source.preliminary_usd,v_project_bps,v_project_fee,v_policy.base_fee_bps,v_base_fee,
      v_gross-v_project_fee-v_base_fee,v_source.source_position,v_source.project_fee_assessed_once,v_expiry_cycle,
      encode(extensions.digest(convert_to(v_key||':'||v_source.source_evidence_hash||':'||v_fx.evidence_hash,'UTF8'),'sha256'),'hex'),
      lower(p_command->>'deploymentEnvironment')) ON CONFLICT DO NOTHING RETURNING id INTO v_lot_id;
    IF v_lot_id IS NOT NULL THEN
      INSERT INTO public.epoch_source_lot_events(source_lot_id,event_type,exact_usd_amount,actor_user_id,evidence_hash)
      SELECT v_lot_id,'prepared',lot.distributable_exact_usd,(p_command->>'actorUserId')::uuid,lot.evidence_hash
      FROM public.epoch_valuation_source_lots lot WHERE lot.id=v_lot_id;
      v_count:=v_count+1;
    END IF;
    v_lot_id:=NULL;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.prepare_epoch_financial_sources(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_epoch_financial_sources(jsonb) TO service_role;
