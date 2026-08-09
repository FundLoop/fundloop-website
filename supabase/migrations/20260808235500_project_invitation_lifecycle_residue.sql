ALTER TABLE public.project_invitations
  ADD COLUMN organization_membership_change text,
  ADD COLUMN organization_membership_previous_status public.organization_members_status,
  ADD COLUMN organization_membership_previous_deleted_at timestamptz,
  ADD CONSTRAINT project_invitations_membership_change_check
    CHECK (organization_membership_change IS NULL OR organization_membership_change IN ('created', 'reactivated', 'unchanged'));

CREATE OR REPLACE FUNCTION public.expire_project_invitations_review(
  p_project_id bigint,
  p_invitee_email text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE invitation public.project_invitations%ROWTYPE; expired_count integer := 0;
BEGIN
  FOR invitation IN
    SELECT * FROM public.project_invitations
    WHERE project_id = p_project_id
      AND status = 'pending'
      AND expires_at <= now()
      AND (p_invitee_email IS NULL OR invitee_email = lower(btrim(p_invitee_email)))
    FOR UPDATE
  LOOP
    UPDATE public.project_invitations SET status = 'expired' WHERE id = invitation.id;
    INSERT INTO public.project_invitation_acceptance_evidence (
      invitation_id, project_id, actor_user_id, action, policy_document_version_id,
      policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
    ) VALUES (
      invitation.id, invitation.project_id, NULL, 'expire', invitation.policy_document_version_id,
      invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
      invitation.policy_status, invitation.shared_profile_fields
    );
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END; $$;

REVOKE ALL ON FUNCTION public.expire_project_invitations_review(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_project_invitations_review(bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_project_invitation_review(
  p_token_digest text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_document_identifier text,
  p_content_hash text,
  p_locale text,
  p_shared_profile_fields jsonb
)
RETURNS TABLE (
  invitation_id uuid, project_id bigint, project_slug text, project_name text,
  organization_id integer, invited_role text, status text, accepted_at timestamptz,
  evidence_id uuid, policy_status text, shared_profile_fields jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  invitation public.project_invitations%ROWTYPE;
  project_row public.projects%ROWTYPE;
  member_role_id integer;
  evidence_row public.project_invitation_acceptance_evidence%ROWTYPE;
  previous_membership public.organization_members%ROWTYPE;
  membership_change text;
BEGIN
  SELECT * INTO invitation FROM public.project_invitations WHERE token_digest = p_token_digest FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found'; END IF;
  IF invitation.status <> 'pending' THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_not_pending'; END IF;
  IF invitation.expires_at <= now() THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invitation_expired'; END IF;
  IF invitation.invitee_email <> lower(btrim(p_actor_email)) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch'; END IF;
  IF invitation.policy_status <> 'review'
    OR invitation.policy_document_identifier <> p_document_identifier
    OR invitation.policy_content_hash <> p_content_hash
    OR invitation.policy_locale <> p_locale
    OR invitation.shared_profile_fields <> p_shared_profile_fields THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current_invitation_disclosure_required';
  END IF;
  SELECT project_source.* INTO project_row FROM public.projects project_source
    WHERE project_source.id = invitation.project_id AND project_source.organization_id = invitation.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'invitation_project_unavailable'; END IF;
  SELECT id INTO member_role_id FROM public.ref_roles WHERE name = 'Contributor' ORDER BY id LIMIT 1;
  IF member_role_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'invitation_role_unavailable'; END IF;

  SELECT membership_source.* INTO previous_membership FROM public.organization_members membership_source
    WHERE membership_source.organization_id = invitation.organization_id AND membership_source.user_id = p_actor_user_id FOR UPDATE;
  IF NOT FOUND THEN membership_change := 'created';
  ELSIF previous_membership.status <> 'active' OR previous_membership.deleted_at IS NOT NULL THEN membership_change := 'reactivated';
  ELSE membership_change := 'unchanged';
  END IF;

  INSERT INTO public.project_invitation_acceptance_evidence (
    invitation_id, project_id, actor_user_id, action, policy_document_version_id,
    policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
  ) VALUES (
    invitation.id, invitation.project_id, p_actor_user_id, 'acknowledge_accept', invitation.policy_document_version_id,
    invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
    invitation.policy_status, invitation.shared_profile_fields
  ) RETURNING * INTO evidence_row;

  INSERT INTO public.organization_members (organization_id, user_id, role_id, role_assigned_by, status, deleted_at)
  VALUES (invitation.organization_id, p_actor_user_id, member_role_id, invitation.created_by_user_id, 'active', NULL)
  ON CONFLICT ON CONSTRAINT organization_members_pkey DO UPDATE SET status = 'active', deleted_at = NULL;
  INSERT INTO public.participants (project_id, user_id, is_admin)
  VALUES (invitation.project_id, p_actor_user_id, invitation.invited_role = 'admin')
  ON CONFLICT ON CONSTRAINT user_project_participation_pkey DO UPDATE
    SET is_admin = participants.is_admin OR EXCLUDED.is_admin;
  UPDATE public.project_invitations SET
    status = 'accepted', accepted_by_user_id = p_actor_user_id, accepted_at = clock_timestamp(),
    organization_membership_change = membership_change,
    organization_membership_previous_status = CASE WHEN membership_change = 'reactivated' THEN previous_membership.status ELSE NULL END,
    organization_membership_previous_deleted_at = CASE WHEN membership_change = 'reactivated' THEN previous_membership.deleted_at ELSE NULL END
  WHERE id = invitation.id RETURNING * INTO invitation;

  RETURN QUERY SELECT invitation.id, invitation.project_id, project_row.slug, project_row.name,
    invitation.organization_id, invitation.invited_role, invitation.status, invitation.accepted_at,
    evidence_row.id, evidence_row.policy_status, evidence_row.shared_profile_fields;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_project_invitation_review(
  p_invitation_id uuid, p_actor_user_id uuid
)
RETURNS TABLE (invitation_id uuid, status text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE invitation public.project_invitations%ROWTYPE; evidence public.project_invitation_acceptance_evidence%ROWTYPE;
DECLARE has_other_accepted_invitation boolean;
BEGIN
  SELECT * INTO invitation FROM public.project_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participants WHERE project_id = invitation.project_id AND user_id = p_actor_user_id AND is_admin = true)
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members membership JOIN public.ref_roles role ON role.id = membership.role_id
      WHERE membership.organization_id = invitation.organization_id AND membership.user_id = p_actor_user_id
        AND membership.status = 'active' AND role.name IN ('Founder', 'Admin')
    ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_admin_required'; END IF;
  IF invitation.status NOT IN ('pending', 'accepted') THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_not_revocable'; END IF;
  IF invitation.accepted_by_user_id IS NOT NULL THEN
    DELETE FROM public.participants WHERE project_id = invitation.project_id AND user_id = invitation.accepted_by_user_id;
    SELECT EXISTS (
      SELECT 1 FROM public.project_invitations other
      WHERE other.id <> invitation.id AND other.organization_id = invitation.organization_id
        AND other.accepted_by_user_id = invitation.accepted_by_user_id AND other.status = 'accepted'
    ) INTO has_other_accepted_invitation;
    IF NOT has_other_accepted_invitation AND invitation.organization_membership_change = 'created' THEN
      DELETE FROM public.organization_members membership_target
      WHERE membership_target.organization_id = invitation.organization_id AND membership_target.user_id = invitation.accepted_by_user_id;
    ELSIF NOT has_other_accepted_invitation AND invitation.organization_membership_change = 'reactivated' THEN
      UPDATE public.organization_members membership_target SET
        status = invitation.organization_membership_previous_status,
        deleted_at = invitation.organization_membership_previous_deleted_at
      WHERE membership_target.organization_id = invitation.organization_id AND membership_target.user_id = invitation.accepted_by_user_id;
    END IF;
  END IF;
  UPDATE public.project_invitations SET status = 'revoked', accepted_by_user_id = NULL, accepted_at = NULL WHERE id = invitation.id;
  INSERT INTO public.project_invitation_acceptance_evidence (
    invitation_id, project_id, actor_user_id, action, policy_document_version_id,
    policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
  ) VALUES (
    invitation.id, invitation.project_id, p_actor_user_id, 'revoke', invitation.policy_document_version_id,
    invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
    invitation.policy_status, invitation.shared_profile_fields
  ) RETURNING * INTO evidence;
  RETURN QUERY SELECT invitation.id, 'revoked'::text, evidence.recorded_at;
END; $$;
