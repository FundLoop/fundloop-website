ALTER TABLE public.shadow_financial_journals ADD COLUMN ledger_transaction_id bigint UNIQUE REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE VIEW public.shadow_ledger_trial_balance WITH(security_invoker=true) AS
SELECT t.accounting_period_id,t.id ledger_transaction_id,p.account_id,p.asset_id,p.custody_account_id,
 sum(CASE WHEN p.side='debit'THEN p.native_atomic_amount ELSE-p.native_atomic_amount END) native_atomic_balance,
 sum(CASE WHEN p.side='debit'THEN p.functional_usd_amount ELSE-p.functional_usd_amount END) functional_usd_balance
FROM public.ledger_transactions t JOIN public.ledger_postings p ON p.transaction_id=t.id
GROUP BY t.accounting_period_id,t.id,p.account_id,p.asset_id,p.custody_account_id;
REVOKE ALL ON TABLE public.shadow_ledger_trial_balance FROM PUBLIC,anon,authenticated;GRANT SELECT ON TABLE public.shadow_ledger_trial_balance TO service_role;

DROP FUNCTION public.post_shadow_financial_journal(bigint,text,numeric,numeric,text,jsonb,text,text);
CREATE FUNCTION public.post_shadow_financial_journal(p_event_id bigint,p_ledger_transaction_id bigint,p_journal_type text,p_comparison_status text,p_detail jsonb,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint;v_nd numeric;v_nc numeric;v_fd numeric;v_fc numeric;
BEGIN
 IF lower(coalesce(p_deployment_environment,''))NOT IN('local','dev','test')THEN RAISE EXCEPTION'shadow_reconciliation_disabled';END IF;
 SELECT coalesce(sum(native_atomic_amount)FILTER(WHERE side='debit'),0),coalesce(sum(native_atomic_amount)FILTER(WHERE side='credit'),0),coalesce(sum(functional_usd_amount)FILTER(WHERE side='debit'),0),coalesce(sum(functional_usd_amount)FILTER(WHERE side='credit'),0)INTO v_nd,v_nc,v_fd,v_fc FROM public.ledger_postings WHERE transaction_id=p_ledger_transaction_id;
 IF v_nd=0 OR v_nd<>v_nc OR v_fd<>v_fc THEN RAISE EXCEPTION'shadow_journal_ledger_unbalanced';END IF;
 INSERT INTO public.shadow_financial_journals(event_id,ledger_transaction_id,journal_type,native_debits,native_credits,functional_debits,functional_credits,comparison_status,comparison_detail,evidence_hash)VALUES(p_event_id,p_ledger_transaction_id,p_journal_type,v_nd,v_nc,v_fd,v_fc,p_comparison_status,coalesce(p_detail,'{}'),p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;

DROP FUNCTION public.record_custody_reconciliation(bigint,bigint,numeric,numeric,numeric,timestamptz,text,text);
CREATE FUNCTION public.record_custody_reconciliation(p_custody_account_id bigint,p_asset_id bigint,p_provider_native numeric,p_tolerance numeric,p_observed_at timestamptz,p_evidence_hash text,p_deployment_environment text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_shadow numeric;v_variance numeric;v_id bigint;
BEGIN
 IF lower(coalesce(p_deployment_environment,''))NOT IN('local','dev','test')THEN RAISE EXCEPTION'shadow_reconciliation_disabled';END IF;
 SELECT coalesce(sum(CASE WHEN p.side='debit'THEN p.native_atomic_amount ELSE-p.native_atomic_amount END),0)INTO v_shadow FROM public.ledger_postings p JOIN public.ledger_accounts a ON a.id=p.account_id WHERE p.custody_account_id=p_custody_account_id AND p.asset_id=p_asset_id AND a.normal_balance='debit';
 v_variance:=p_provider_native-v_shadow;
 INSERT INTO public.custody_reconciliation_snapshots(custody_account_id,asset_id,provider_native_balance,shadow_native_balance,tolerance_native_amount,variance_native_amount,variance_classification,observed_at,evidence_hash)VALUES(p_custody_account_id,p_asset_id,p_provider_native,v_shadow,p_tolerance,v_variance,CASE WHEN v_variance=0 THEN'exact' WHEN abs(v_variance)<=p_tolerance THEN'within_tolerance' ELSE'outside_tolerance' END,p_observed_at,p_evidence_hash)RETURNING id INTO v_id;RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.post_shadow_financial_journal(bigint,bigint,text,text,jsonb,text,text),public.record_custody_reconciliation(bigint,bigint,numeric,numeric,timestamptz,text,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_shadow_financial_journal(bigint,bigint,text,text,jsonb,text,text),public.record_custody_reconciliation(bigint,bigint,numeric,numeric,timestamptz,text,text)TO service_role;
