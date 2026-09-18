-- Security stopgap: these legacy public tables were created without RLS while anon and
-- authenticated held full table privileges, so anyone with the public API key could insert,
-- update, delete, or truncate rows. Remove every client write privilege, then grant back
-- only the writes the app performs through user-role clients (audited 2026-09-18).
-- SELECT is intentionally unchanged here; read access is narrowed by the follow-up RLS policy work.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.audit_log,
  public.blog_posts,
  public.chain_intake_contracts,
  public.debug_log,
  public.invitation_codes,
  public.monthly_network_stats,
  public.newsletter_subscribers,
  public.onchain_payment_submissions,
  public.organization_invitations,
  public.organization_members,
  public.organizations,
  public.participants,
  public.payment_methods,
  public.payments,
  public.project_categories,
  public.project_stats_monthly,
  public.project_stats_yearly,
  public.project_users,
  public.projects,
  public.ref_categories,
  public.ref_chain_assets,
  public.ref_chains,
  public.ref_genders,
  public.ref_interests,
  public.ref_invitation_statuses,
  public.ref_locations,
  public.ref_notification_types,
  public.ref_occupations,
  public.ref_payment_methods,
  public.ref_payment_periodicities,
  public.ref_payment_statuses,
  public.ref_roles,
  public.ref_skills,
  public.ref_social_platforms,
  public.supabase_deploy_context,
  public.support_requests,
  public.team_roles,
  public.user_interests,
  public.user_notifications,
  public.user_skills,
  public.user_social_platforms,
  public.users,
  public.wallet_accounts,
  public.wallet_connections
FROM anon, authenticated;

-- Public forms (newsletter signup and support requests may be submitted signed out).
GRANT INSERT ON TABLE public.newsletter_subscribers, public.support_requests TO anon, authenticated;

-- Signed-in flows: invitations, membership acceptance, project signup, wallets, notifications.
GRANT INSERT, UPDATE ON TABLE public.organization_invitations TO authenticated;
GRANT INSERT ON TABLE public.organization_members, public.projects TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.wallet_accounts TO authenticated;
GRANT UPDATE ON TABLE public.user_notifications TO authenticated;

-- These SECURITY DEFINER functions soft-delete any user or organization by id without an
-- authorization check. Internal admins are an application-side email allowlist, so the
-- database cannot authorize them here; admin deletion moves server-side in the RLS follow-up.
REVOKE EXECUTE ON FUNCTION public.soft_delete_users(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_organizations(bigint) FROM PUBLIC, anon, authenticated;
