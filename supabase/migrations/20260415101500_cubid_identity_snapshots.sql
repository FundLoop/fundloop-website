CREATE TABLE IF NOT EXISTS public.cubid_identity_snapshots (
  user_id uuid PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  cubid_user_id text NOT NULL UNIQUE,
  primary_email text,
  primary_phone text,
  cubid_score numeric,
  available_stamp_types text[] NOT NULL DEFAULT '{}'::text[],
  verified_stamp_types text[] NOT NULL DEFAULT '{}'::text[],
  raw_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_stamps jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz,
  last_sync_error_code text,
  last_sync_error_message text
);

ALTER TABLE public.cubid_identity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cubid snapshot" ON public.cubid_identity_snapshots;

CREATE POLICY "Users can view own cubid snapshot"
ON public.cubid_identity_snapshots
FOR SELECT
USING (auth.uid() = user_id);
