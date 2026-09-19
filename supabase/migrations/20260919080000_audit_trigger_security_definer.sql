-- log_changes() is the audit trigger on projects, wallet_accounts, users, payments, and other
-- legacy tables. It ran as the calling role, so client writes to those tables needed INSERT
-- on audit_log. 20260918120000 correctly revoked that, which made signed-in wallet changes
-- fail inside the trigger. Audit logging is trusted internal bookkeeping: run it as the
-- owner with a pinned search_path (the body only references schema-qualified objects).

ALTER FUNCTION public.log_changes() SECURITY DEFINER;
ALTER FUNCTION public.log_changes() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.log_changes() FROM PUBLIC, anon, authenticated;
