CREATE FUNCTION public.reject_shadow_financial_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'shadow_financial_append_only'; END $$;
CREATE TRIGGER external_financial_events_immutable BEFORE UPDATE OR DELETE ON public.external_financial_events FOR EACH ROW EXECUTE FUNCTION public.reject_shadow_financial_mutation();
CREATE TRIGGER external_funding_applications_immutable BEFORE UPDATE OR DELETE ON public.external_funding_applications FOR EACH ROW EXECUTE FUNCTION public.reject_shadow_financial_mutation();

CREATE OR REPLACE FUNCTION public.ingest_external_financial_event(
 p_provider_key text,p_provider_event_id text,p_custody_account_id bigint,p_asset_id bigint,p_event_type text,p_provider_sequence bigint,
 p_settled_native_amount numeric,p_occurred_at timestamptz,p_evidence_hash text,p_legacy_timestamp_evidence jsonb,p_deployment_environment text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing public.external_financial_events%ROWTYPE;v_id bigint;v_order text;v_legacy jsonb:=coalesce(p_legacy_timestamp_evidence,'{}');
BEGIN
 IF lower(coalesce(p_deployment_environment,'')) NOT IN('local','dev','test') THEN RAISE EXCEPTION 'shadow_reconciliation_disabled';END IF;
 SELECT * INTO v_existing FROM public.external_financial_events WHERE provider_key=p_provider_key AND provider_event_id=p_provider_event_id;
 IF FOUND THEN
  IF v_existing.custody_account_id<>p_custody_account_id OR v_existing.asset_id<>p_asset_id OR v_existing.event_type<>p_event_type OR v_existing.provider_sequence IS DISTINCT FROM p_provider_sequence OR v_existing.settled_native_amount<>p_settled_native_amount OR v_existing.occurred_at<>p_occurred_at OR v_existing.evidence_hash<>p_evidence_hash OR v_existing.legacy_timestamp_evidence<>v_legacy THEN RAISE EXCEPTION 'external_event_dedupe_conflict';END IF;RETURN v_existing.id;
 END IF;
 v_order:=CASE WHEN p_provider_sequence IS NULL THEN'unsequenced' WHEN EXISTS(SELECT 1 FROM public.external_financial_events WHERE provider_key=p_provider_key AND custody_account_id=p_custody_account_id AND provider_sequence>=p_provider_sequence) THEN'out_of_order' ELSE'in_order' END;
 INSERT INTO public.external_financial_events(provider_key,provider_event_id,custody_account_id,asset_id,event_type,provider_sequence,settled_native_amount,occurred_at,ordering_status,evidence_hash,legacy_timestamp_evidence) VALUES(p_provider_key,p_provider_event_id,p_custody_account_id,p_asset_id,p_event_type,p_provider_sequence,p_settled_native_amount,p_occurred_at,v_order,p_evidence_hash,v_legacy) RETURNING id INTO v_id;RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_external_funding(p_event_id bigint,p_financial_reference_id bigint,p_native_amount numeric,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.external_financial_events%ROWTYPE;v_ref public.financial_references%ROWTYPE;v_id bigint;v_applied numeric;
BEGIN
 IF lower(coalesce(p_deployment_environment,'')) NOT IN('local','dev','test') THEN RAISE EXCEPTION 'shadow_reconciliation_disabled';END IF;
 SELECT * INTO v_event FROM public.external_financial_events WHERE id=p_event_id FOR UPDATE;SELECT * INTO v_ref FROM public.financial_references WHERE id=p_financial_reference_id;
 IF v_event.id IS NULL OR v_ref.id IS NULL OR v_event.asset_id<>v_ref.asset_id OR v_event.custody_account_id<>v_ref.custody_account_id THEN RAISE EXCEPTION 'funding_application_reference_mismatch';END IF;
 SELECT coalesce(sum(applied_native_amount),0) INTO v_applied FROM public.external_funding_applications WHERE event_id=p_event_id;
 IF v_applied+p_native_amount>v_event.settled_native_amount THEN RAISE EXCEPTION 'funding_application_exceeds_settled_native';END IF;
 INSERT INTO public.external_funding_applications(event_id,financial_reference_id,applied_native_amount,evidence_hash)VALUES(p_event_id,p_financial_reference_id,p_native_amount,p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;

CREATE FUNCTION public.record_custody_reconciliation(p_custody_account_id bigint,p_asset_id bigint,p_provider_native numeric,p_shadow_native numeric,p_tolerance numeric,p_observed_at timestamptz,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_variance numeric:=p_provider_native-p_shadow_native;v_id bigint;
BEGIN
 IF lower(coalesce(p_deployment_environment,'')) NOT IN('local','dev','test') THEN RAISE EXCEPTION 'shadow_reconciliation_disabled';END IF;
 INSERT INTO public.custody_reconciliation_snapshots(custody_account_id,asset_id,provider_native_balance,shadow_native_balance,tolerance_native_amount,variance_native_amount,variance_classification,observed_at,evidence_hash)
 VALUES(p_custody_account_id,p_asset_id,p_provider_native,p_shadow_native,p_tolerance,v_variance,CASE WHEN v_variance=0 THEN'exact' WHEN abs(v_variance)<=p_tolerance THEN'within_tolerance' ELSE'outside_tolerance' END,p_observed_at,p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;

CREATE FUNCTION public.post_shadow_financial_journal(p_event_id bigint,p_journal_type text,p_native_amount numeric,p_functional_amount numeric,p_comparison_status text,p_detail jsonb,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint;
BEGIN
 IF lower(coalesce(p_deployment_environment,'')) NOT IN('local','dev','test') OR p_native_amount<0 OR p_functional_amount<0 THEN RAISE EXCEPTION 'shadow_reconciliation_disabled';END IF;
 INSERT INTO public.shadow_financial_journals(event_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,comparison_detail,evidence_hash)VALUES(p_event_id,p_journal_type,p_native_amount,p_native_amount,p_functional_amount,p_functional_amount,p_comparison_status,coalesce(p_detail,'{}'),p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;

CREATE OR REPLACE VIEW public.shadow_financial_reconciliation_observability WITH(security_invoker=true) AS
SELECT e.id event_id,e.provider_key,e.provider_event_id,e.event_type,e.ordering_status,e.settled_native_amount,coalesce(a.applied_native_amount,0) applied_native_amount,e.settled_native_amount-coalesce(a.applied_native_amount,0) unmatched_native_amount,e.occurred_at,e.observed_at,e.legacy_timestamp_evidence,
 j.journal_count,j.suspense_count,r.variance_native_amount,r.variance_classification,c.close_package_status
FROM public.external_financial_events e LEFT JOIN LATERAL(SELECT sum(applied_native_amount)applied_native_amount FROM public.external_funding_applications WHERE event_id=e.id)a ON true
LEFT JOIN LATERAL(SELECT count(*)journal_count,count(*)FILTER(WHERE comparison_status IN('unmatched','suspense'))suspense_count FROM public.shadow_financial_journals WHERE event_id=e.id)j ON true
LEFT JOIN LATERAL(SELECT variance_native_amount,variance_classification FROM public.custody_reconciliation_snapshots WHERE custody_account_id=e.custody_account_id AND asset_id=e.asset_id ORDER BY observed_at DESC LIMIT 1)r ON true
LEFT JOIN LATERAL(SELECT status close_package_status FROM public.shadow_close_packages ORDER BY created_at DESC LIMIT 1)c ON true;

REVOKE ALL ON FUNCTION public.record_custody_reconciliation(bigint,bigint,numeric,numeric,numeric,timestamptz,text,text),public.post_shadow_financial_journal(bigint,text,numeric,numeric,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_custody_reconciliation(bigint,bigint,numeric,numeric,numeric,timestamptz,text,text),public.post_shadow_financial_journal(bigint,text,numeric,numeric,text,jsonb,text,text) TO service_role;
