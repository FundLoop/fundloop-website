-- Newer Supabase projects (FundLoop Prod) ship an `ensure_rls` event trigger that enables RLS on
-- every table created in public. Older projects (FundLoop Dev) and local images do not, so these
-- service-only tables ended up with RLS on in Production and off everywhere else, which fails the
-- deploy's public-schema parity check.
--
-- Production's state is the safer one, so make it explicit everywhere. These tables have no client
-- grants; the service role and the owning role bypass RLS, so access is unchanged. No policies are
-- added deliberately: any client reaching them should be denied.

ALTER TABLE public.base_payout_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_close_root_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_deploy_completion_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_deploy_migration_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_runtime_controls ENABLE ROW LEVEL SECURITY;
