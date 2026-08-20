-- Restore the persisted v2 allocation-lock shape after the logical-isolation
-- replacement drifted from the live manifest tables and harvest lifecycle.
CREATE OR REPLACE FUNCTION public.lock_funded_epoch_allocation_v2(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cycle public.monthly_cycles%ROWTYPE; v_preview jsonb; v_manifest jsonb; v_manifest_id bigint; v_hash text;
  v_version integer; v_funded_exact numeric(38,18); v_funded_minor numeric(78,0); v_current_minor numeric(78,0);
  v_harvest_minor numeric(78,0); v_carry_minor numeric(78,0); v_pool jsonb; v_existing public.epoch_allocation_manifests%ROWTYPE;
  v_currency text;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_lock.v2'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  IF nullif(p_command->>'actorUserId','') IS NULL OR (p_command->>'selectedPreviewHash') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'epoch_allocation_v2_selection_invalid'; END IF;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key=p_command->>'cycleKey' FOR UPDATE;
  IF v_cycle.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_cycle_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-allocation-v2:'||v_cycle.id::text,0));
  SELECT * INTO v_existing FROM public.epoch_allocation_manifests
  WHERE monthly_cycle_id=v_cycle.id AND policy_key='settled_cubid_redistribution_v2' ORDER BY version DESC LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.cap_multiple<>(p_command->>'capMultiple')::numeric
      OR v_existing.selected_preview_hash<>p_command->>'selectedPreviewHash'
    THEN RAISE EXCEPTION 'epoch_allocation_v2_selection_conflict'; END IF;
    RETURN jsonb_build_object('manifestId',v_existing.id,'manifestHash',v_existing.manifest_hash,'manifest',v_existing.manifest);
  END IF;
  v_preview:=public.epoch_allocation_v2_preview_input(v_cycle.cycle_key,(p_command->>'capMultiple')::numeric,p_command->>'deploymentEnvironment');
  IF v_preview->>'inputHash'<>p_command->>'selectedPreviewHash' THEN RAISE EXCEPTION 'epoch_allocation_v2_preview_stale'; END IF;
  v_currency:=coalesce(nullif(v_preview->>'currency',''),'USD');

  PERFORM 1 FROM public.user_withdrawal_obligations obligation
  JOIN public.payout_inventory_lots inventory ON inventory.obligation_id=obligation.id
  WHERE inventory.id IN(
    SELECT split_part(item.value->>'sourceLotId',':',3)::bigint
    FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value)
    WHERE item.value->>'originKind'='harvested_unclaimed'
  ) ORDER BY obligation.id FOR UPDATE OF obligation;

  -- The obligation lock may have waited behind a concurrent claim. Recompute
  -- the authoritative snapshot after the lock and reject a stale selection.
  v_preview:=public.epoch_allocation_v2_preview_input(
    v_cycle.cycle_key,
    (p_command->>'capMultiple')::numeric,
    p_command->>'deploymentEnvironment'
  );
  IF v_preview->>'inputHash'<>p_command->>'selectedPreviewHash' THEN RAISE EXCEPTION 'epoch_allocation_v2_preview_stale'; END IF;

  FOR v_pool IN SELECT value FROM jsonb_array_elements(v_preview->'redistributionSources') LOOP
    IF v_pool->>'originKind'='harvested_unclaimed' THEN
      INSERT INTO public.epoch_redistribution_pool_sources(source_lot_key,target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,
        origin_obligation_id,origin_inventory_lot_id,origin_award_fill_id,project_id,rail_key,financial_asset_id,custody_account_id,
        fx_snapshot_id,native_atomic_amount,exact_usd,canonical_minor,minor_unit_scale,source_order,evidence_hash)
      SELECT v_pool->>'sourceLotKey',v_cycle.id,obligation.monthly_cycle_id,'harvested_unclaimed',obligation.id,inventory.id,inventory.source_fill_id,
        inventory.project_id,inventory.rail_key,inventory.financial_asset_id,inventory.custody_account_id,inventory.fx_snapshot_id,
        (v_pool->>'nativeAtomicAmount')::numeric,(v_pool->>'exactUsd')::numeric,
        (v_pool->>'canonicalMinorCapacity')::numeric,(v_pool->>'minorUnitScale')::integer,
        (v_pool->>'sourceOrder')::numeric,v_pool->>'evidenceHash'
      FROM public.payout_inventory_lots inventory
      JOIN public.user_withdrawal_obligations obligation ON obligation.id=inventory.obligation_id
      WHERE inventory.id=split_part(v_pool->>'sourceLotId',':',3)::bigint
      ON CONFLICT(target_monthly_cycle_id,origin_inventory_lot_id) WHERE origin_kind='harvested_unclaimed' DO NOTHING;
    END IF;
  END LOOP;

  v_current_minor:=(SELECT coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric),0) FROM jsonb_array_elements(v_preview->'projectSources') AS item(value));
  v_harvest_minor:=(SELECT coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric),0) FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value) WHERE item.value->>'originKind'='harvested_unclaimed');
  v_carry_minor:=(SELECT coalesce(sum((item.value->>'canonicalMinorCapacity')::numeric),0) FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value) WHERE item.value->>'originKind'='carryforward_residue');
  v_funded_minor:=v_current_minor+v_harvest_minor+v_carry_minor;
  v_funded_exact:=(SELECT coalesce(sum((item.value->>'exactUsd')::numeric),0) FROM jsonb_array_elements(v_preview->'projectSources') AS item(value))
    +(SELECT coalesce(sum((item.value->>'exactUsd')::numeric),0) FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value));

  v_version:=coalesce((SELECT max(version)+1 FROM public.epoch_allocation_manifests WHERE monthly_cycle_id=v_cycle.id),1);
  v_manifest:=v_preview-ARRAY['inputHash','originCycleKey'];
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');

  INSERT INTO public.epoch_allocation_manifests(monthly_cycle_id,policy_key,version,manifest_hash,selected_preview_hash,cap_multiple,
    funded_exact_usd,funded_minor,manifest,actor_user_id,deployment_environment,current_funded_minor,harvested_unclaimed_minor,carry_in_minor,currency)
  VALUES(v_cycle.id,'settled_cubid_redistribution_v2',v_version,v_hash,p_command->>'selectedPreviewHash',(p_command->>'capMultiple')::numeric,
    v_funded_exact,v_funded_minor,v_manifest,(p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment'),
    v_current_minor,v_harvest_minor,v_carry_minor,v_currency)
  RETURNING id INTO v_manifest_id;

  INSERT INTO public.epoch_allocation_manifest_sources(manifest_id,source_lot_id,source_lot_key,project_id,source_position,rail_key,
    financial_asset_id,custody_account_id,native_atomic_amount,fx_snapshot_id,exact_usd,canonical_minor_capacity,source_order,evidence_hash)
  SELECT v_manifest_id,lot.id,lot.source_lot_key,lot.project_id,lot.source_position,lot.rail_key,lot.financial_asset_id,lot.custody_account_id,
    lot.native_atomic_amount,lot.fx_snapshot_id,lot.distributable_exact_usd,(item.value->>'canonicalMinorCapacity')::numeric,
    lot.deterministic_source_order,lot.evidence_hash
  FROM jsonb_array_elements(v_preview->'projectSources') AS item(value)
  JOIN public.epoch_valuation_source_lots lot ON lot.id=(item.value->>'sourceLotId')::bigint;

  INSERT INTO public.epoch_allocation_manifest_cohort(manifest_id,project_id,user_id,project_pseudonym,locked_cubid_score,locked_max_cubid_score,cubid_evidence_hash)
  SELECT v_manifest_id,(item.value->>'projectId')::bigint,(item.value->>'userId')::uuid,item.value->>'projectPseudonym',
    (item.value->>'lockedScore')::numeric,(item.value->>'lockedMaximumScore')::numeric,item.value->>'cubidEvidenceHash'
  FROM jsonb_array_elements(v_preview->'cohort') AS item(value);

  INSERT INTO public.epoch_allocation_manifest_pool_sources(manifest_id,pool_source_id,source_lot_key,project_id,origin_kind,origin_cycle_key,
    rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,native_atomic_amount,exact_usd,canonical_minor_capacity,source_order,evidence_hash)
  SELECT v_manifest_id,pool.id,pool.source_lot_key,pool.project_id,pool.origin_kind,origin.cycle_key,pool.rail_key,pool.financial_asset_id,
    pool.custody_account_id,pool.fx_snapshot_id,pool.native_atomic_amount,pool.exact_usd,pool.canonical_minor,pool.source_order,pool.evidence_hash
  FROM public.epoch_redistribution_pool_sources pool
  JOIN public.monthly_cycles origin ON origin.id=pool.origin_monthly_cycle_id
  WHERE pool.source_lot_key IN(
    SELECT item.value->>'sourceLotKey' FROM jsonb_array_elements(v_preview->'redistributionSources') AS item(value)
  );

  UPDATE public.epoch_valuation_source_lots SET state='reserved',reserved_exact_usd=distributable_exact_usd
  WHERE id IN(SELECT source_lot_id FROM public.epoch_allocation_manifest_sources WHERE manifest_id=v_manifest_id);

  UPDATE public.epoch_redistribution_pool_sources SET state='reserved'
  WHERE id IN(SELECT pool_source_id FROM public.epoch_allocation_manifest_pool_sources WHERE manifest_id=v_manifest_id);

  WITH harvested AS (
    SELECT source.origin_obligation_id,sum(source.canonical_minor) amount
    FROM public.epoch_redistribution_pool_sources source
    JOIN public.epoch_allocation_manifest_pool_sources manifest_source ON manifest_source.pool_source_id=source.id
    WHERE manifest_source.manifest_id=v_manifest_id AND source.origin_kind='harvested_unclaimed'
    GROUP BY source.origin_obligation_id
  ) UPDATE public.user_withdrawal_obligations obligation
    SET harvested_minor=obligation.harvested_minor+harvested.amount,claim_window_closed_at=clock_timestamp()
  FROM harvested WHERE obligation.id=harvested.origin_obligation_id;

  RETURN jsonb_build_object('manifestId',v_manifest_id,'manifestHash',v_hash,'manifest',v_manifest);
END; $$;

-- Source amounts are normalized to the allocation reporting currency. Asset
-- identity remains explicit in assetKey and nativeAtomicAmount.
CREATE OR REPLACE FUNCTION public.epoch_allocation_v2_preview_input(p_cycle_key text, p_cap_multiple numeric, p_environment text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_target public.monthly_cycles%ROWTYPE; v_origin public.monthly_cycles%ROWTYPE;
  v_project_sources jsonb; v_cohort jsonb; v_pool_sources jsonb; v_input jsonb; v_hash text;
  v_currency text:='USD';
BEGIN
  IF NOT public.epoch_allocation_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  IF p_cap_multiple<1 OR p_cap_multiple>10 OR p_cap_multiple<>round(p_cap_multiple,2) THEN
    RAISE EXCEPTION 'epoch_allocation_v2_cap_multiple_invalid'; END IF;
  SELECT * INTO v_target FROM public.monthly_cycles WHERE cycle_key=p_cycle_key;
  SELECT * INTO v_origin FROM public.monthly_cycles WHERE period_start=(v_target.period_start-interval '3 months')::date;
  IF v_target.id IS NULL OR v_origin.id IS NULL THEN RAISE EXCEPTION 'epoch_allocation_v2_harvest_epoch_missing'; END IF;
  IF clock_timestamp()<((v_target.period_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles') THEN
    RAISE EXCEPTION 'epoch_allocation_v2_claim_window_open'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sourceLotId',lot.id::text,'sourceLotKey',lot.source_lot_key,'projectId',lot.project_id,'projectKey',project.slug,
    'exactUsd',lot.distributable_exact_usd::text,'minorUnitScale',lot.canonical_minor_unit_scale,
    'sourceOrder',lot.deterministic_source_order::text,'railKey',lot.rail_key,'assetKey',asset.asset_key,
    'custodyKey',custody.custody_key,'nativeAtomicAmount',lot.native_atomic_amount::text,
    'fxSnapshotId',lot.fx_snapshot_id::text,'evidenceHash',lot.evidence_hash,'currency',v_currency
  ) ORDER BY lot.deterministic_source_order,lot.source_lot_key),'[]'::jsonb) INTO v_project_sources
  FROM public.epoch_valuation_source_lots lot
  JOIN public.epoch_project_packages package ON package.id=lot.package_id
  JOIN public.projects project ON project.id=lot.project_id
  JOIN public.financial_assets asset ON asset.id=lot.financial_asset_id
  JOIN public.financial_custody_accounts custody ON custody.id=lot.custody_account_id
  WHERE lot.monthly_cycle_id=v_target.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
    AND package.canonical_cycle_id=v_target.id AND package.status IN('approved','silent_approved')
    AND package.funding_status='settled' AND package.compliance_status='passed' AND package.cubid_status='eligible';
  IF jsonb_array_length(v_project_sources)=0 THEN RAISE EXCEPTION 'epoch_allocation_v2_project_sources_missing'; END IF;

  SELECT coalesce(jsonb_agg(row_value ORDER BY (row_value->>'projectId')::bigint,row_value->>'userId'),'[]'::jsonb) INTO v_cohort
  FROM (
    SELECT DISTINCT jsonb_build_object('projectId',lot.project_id,'projectKey',project.slug,'userId',cohort.user_id::text,
      'projectPseudonym',cohort.project_pseudonym,'lockedScore',cohort.locked_cubid_score::text,
      'lockedMaximumScore',cohort.locked_max_cubid_score::text,'cubidEvidenceHash',cohort.evidence_hash) row_value
    FROM public.epoch_valuation_source_lots lot
    JOIN public.epoch_project_packages package ON package.id=lot.package_id
    JOIN public.projects project ON project.id=lot.project_id
    JOIN public.epoch_project_package_cohort cohort ON cohort.package_id=package.id AND cohort.eligibility_status='eligible'
    WHERE lot.monthly_cycle_id=v_target.id AND lot.state='ready_for_lock' AND lot.reserved_exact_usd=0 AND NOT lot.production_enabled
      AND package.canonical_cycle_id=v_target.id AND package.status IN('approved','silent_approved')
  ) rows;

  WITH inventory AS (
    SELECT obligation.id obligation_id,balance.available_minor,lot.id inventory_lot_id,lot.source_fill_id,lot.project_id,lot.rail_key,
      lot.financial_asset_id,lot.custody_account_id,lot.fx_snapshot_id,lot.native_atomic_total,lot.canonical_minor_total,
      lot.deterministic_sequence,fill.exact_usd,
      greatest(0,lot.canonical_minor_total-coalesce((SELECT sum(reserved_minor) FROM public.payout_inventory_reservations reservation
        WHERE reservation.inventory_lot_id=lot.id AND reservation.status IN('reserved','held','consumed')),0)) available_inventory_minor
    FROM public.user_withdrawal_obligations obligation
    JOIN public.user_withdrawal_obligation_balances balance ON balance.id=obligation.id
    JOIN public.payout_inventory_lots lot ON lot.obligation_id=obligation.id
    JOIN public.epoch_provisional_award_source_fills fill ON fill.id=lot.source_fill_id
    WHERE obligation.monthly_cycle_id=v_origin.id AND balance.available_minor>0 AND lot.status IN('available','reserved')
  ), ordered AS (
    SELECT inventory.*,coalesce(sum(available_inventory_minor) OVER(PARTITION BY obligation_id ORDER BY deterministic_sequence DESC,inventory_lot_id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior_newest_minor
    FROM inventory WHERE available_inventory_minor>0
  ), harvested AS (
    SELECT ordered.*,least(available_inventory_minor,greatest(0,available_minor-prior_newest_minor)) harvest_minor
    FROM ordered
  ), candidates AS (
    SELECT jsonb_build_object('sourceLotId','harvest:'||v_target.id::text||':'||harvested.inventory_lot_id::text,
      'sourceLotKey','harvest:'||v_target.cycle_key||':'||harvested.inventory_lot_id::text,'projectId',harvested.project_id,
      'exactUsd',(harvested.exact_usd*harvested.harvest_minor/harvested.canonical_minor_total)::text,'minorUnitScale',2,
      'canonicalMinorCapacity',harvested.harvest_minor::text,
      'sourceOrder',(900000000000000000::numeric+harvested.deterministic_sequence)::text,'railKey',harvested.rail_key,
      'assetKey',asset.asset_key,'custodyKey',custody.custody_key,
      'nativeAtomicAmount',greatest(1,floor(harvested.native_atomic_total*harvested.harvest_minor/harvested.canonical_minor_total))::text,
      'fxSnapshotId',harvested.fx_snapshot_id::text,'evidenceHash',encode(extensions.digest(convert_to(
        'harvest:'||v_target.cycle_key||':'||harvested.inventory_lot_id::text||':'||harvested.harvest_minor::text,'UTF8'),'sha256'),'hex'),
      'currency',v_currency,'originKind','harvested_unclaimed','originCycleKey',v_origin.cycle_key) row_value
    FROM harvested JOIN public.financial_assets asset ON asset.id=harvested.financial_asset_id
    JOIN public.financial_custody_accounts custody ON custody.id=harvested.custody_account_id
    WHERE harvested.harvest_minor>0
    UNION ALL
    SELECT jsonb_build_object('sourceLotId',pool.id::text,'sourceLotKey',pool.source_lot_key,'projectId',pool.project_id,
      'exactUsd',pool.exact_usd::text,'minorUnitScale',pool.minor_unit_scale,'sourceOrder',pool.source_order::text,
      'canonicalMinorCapacity',pool.canonical_minor::text,
      'railKey',pool.rail_key,'assetKey',asset.asset_key,'custodyKey',custody.custody_key,
      'nativeAtomicAmount',pool.native_atomic_amount::text,'fxSnapshotId',pool.fx_snapshot_id::text,'evidenceHash',pool.evidence_hash,
      'currency',v_currency,'originKind','carryforward_residue','originCycleKey',origin.cycle_key) row_value
    FROM public.epoch_redistribution_pool_sources pool
    JOIN public.monthly_cycles origin ON origin.id=pool.origin_monthly_cycle_id
    JOIN public.financial_assets asset ON asset.id=pool.financial_asset_id
    JOIN public.financial_custody_accounts custody ON custody.id=pool.custody_account_id
    WHERE pool.target_monthly_cycle_id=v_target.id AND pool.origin_kind='carryforward_residue' AND pool.state='ready_for_lock'
  ) SELECT coalesce(jsonb_agg(row_value ORDER BY row_value->>'sourceOrder',row_value->>'sourceLotKey'),'[]'::jsonb) INTO v_pool_sources FROM candidates;

  WITH source_rows AS (
    SELECT item.value row_value,(item.value->>'exactUsd')::numeric*100 exact_minor
    FROM jsonb_array_elements(v_project_sources) AS item(value)
  ), ranked AS (
    SELECT source_rows.*,floor(exact_minor) base_minor,
      row_number() OVER(ORDER BY exact_minor-floor(exact_minor) DESC,row_value->>'sourceLotKey') remainder_rank,
      floor(sum(exact_minor) OVER())-sum(floor(exact_minor)) OVER() residual_units
    FROM source_rows
  ), enriched AS (
    SELECT row_value||jsonb_build_object('canonicalMinorCapacity',
      (base_minor+CASE WHEN remainder_rank<=residual_units THEN 1 ELSE 0 END)::numeric(78,0)::text) row_value
    FROM ranked
  )
  SELECT coalesce(jsonb_agg(row_value ORDER BY row_value->>'sourceOrder',row_value->>'sourceLotKey'),'[]'::jsonb)
  INTO v_project_sources FROM enriched;

  v_input:=jsonb_build_object('policy','settled_cubid_redistribution_v2','cycleKey',v_target.cycle_key,'minorUnitScale',2,
    'capMultiple',to_char(p_cap_multiple,'FM90.00'),'currency',v_currency,'projectSources',v_project_sources,
    'redistributionSources',v_pool_sources,'cohort',v_cohort);
  v_hash:=encode(extensions.digest(convert_to(v_input::text,'UTF8'),'sha256'),'hex');
  RETURN v_input||jsonb_build_object('inputHash',v_hash,'originCycleKey',v_origin.cycle_key);
END; $$;

-- Permit an exact idempotent replay after the first record transitions the
-- manifest to calculated, while still rejecting a changed result hash.
CREATE OR REPLACE FUNCTION public.record_funded_epoch_allocation_v2(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_manifest public.epoch_allocation_manifests%ROWTYPE; v_artifact jsonb:=p_command->'artifact'; v_run_id bigint;
  v_existing public.epoch_allocation_runs%ROWTYPE; v_user jsonb; v_row jsonb; v_position integer:=0; v_next_cycle bigint;
  v_currency text;
BEGIN
  IF p_command->>'contractVersion'<>'epoch_funded_allocation_result.v2'
    OR NOT public.epoch_allocation_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_allocation_runtime_disabled'; END IF;
  SELECT * INTO v_manifest FROM public.epoch_allocation_manifests WHERE id=(p_command->>'manifestId')::bigint FOR UPDATE;
  IF v_manifest.policy_key<>'settled_cubid_redistribution_v2' THEN RAISE EXCEPTION 'epoch_allocation_v2_manifest_not_locked'; END IF;
  SELECT * INTO v_existing FROM public.epoch_allocation_runs WHERE manifest_id=v_manifest.id;
  IF FOUND THEN
    IF v_existing.result_hash<>p_command->>'resultHash' THEN RAISE EXCEPTION 'epoch_allocation_result_conflict'; END IF;
    RETURN v_existing.id;
  END IF;
  IF v_manifest.status<>'locked' THEN RAISE EXCEPTION 'epoch_allocation_v2_manifest_not_locked'; END IF;
  v_currency:=coalesce(nullif(v_artifact->>'currency',''),v_manifest.currency,'USD');
  IF v_artifact->>'policy'<>'settled_cubid_redistribution_v2' OR v_artifact->>'manifestHash'<>v_manifest.manifest_hash
    OR v_artifact->>'selectedPreviewHash'<>v_manifest.selected_preview_hash OR (v_artifact->>'capMultiple')::numeric<>v_manifest.cap_multiple
    OR v_artifact->>'resultHash'<>p_command->>'resultHash'
    OR coalesce(nullif(v_artifact->>'currency',''),v_manifest.currency)<>v_manifest.currency
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_artifact->'invariantChecks') check_row WHERE NOT (check_row->>'ok')::boolean)
  THEN RAISE EXCEPTION 'epoch_allocation_v2_artifact_invalid'; END IF;

  INSERT INTO public.epoch_allocation_runs(manifest_id,policy_key,result_hash,artifact,funded_minor,retained_initial_minor,score_pool_minor,
    overlap_pool_minor,top_up_minor,returned_residue_minor,final_allocation_minor,actor_user_id,deployment_environment,cap_multiple,
    current_funded_minor,harvested_unclaimed_minor,carry_in_minor,currency)
  VALUES(v_manifest.id,'settled_cubid_redistribution_v2',p_command->>'resultHash',v_artifact,
    (v_artifact->'totals'->>'totalInputMinor')::numeric,(v_artifact->'totals'->>'initialClaimMinor')::numeric,
    (v_artifact->'totals'->>'scorePoolMinor')::numeric,0,(v_artifact->'totals'->>'topUpMinor')::numeric,
    (v_artifact->'totals'->>'carryOutResidueMinor')::numeric,(v_artifact->'totals'->>'finalAllocationMinor')::numeric,
    (p_command->>'actorUserId')::uuid,lower(p_command->>'deploymentEnvironment'),v_manifest.cap_multiple,
    (v_artifact->'totals'->>'currentFundedMinor')::numeric,(v_artifact->'totals'->>'harvestedUnclaimedMinor')::numeric,
    (v_artifact->'totals'->>'carryInMinor')::numeric,v_currency) RETURNING id INTO v_run_id;

  FOR v_user IN SELECT value FROM jsonb_array_elements(v_artifact->'users') LOOP
    INSERT INTO public.epoch_allocation_user_awards(run_id,user_id,aggregate_initial_exact_usd,baseline_exact_usd,exact_cap_usd,
      minor_unit_cap,retained_initial_minor,top_up_minor,final_minor,project_claims,policy_key,cap_multiple,initial_claim_minor,top_up_capacity_minor,currency)
    VALUES(v_run_id,(v_user->>'userId')::uuid,(v_user->>'aggregateInitialExactUsd')::numeric,(v_user->>'baselineExactUsd')::numeric,
      (v_user->>'redistributionCeilingExactUsd')::numeric,(v_user->>'redistributionCeilingMinor')::numeric,
      (v_user->>'initialClaimMinor')::numeric,(v_user->>'topUpMinor')::numeric,(v_user->>'finalMinor')::numeric,v_user->'projectClaims',
      'settled_cubid_redistribution_v2',v_manifest.cap_multiple,(v_user->>'initialClaimMinor')::numeric,(v_user->>'topUpCapacityMinor')::numeric,
      coalesce(nullif(v_user->>'currency',''),v_currency));
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_artifact->'sourceDispositions') LOOP
    v_position:=v_position+1;
    INSERT INTO public.epoch_allocation_source_dispositions(run_id,manifest_source_id,manifest_pool_source_id,user_id,disposition_kind,
      canonical_minor,exact_usd,stable_position,policy_key,currency)
    SELECT v_run_id,project_source.id,NULL,nullif(v_row->>'userId','')::uuid,v_row->>'kind',(v_row->>'canonicalMinor')::numeric,
      (v_row->>'exactUsd')::numeric,v_position,'settled_cubid_redistribution_v2',coalesce(nullif(v_row->>'currency',''),v_currency)
    FROM public.epoch_allocation_manifest_sources project_source
    WHERE project_source.manifest_id=v_manifest.id AND project_source.source_lot_key=v_row->>'sourceLotKey'
    UNION ALL
    SELECT v_run_id,NULL,pool_source.id,nullif(v_row->>'userId','')::uuid,v_row->>'kind',(v_row->>'canonicalMinor')::numeric,
      (v_row->>'exactUsd')::numeric,v_position,'settled_cubid_redistribution_v2',coalesce(nullif(v_row->>'currency',''),v_currency)
    FROM public.epoch_allocation_manifest_pool_sources pool_source
    WHERE pool_source.manifest_id=v_manifest.id AND pool_source.source_lot_key=v_row->>'sourceLotKey';
    IF NOT FOUND THEN RAISE EXCEPTION 'epoch_allocation_v2_source_unknown'; END IF;
  END LOOP;

  SELECT id INTO v_next_cycle FROM public.monthly_cycles WHERE period_start>(SELECT period_start FROM public.monthly_cycles WHERE id=v_manifest.monthly_cycle_id)
  ORDER BY period_start LIMIT 1;
  IF EXISTS(SELECT 1 FROM public.epoch_allocation_source_dispositions WHERE run_id=v_run_id AND disposition_kind='carryout_residue') AND v_next_cycle IS NULL
  THEN RAISE EXCEPTION 'epoch_allocation_v2_carry_target_missing'; END IF;

  INSERT INTO public.epoch_redistribution_pool_sources(source_lot_key,target_monthly_cycle_id,origin_monthly_cycle_id,origin_kind,
    predecessor_pool_source_id,origin_disposition_id,project_id,rail_key,financial_asset_id,custody_account_id,fx_snapshot_id,native_atomic_amount,
    exact_usd,canonical_minor,minor_unit_scale,source_order,evidence_hash)
  SELECT 'carry:'||v_next_cycle::text||':'||disposition.id::text,v_next_cycle,v_manifest.monthly_cycle_id,'carryforward_residue',
    manifest_pool.pool_source_id,disposition.id,coalesce(project_source.project_id,manifest_pool.project_id),coalesce(project_source.rail_key,manifest_pool.rail_key),
    coalesce(project_source.financial_asset_id,manifest_pool.financial_asset_id),coalesce(project_source.custody_account_id,manifest_pool.custody_account_id),
    coalesce(project_source.fx_snapshot_id,manifest_pool.fx_snapshot_id),greatest(1,floor(coalesce(project_source.native_atomic_amount,manifest_pool.native_atomic_amount)
      *disposition.canonical_minor/greatest(1,coalesce(project_source.canonical_minor_capacity,manifest_pool.canonical_minor_capacity)))),
    disposition.exact_usd,disposition.canonical_minor,2,900000000000000000::numeric+disposition.stable_position,
    encode(extensions.digest(convert_to('carry:'||v_run_id::text||':'||disposition.id::text,'UTF8'),'sha256'),'hex')
  FROM public.epoch_allocation_source_dispositions disposition
  LEFT JOIN public.epoch_allocation_manifest_sources project_source ON project_source.id=disposition.manifest_source_id
  LEFT JOIN public.epoch_allocation_manifest_pool_sources manifest_pool ON manifest_pool.id=disposition.manifest_pool_source_id
  WHERE disposition.run_id=v_run_id AND disposition.disposition_kind='carryout_residue' AND disposition.exact_usd>0;

  UPDATE public.epoch_allocation_manifests SET status='calculated',calculated_at=clock_timestamp() WHERE id=v_manifest.id;
  RETURN v_run_id;
END; $$;
