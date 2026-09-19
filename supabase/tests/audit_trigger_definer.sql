\set ON_ERROR_STOP on

-- A signed-in user's own wallet insert must succeed even though clients cannot write audit_log.
BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'audit-trigger@example.test', now(), now());
INSERT INTO public.users (user_id, display_name, email, status)
VALUES ('20000000-0000-4000-8000-000000000001', 'Audit Trigger', 'audit-trigger@example.test', 'active');

DO $$
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.log_changes()'::regprocedure) THEN
    RAISE EXCEPTION 'log_changes must be SECURITY DEFINER';
  END IF;
  IF has_table_privilege('authenticated', 'public.audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'clients must not be able to write audit_log directly';
  END IF;
END $$;

-- Hosted projects grant sequence usage by default; local replay images may not. Mirror the
-- hosted default inside this rolled-back transaction so the test exercises the trigger only.
DO $$
DECLARE
  v_sequence text := pg_get_serial_sequence('public.wallet_accounts', 'id');
BEGIN
  IF v_sequence IS NOT NULL AND NOT has_sequence_privilege('authenticated', v_sequence, 'USAGE') THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', v_sequence);
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.wallet_accounts (user_id, wallet_address, wallet_type, wallet_name, is_primary)
VALUES ('20000000-0000-4000-8000-000000000001', '0x1111111111111111111111111111111111111111', 'ethereum', 'Audit test', true);

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE table_name = 'wallet_accounts' AND action = 'INSERT'
      AND user_id = '20000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'audit row for the signed-in wallet insert is missing';
  END IF;
END $$;

ROLLBACK;
