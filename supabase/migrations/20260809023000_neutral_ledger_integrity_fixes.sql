ALTER TABLE public.financial_custody_accounts
ADD CONSTRAINT financial_custody_accounts_asset_id_id_key UNIQUE (asset_id, id);

ALTER TABLE public.financial_references
ADD CONSTRAINT financial_references_asset_custody_fkey
FOREIGN KEY (asset_id, custody_account_id)
REFERENCES public.financial_custody_accounts (asset_id, id)
ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE FUNCTION public.validate_ledger_transaction_effective_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.accounting_periods period
    WHERE period.id = NEW.accounting_period_id
      AND NEW.effective_at >= period.starts_at
      AND NEW.effective_at < period.ends_at
  ) THEN
    RAISE EXCEPTION 'ledger_effective_at_outside_period';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ledger_transactions_effective_period_guard
BEFORE INSERT ON public.ledger_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_ledger_transaction_effective_period();

REVOKE ALL ON FUNCTION public.validate_ledger_transaction_effective_period()
FROM PUBLIC, anon, authenticated, service_role;
