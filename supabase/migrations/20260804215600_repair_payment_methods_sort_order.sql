-- Repair Preview/dev databases that missed the project payment route ordering
-- column even though the app now treats it as part of the payment_methods
-- contract. This is intentionally idempotent for already-correct targets.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payment_methods_project_sort_order
ON public.payment_methods (project_id, sort_order);
