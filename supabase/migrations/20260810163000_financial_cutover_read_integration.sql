-- Complete the reversible local/dev financial cutover read boundary.
-- Monthly-cycle lifecycle remains an input to the canonical epoch engine, so
-- only legacy monetary records are retired when canonical reads are active.

DROP TRIGGER IF EXISTS financial_cutover_monthly_cycles_write_guard ON public.monthly_cycles;

CREATE VIEW public.financial_cutover_canonical_credit_reads
WITH (security_invoker=true) AS
SELECT
  credit.id,
  credit.user_id,
  credit.monthly_cycle_id,
  credit.run_id,
  credit.source_result_id,
  (obligation.total_minor / 100.0)::numeric AS usd_equivalent_amount,
  credit.currency_code,
  credit.status,
  CASE
    WHEN obligation.state IN ('paid', 'closed') THEN 'paid'
    ELSE 'not_paid'
  END AS payment_status,
  credit.credited_at,
  credit.asset_fills,
  credit.source_breakdown,
  credit.allocation_breakdown,
  obligation.id AS canonical_obligation_id,
  obligation.state AS canonical_state,
  'canonical_liability'::text AS read_source
FROM public.user_withdrawal_obligations obligation
JOIN public.monthly_cycle_bookkeeping_credits credit
  ON credit.id = obligation.source_bookkeeping_credit_id
WHERE obligation.source_bookkeeping_credit_id IS NOT NULL;

REVOKE ALL ON TABLE public.financial_cutover_canonical_credit_reads
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.financial_cutover_canonical_credit_reads TO service_role;
