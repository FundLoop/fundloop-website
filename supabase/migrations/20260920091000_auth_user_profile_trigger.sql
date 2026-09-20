-- public.create_user_profile() is defined by the migrations, but the trigger that fires it was
-- never created by one: initial_remote.sql is a dump of the public schema, and the trigger lives
-- on auth.users. FundLoop Dev has it out of band, so new sign-ups get a public.users row there,
-- while a freshly migrated database (FundLoop Prod) would never create profiles.
-- Idempotent, and a no-op where the trigger already exists.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- Backfill profiles for accounts that signed up before the trigger existed.
INSERT INTO public.users (user_id, created_at, updated_at, status, primary_email_identity)
SELECT account.id, now(), now(), 'inactive',
  (SELECT identity.id FROM auth.identities identity WHERE identity.user_id = account.id
   ORDER BY (identity.provider = 'email') DESC, identity.created_at ASC LIMIT 1)
FROM auth.users account
WHERE NOT EXISTS (SELECT 1 FROM public.users profile WHERE profile.user_id = account.id)
ON CONFLICT (user_id) DO NOTHING;
