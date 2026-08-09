CREATE OR REPLACE FUNCTION public.post_shadow_financial_journal(p_event_id bigint,p_ledger_transaction_id bigint,p_journal_type text,p_comparison_status text,p_detail jsonb,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint;v_nd numeric;v_nc numeric;v_fd numeric;v_fc numeric;v_event public.external_financial_events%ROWTYPE;
BEGIN
 IF lower(coalesce(p_deployment_environment,''))NOT IN('local','dev','test')THEN RAISE EXCEPTION'shadow_reconciliation_disabled';END IF;
 SELECT * INTO v_event FROM public.external_financial_events WHERE id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION'shadow_journal_event_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id)
   OR EXISTS(SELECT 1 FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id AND(asset_id IS DISTINCT FROM v_event.asset_id OR custody_account_id IS DISTINCT FROM v_event.custody_account_id))
   OR(SELECT count(DISTINCT asset_id)FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id)<>1
   OR(SELECT count(DISTINCT custody_account_id)FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id)<>1
 THEN RAISE EXCEPTION'shadow_journal_event_ledger_context_mismatch';END IF;
 SELECT coalesce(sum(native_atomic_amount)FILTER(WHERE side='debit'),0),coalesce(sum(native_atomic_amount)FILTER(WHERE side='credit'),0),coalesce(sum(functional_usd_amount)FILTER(WHERE side='debit'),0),coalesce(sum(functional_usd_amount)FILTER(WHERE side='credit'),0)INTO v_nd,v_nc,v_fd,v_fc FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id;
 IF v_nd=0 OR v_nd<>v_nc OR v_fd<>v_fc THEN RAISE EXCEPTION'shadow_journal_ledger_unbalanced';END IF;
 INSERT INTO public.shadow_financial_journals(event_id,ledger_transaction_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,comparison_detail,evidence_hash)VALUES(p_event_id,p_ledger_transaction_id,p_journal_type,v_nd,v_nc,v_fd,v_fc,p_comparison_status,coalesce(p_detail,'{}'),p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;
