-- Repair Preview/dev databases that missed the project payment route ordering
-- column even though the app now treats it as part of the payment_methods
-- contract. This is intentionally idempotent for already-correct targets.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

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
WHERE ranked_methods.id = payment_methods.id
  AND payment_methods.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_payment_methods_project_sort_order
ON public.payment_methods (project_id, sort_order);

DO $$
DECLARE
  identity_column record;
  next_identity_value bigint;
  sequence_name text;
BEGIN
  FOR identity_column IN
    SELECT *
    FROM (
      VALUES
        ('public.organizations', 'id'),
        ('public.projects', 'id'),
        ('public.payment_methods', 'id'),
        ('public.payments', 'id'),
        ('public.onchain_payment_submissions', 'id')
    ) AS identity_columns(table_name, column_name)
  LOOP
    sequence_name := pg_get_serial_sequence(identity_column.table_name, identity_column.column_name);

    IF sequence_name IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT COALESCE(MAX(%I), 0) + 1 FROM %s',
      identity_column.column_name,
      identity_column.table_name
    )
    INTO next_identity_value;

    EXECUTE 'SELECT setval($1::regclass, $2, false)'
    USING sequence_name, GREATEST(next_identity_value, 1);
  END LOOP;
END $$;
