-- Force Supabase/PostgREST to refresh its schema cache after the remote
-- payment_methods.sort_order repair migration. Without this notification,
-- REST inserts can still reject the repaired column until the cache expires.
NOTIFY pgrst, 'reload schema';
