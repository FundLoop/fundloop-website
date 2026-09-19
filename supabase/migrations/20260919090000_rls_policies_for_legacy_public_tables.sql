-- Row-level security for the legacy public tables that were created without it.
-- Replaces the write-only stopgap (20260918120000) with an explicit, least-privilege model:
-- every table gets RLS and a clean grant slate, then only the audited client accesses are
-- granted back. Explicit grants make behaviour identical across hosted projects and local
-- images, whose default privileges differ. Server code using the service role is unaffected.

-- Helpers -------------------------------------------------------------------------------
-- SECURITY DEFINER so policies on participants/projects can consult those tables without
-- recursing through their own policies. Each is keyed to the caller's JWT via auth.uid().

CREATE OR REPLACE FUNCTION public.rls_is_public_project(p_project_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects project
    WHERE project.id = p_project_id
      AND project.status = 'active'
      AND project.is_public
      AND project.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.rls_is_project_member(p_project_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.participants participant
      WHERE participant.project_id = p_project_id AND participant.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects project
      JOIN public.organization_members member
        ON member.organization_id = project.organization_id
       AND member.user_id = auth.uid()
       AND member.status = 'active'
       AND member.deleted_at IS NULL
      WHERE project.id = p_project_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rls_is_project_admin(p_project_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_project_financial_admin(auth.uid(), p_project_id);
$$;

REVOKE ALL ON FUNCTION public.rls_is_public_project(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_is_project_member(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_is_project_admin(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_is_public_project(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rls_is_project_member(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rls_is_project_admin(bigint) TO anon, authenticated, service_role;

-- Clean slate ----------------------------------------------------------------------------
-- These tables carry dormant legacy policies (some USING (true), including one on payments
-- for anon/authenticated) that would activate with RLS; policies are OR'd, so they must go.

DO $$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policy.schemaname, policy.tablename, policy.policyname
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = ANY (ARRAY[
        'audit_log', 'blog_posts', 'chain_intake_contracts', 'debug_log', 'invitation_codes',
        'monthly_network_stats', 'newsletter_subscribers', 'onchain_payment_submissions',
        'organization_invitations', 'organization_members', 'organizations', 'participants',
        'payment_methods', 'payments', 'project_categories', 'project_stats_monthly',
        'project_stats_yearly', 'project_users', 'projects', 'ref_categories', 'ref_chain_assets',
        'ref_chains', 'ref_genders', 'ref_interests', 'ref_invitation_statuses', 'ref_locations',
        'ref_notification_types', 'ref_occupations', 'ref_payment_methods',
        'ref_payment_periodicities', 'ref_payment_statuses', 'ref_roles', 'ref_skills',
        'ref_social_platforms', 'support_requests', 'team_roles', 'user_interests',
        'user_notifications', 'user_skills', 'user_social_platforms', 'users', 'wallet_accounts',
        'wallet_connections', 'supabase_deploy_context'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'audit_log', 'blog_posts', 'chain_intake_contracts', 'debug_log', 'invitation_codes',
    'monthly_network_stats', 'newsletter_subscribers', 'onchain_payment_submissions',
    'organization_invitations', 'organization_members', 'organizations', 'participants',
    'payment_methods', 'payments', 'project_categories', 'project_stats_monthly',
    'project_stats_yearly', 'project_users', 'projects', 'ref_categories', 'ref_chain_assets',
    'ref_chains', 'ref_genders', 'ref_interests', 'ref_invitation_statuses', 'ref_locations',
    'ref_notification_types', 'ref_occupations', 'ref_payment_methods',
    'ref_payment_periodicities', 'ref_payment_statuses', 'ref_roles', 'ref_skills',
    'ref_social_platforms', 'support_requests', 'team_roles', 'user_interests',
    'user_notifications', 'user_skills', 'user_social_platforms', 'users', 'wallet_accounts',
    'wallet_connections'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_table);
  END LOOP;

  -- Created by the deploy workflow rather than a migration; exists only where it has run.
  IF to_regclass('public.supabase_deploy_context') IS NOT NULL THEN
    ALTER TABLE public.supabase_deploy_context ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.supabase_deploy_context FROM anon, authenticated;
  END IF;
END $$;

-- Public reference and content data: readable by everyone, never writable by clients. ------

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'blog_posts', 'chain_intake_contracts', 'monthly_network_stats', 'project_categories',
    'team_roles', 'ref_categories', 'ref_chain_assets', 'ref_chains', 'ref_genders',
    'ref_interests', 'ref_invitation_statuses', 'ref_locations', 'ref_notification_types',
    'ref_occupations', 'ref_payment_methods', 'ref_payment_periodicities',
    'ref_payment_statuses', 'ref_roles', 'ref_skills', 'ref_social_platforms'
  ] LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', v_table);
    EXECUTE format('DROP POLICY IF EXISTS public_read ON public.%I', v_table);
    EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', v_table);
  END LOOP;
END $$;

-- Projects: public active projects for everyone; members also see their own projects. ------

GRANT SELECT ON TABLE public.projects TO anon, authenticated;
CREATE POLICY projects_visible ON public.projects FOR SELECT TO anon, authenticated
  USING ((status = 'active' AND is_public AND deleted_at IS NULL) OR public.rls_is_project_member(id));

-- Project admins may toggle visibility (components/project-visibility-toggle.tsx).
GRANT UPDATE (is_public, updated_by, updated_at) ON TABLE public.projects TO authenticated;
CREATE POLICY projects_admin_visibility ON public.projects FOR UPDATE TO authenticated
  USING (public.rls_is_project_admin(id))
  WITH CHECK (public.rls_is_project_admin(id) AND (updated_by IS NULL OR updated_by = auth.uid()));

-- Participants: memberships of public projects are public; members see their own projects. -

GRANT SELECT ON TABLE public.participants TO anon, authenticated;
CREATE POLICY participants_visible ON public.participants FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.rls_is_public_project(project_id)
    OR public.rls_is_project_member(project_id)
  );

-- Personal rows: owner only. Public profile data is served by public_user_profiles. -------

GRANT SELECT ON TABLE public.users TO authenticated;
CREATE POLICY users_own_row ON public.users FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.organization_members TO authenticated;
CREATE POLICY organization_members_own_rows ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['user_interests', 'user_skills', 'user_social_platforms', 'user_notifications'] LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('CREATE POLICY own_rows ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', v_table);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON TABLE public.wallet_accounts TO authenticated;
GRANT UPDATE (is_primary, is_removed, wallet_name, updated_at, updated_by) ON TABLE public.wallet_accounts TO authenticated;
CREATE POLICY wallet_accounts_own_select ON public.wallet_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY wallet_accounts_own_insert ON public.wallet_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY wallet_accounts_own_update ON public.wallet_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Project finances: project admins only (payments page and founder workspace). ------------

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['payments', 'payment_methods', 'project_stats_monthly'] LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('CREATE POLICY project_admin_read ON public.%I FOR SELECT TO authenticated USING (public.rls_is_project_admin(project_id))', v_table);
  END LOOP;
END $$;

-- Public forms: insert only, never readable by clients. -----------------------------------

GRANT INSERT ON TABLE public.support_requests TO anon, authenticated;
CREATE POLICY support_requests_submit ON public.support_requests FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

GRANT INSERT ON TABLE public.newsletter_subscribers TO anon, authenticated;
CREATE POLICY newsletter_subscribers_submit ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Client inserts need the id sequence where the column is serial (identity columns do not).
DO $$
DECLARE
  v_target record;
  v_sequence text;
BEGIN
  FOR v_target IN
    SELECT * FROM (VALUES
      ('wallet_accounts', 'authenticated'),
      ('support_requests', 'anon, authenticated'),
      ('newsletter_subscribers', 'anon, authenticated')
    ) AS target(table_name, roles)
  LOOP
    v_sequence := pg_get_serial_sequence(format('public.%I', v_target.table_name), 'id');
    IF v_sequence IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO %s', v_sequence, v_target.roles);
    END IF;
  END LOOP;
END $$;

-- Server-only (no client grants): audit_log, debug_log, invitation_codes,
-- onchain_payment_submissions, organization_invitations, organizations, project_stats_yearly,
-- project_users, wallet_connections, supabase_deploy_context.

-- Consent-filtered public profiles ----------------------------------------------------------
-- Mirrors list_discoverable_public_user_ids: latest review-status consent must be a grant and
-- the profile public and active. Only consented fields are exposed; email never is.

CREATE OR REPLACE VIEW public.public_user_profiles WITH (security_barrier = true) AS
SELECT
  profile.user_id,
  CASE WHEN latest.fields ? 'display_name' THEN profile.display_name END AS display_name,
  CASE WHEN latest.fields ? 'headline' THEN profile.profile_headline END AS profile_headline,
  CASE WHEN latest.fields ? 'avatar' THEN profile.avatar_url END AS avatar_url,
  CASE WHEN latest.fields ? 'location' THEN profile.location_id END AS location_id,
  latest.fields
FROM (
  SELECT DISTINCT ON (consent.user_id) consent.user_id, consent.action, consent.fields
  FROM public.profile_publication_consents consent
  WHERE consent.document_status = 'review'
  ORDER BY consent.user_id, consent.recorded_at DESC, consent.id DESC
) latest
JOIN public.users profile ON profile.user_id = latest.user_id
WHERE latest.action = 'grant'
  AND profile.is_public
  AND profile.status = 'active'
  AND profile.deleted_at IS NULL;

REVOKE ALL ON public.public_user_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_user_profiles TO anon, authenticated;

-- Active members of projects the caller may see, without exposing users rows. --------------

CREATE OR REPLACE VIEW public.project_active_members WITH (security_barrier = true) AS
SELECT participant.project_id, participant.user_id, participant.is_admin
FROM public.participants participant
JOIN public.users member
  ON member.user_id = participant.user_id
 AND member.status = 'active'
 AND member.deleted_at IS NULL
WHERE public.rls_is_public_project(participant.project_id)
   OR public.rls_is_project_member(participant.project_id);

REVOKE ALL ON public.project_active_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_active_members TO anon, authenticated;

-- Onboarding project search: project-level contact only, no personal data. ----------------

CREATE OR REPLACE FUNCTION public.search_projects_for_team_member(p_query text)
RETURNS TABLE (id bigint, name text, slug text, description text, website text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_term text := replace(replace(btrim(coalesce(p_query, '')), '%', ''), '_', '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication_required';
  END IF;
  IF length(v_term) < 2 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT project.id, project.name, project.slug, project.description, project.website, project.email
  FROM public.projects project
  WHERE project.deleted_at IS NULL
    AND project.status = 'active'
    AND (project.name ILIKE '%' || v_term || '%' OR project.slug ILIKE '%' || v_term || '%')
  ORDER BY project.name, project.id
  LIMIT 6;
END;
$$;

REVOKE ALL ON FUNCTION public.search_projects_for_team_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_projects_for_team_member(text) TO authenticated, service_role;

-- Invitation preview for the public join page: one exact code, no enumeration. -------------

CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_code text)
RETURNS TABLE (code text, max_uses integer, usage_count integer, expires_at timestamptz, inviter_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT invitation.code, invitation.max_uses, invitation.usage_count, invitation.expires_at,
    coalesce(nullif(btrim(inviter.display_name), ''), inviter.full_name)
  FROM public.invitation_codes invitation
  LEFT JOIN public.users inviter ON inviter.user_id = invitation.created_by AND inviter.deleted_at IS NULL
  WHERE invitation.code = p_code;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated, service_role;
