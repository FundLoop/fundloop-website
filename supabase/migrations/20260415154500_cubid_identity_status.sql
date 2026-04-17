DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'cubid_identity_status'
  ) THEN
    CREATE TYPE public.cubid_identity_status AS ENUM ('unlinked', 'linked', 'verified');
  END IF;
END
$$;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS cubid_identity_status public.cubid_identity_status
NOT NULL
DEFAULT 'unlinked';

UPDATE public.users
SET cubid_identity_status = CASE
  WHEN cubid_id IS NOT NULL THEN 'linked'::public.cubid_identity_status
  ELSE 'unlinked'::public.cubid_identity_status
END
WHERE cubid_identity_status IS DISTINCT FROM CASE
  WHEN cubid_id IS NOT NULL THEN 'linked'::public.cubid_identity_status
  ELSE 'unlinked'::public.cubid_identity_status
END;
