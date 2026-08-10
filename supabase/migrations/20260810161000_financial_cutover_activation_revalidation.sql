-- Revalidate canonical classification evidence under lock before #143 activation.
-- A prepared manifest must not survive a package, close, obligation, or claim
-- change merely because its legacy projection row remained byte-identical.

CREATE FUNCTION public.assert_financial_cutover_activation_current(p_run_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_run public.financial_cutover_runs%ROWTYPE;
  v_record public.financial_cutover_source_records%ROWTYPE;
  v_classification text;
  v_evidence_hash text;
  v_canonical_minor numeric(78,0);
  v_status text;
  v_deleted_at timestamptz;
  v_request_hash text;
  v_project_id bigint;
  v_asset_id bigint;
  v_withdrawal_request_id uuid;
  v_source_result_id bigint;
BEGIN
  SELECT * INTO v_run FROM public.financial_cutover_runs WHERE id=p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'financial_cutover_run_mismatch'; END IF;

  LOCK TABLE public.payments,public.monthly_cycles,public.monthly_cycle_bookkeeping_credits,
    public.user_withdrawal_requests,public.payout_intents,
    public.epoch_project_packages,public.epoch_project_package_payments,public.epoch_close_packages,
    public.user_withdrawal_obligations,public.user_withdrawal_obligation_claims IN SHARE ROW EXCLUSIVE MODE;

  FOR v_record IN
    SELECT record.* FROM public.financial_cutover_source_records record
    WHERE record.run_id=p_run_id ORDER BY record.source_type,record.source_id
  LOOP
    v_classification:=NULL;
    v_evidence_hash:=NULL;
    v_canonical_minor:=NULL;

    IF v_record.source_type='payment' THEN
      SELECT payment.status::text,payment.deleted_at INTO v_status,v_deleted_at
      FROM public.payments payment WHERE payment.id=v_record.source_id::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
      IF v_deleted_at IS NOT NULL OR v_status<>'active' THEN
        v_classification:='reversed_voided';
      ELSE
        SELECT package.manifest_hash INTO v_evidence_hash
        FROM public.epoch_project_package_payments link
        JOIN public.epoch_project_packages package ON package.id=link.package_id
        WHERE link.payment_id=v_record.source_id::bigint AND package.funding_status='settled'
          AND package.status IN('approved','silent_approved')
        ORDER BY package.version DESC,package.id DESC LIMIT 1;
        v_classification:=CASE WHEN FOUND THEN 'externally_verified' ELSE 'legacy_unverified' END;
      END IF;
    ELSIF v_record.source_type='monthly_cycle' THEN
      PERFORM 1 FROM public.monthly_cycles cycle WHERE cycle.id=v_record.source_id::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
      SELECT package.root_hash INTO v_evidence_hash FROM public.epoch_close_packages package
      WHERE package.monthly_cycle_id=v_record.source_id::bigint ORDER BY package.id DESC LIMIT 1;
      v_classification:=CASE WHEN FOUND THEN 'externally_verified' ELSE 'legacy_unverified' END;
    ELSIF v_record.source_type='bookkeeping_credit' THEN
      SELECT credit.status INTO v_status FROM public.monthly_cycle_bookkeeping_credits credit
      WHERE credit.id=v_record.source_id::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
      IF v_status='voided' THEN
        v_classification:='reversed_voided';
      ELSE
        SELECT obligation.evidence_hash,obligation.total_minor INTO v_evidence_hash,v_canonical_minor
        FROM public.user_withdrawal_obligations obligation
        WHERE obligation.source_bookkeeping_credit_id=v_record.source_id::bigint;
        IF FOUND THEN
          v_classification:='externally_verified';
        ELSIF v_record.classification='approved_opening_balance' THEN
          v_classification:='approved_opening_balance';
        ELSE
          v_classification:='legacy_unverified';
        END IF;
      END IF;
    ELSIF v_record.source_type='withdrawal_request' THEN
      SELECT request.status,request.request_hash,request.project_id,request.financial_asset_id
      INTO v_status,v_request_hash,v_project_id,v_asset_id
      FROM public.user_withdrawal_requests request WHERE request.id=v_record.source_id::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
      IF v_status IN('cancelled','closed') THEN
        v_classification:='reversed_voided';
      ELSIF v_request_hash IS NOT NULL AND v_project_id IS NOT NULL AND v_asset_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims claim
          WHERE claim.withdrawal_request_id=v_record.source_id::uuid)
      THEN
        v_classification:='externally_verified';
        v_evidence_hash:=v_request_hash;
        SELECT coalesce(sum(claim.claimed_minor),0) INTO v_canonical_minor
        FROM public.user_withdrawal_obligation_claims claim
        WHERE claim.withdrawal_request_id=v_record.source_id::uuid;
      ELSE
        v_classification:='legacy_unverified';
      END IF;
    ELSIF v_record.source_type='payout_intent' THEN
      SELECT intent.status::text,intent.withdrawal_request_id,intent.source_result_id
      INTO v_status,v_withdrawal_request_id,v_source_result_id
      FROM public.payout_intents intent WHERE intent.id=v_record.source_id::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
      IF v_status IN('cancelled','failed') THEN
        v_classification:='reversed_voided';
      ELSIF v_withdrawal_request_id IS NOT NULL AND v_source_result_id IS NULL THEN
        v_classification:='externally_verified';
        SELECT request.request_hash,request.net_minor INTO v_evidence_hash,v_canonical_minor
        FROM public.user_withdrawal_requests request WHERE request.id=v_withdrawal_request_id;
      ELSE
        v_classification:='legacy_unverified';
      END IF;
    ELSE
      RAISE EXCEPTION 'financial_cutover_source_type_invalid';
    END IF;

    IF v_classification IS DISTINCT FROM v_record.classification THEN
      RAISE EXCEPTION 'financial_cutover_canonical_evidence_drift';
    END IF;
    IF v_classification='externally_verified' AND (
      v_evidence_hash IS NULL OR v_evidence_hash IS DISTINCT FROM v_record.classification_evidence_hash
      OR (v_record.legacy_minor IS NOT NULL AND v_canonical_minor IS NOT NULL
        AND v_record.legacy_minor IS DISTINCT FROM v_canonical_minor)
    ) THEN
      RAISE EXCEPTION 'financial_cutover_canonical_evidence_drift';
    END IF;
  END LOOP;
END; $$;

ALTER FUNCTION public.activate_financial_cutover(uuid,jsonb)
  RENAME TO activate_financial_cutover_unchecked;

CREATE FUNCTION public.activate_financial_cutover(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(trim(p_command->>'deploymentEnvironment'));
  v_run public.financial_cutover_runs%ROWTYPE;
  v_result jsonb;
  v_superseded_id bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover-instance',0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover:'||v_environment,0));
  SELECT * INTO v_run FROM public.financial_cutover_runs
  WHERE id=(p_command->>'runId')::bigint FOR UPDATE;
  IF v_run.id IS NULL OR v_run.status NOT IN('prepared','active') THEN
    RAISE EXCEPTION 'financial_cutover_run_mismatch';
  END IF;
  IF v_run.status='prepared' THEN
    PERFORM public.assert_financial_cutover_activation_current(v_run.id);
  END IF;

  v_result:=public.activate_financial_cutover_unchecked(p_actor_user_id,p_command);
  FOR v_superseded_id IN
    UPDATE public.financial_cutover_runs SET status='superseded'
    WHERE status='active' AND id<>v_run.id RETURNING id
  LOOP
    INSERT INTO public.financial_cutover_state_events(run_id,event_type,actor_user_id,evidence_hash,detail)
    VALUES(v_superseded_id,'superseded',p_actor_user_id,p_command->>'evidenceHash',
      jsonb_build_object('supersededByRunId',v_run.id,'singletonActiveRun',true));
  END LOOP;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.assert_financial_cutover_activation_current(bigint),
  public.activate_financial_cutover_unchecked(uuid,jsonb),public.activate_financial_cutover(uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.activate_financial_cutover(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_financial_cutover_legacy_write_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_active boolean;
BEGIN
  SELECT state.canonical_reads_enabled AND NOT state.legacy_writes_enabled INTO v_active
  FROM public.financial_cutover_instance_state state WHERE state.singleton;
  IF NOT coalesce(v_active,false) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME IN('payments','monthly_cycles','monthly_cycle_bookkeeping_credits') THEN
    RAISE EXCEPTION 'legacy_financial_writes_retired';
  ELSIF TG_TABLE_NAME='user_withdrawal_requests' THEN
    IF TG_OP='DELETE' OR NEW.request_hash IS NULL OR NEW.project_id IS NULL OR NEW.financial_asset_id IS NULL THEN
      RAISE EXCEPTION 'legacy_withdrawal_writes_retired';
    END IF;
  ELSIF TG_TABLE_NAME='payout_intents' THEN
    IF TG_OP='DELETE' OR NEW.withdrawal_request_id IS NULL OR NEW.source_result_id IS NOT NULL THEN
      RAISE EXCEPTION 'legacy_payout_intent_writes_retired';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER financial_cutover_monthly_cycles_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.monthly_cycles
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_cutover_legacy_write_boundary();
