ALTER TABLE public.payment_methods
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

WITH ranked_methods AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id
      ORDER BY
        COALESCE(is_default, false) DESC,
        id ASC
    ) AS next_sort_order
  FROM public.payment_methods
)
UPDATE public.payment_methods AS payment_methods
SET sort_order = ranked_methods.next_sort_order
FROM ranked_methods
WHERE ranked_methods.id = payment_methods.id;

CREATE INDEX idx_payment_methods_project_sort_order
ON public.payment_methods (project_id, sort_order);

DO $$
DECLARE
  v_crypto_contract_method_id integer;
BEGIN
  SELECT id
  INTO v_crypto_contract_method_id
  FROM public.ref_payment_methods
  WHERE code = 'crypto_contract'
  LIMIT 1;

  IF v_crypto_contract_method_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.projects AS projects
  SET default_payment_method_id = v_crypto_contract_method_id
  WHERE EXISTS (
    SELECT 1
    FROM public.payment_methods AS payment_methods
    WHERE payment_methods.project_id = projects.id
      AND payment_methods.collection_mode = 'contract'
      AND payment_methods.is_enabled = true
  );

  UPDATE public.projects
  SET default_payment_method_id = NULL
  WHERE default_payment_method_id = v_crypto_contract_method_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.payment_methods AS payment_methods
      WHERE payment_methods.project_id = projects.id
        AND payment_methods.collection_mode = 'contract'
        AND payment_methods.is_enabled = true
    );
END
$$;
