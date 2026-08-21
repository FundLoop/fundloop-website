ALTER TABLE public.cubid_identity_snapshots
ADD COLUMN IF NOT EXISTS primary_name text;
