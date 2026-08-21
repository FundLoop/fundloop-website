CREATE TABLE public.project_invitation_membership_provenance (
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_by_invitation boolean NOT NULL,
  previous_status public.organization_members_status,
  previous_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT project_invitation_membership_provenance_prior_check CHECK (
    NOT created_by_invitation OR (previous_status IS NULL AND previous_deleted_at IS NULL)
  )
);

CREATE TABLE public.project_invitation_participant_provenance (
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_by_invitation boolean NOT NULL,
  previous_is_admin boolean,
  previous_is_favorite boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_invitation_participant_provenance_prior_check CHECK (
    NOT created_by_invitation OR (previous_is_admin IS NULL AND previous_is_favorite IS NULL)
  )
);

ALTER TABLE public.project_invitation_membership_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitation_participant_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_invitation_membership_provenance FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_invitation_participant_provenance FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.project_invitation_membership_provenance TO service_role;
GRANT ALL ON TABLE public.project_invitation_participant_provenance TO service_role;

INSERT INTO public.project_invitation_membership_provenance (
  organization_id, user_id, created_by_invitation, previous_status, previous_deleted_at
)
SELECT DISTINCT invitation.organization_id, invitation.accepted_by_user_id, false, membership.status, membership.deleted_at
FROM public.project_invitations invitation
JOIN public.organization_members membership ON membership.organization_id = invitation.organization_id
  AND membership.user_id = invitation.accepted_by_user_id
WHERE invitation.status = 'accepted' AND invitation.accepted_by_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.project_invitation_participant_provenance (
  project_id, user_id, created_by_invitation, previous_is_admin, previous_is_favorite
)
SELECT DISTINCT invitation.project_id, invitation.accepted_by_user_id, false, participant.is_admin, participant.is_favorite
FROM public.project_invitations invitation
JOIN public.participants participant ON participant.project_id = invitation.project_id
  AND participant.user_id = invitation.accepted_by_user_id
WHERE invitation.status = 'accepted' AND invitation.accepted_by_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

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
  previous_participant public.participants%ROWTYPE;
  membership_existed boolean;
  participant_existed boolean;
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

  PERFORM pg_advisory_xact_lock(hashtextextended('invitation-membership:' || invitation.organization_id || ':' || p_actor_user_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('invitation-participant:' || invitation.project_id || ':' || p_actor_user_id, 0));

  SELECT membership_source.* INTO previous_membership FROM public.organization_members membership_source
    WHERE membership_source.organization_id = invitation.organization_id AND membership_source.user_id = p_actor_user_id FOR UPDATE;
  membership_existed := FOUND;
  IF NOT membership_existed THEN membership_change := 'created';
  ELSIF previous_membership.status <> 'active' OR previous_membership.deleted_at IS NOT NULL THEN membership_change := 'reactivated';
  ELSE membership_change := 'unchanged';
  END IF;
  INSERT INTO public.project_invitation_membership_provenance (
    organization_id, user_id, created_by_invitation, previous_status, previous_deleted_at
  ) VALUES (
    invitation.organization_id, p_actor_user_id, NOT membership_existed,
    CASE WHEN membership_existed THEN previous_membership.status END,
    CASE WHEN membership_existed THEN previous_membership.deleted_at END
  ) ON CONFLICT DO NOTHING;

  SELECT participant_source.* INTO previous_participant FROM public.participants participant_source
    WHERE participant_source.project_id = invitation.project_id AND participant_source.user_id = p_actor_user_id FOR UPDATE;
  participant_existed := FOUND;
  INSERT INTO public.project_invitation_participant_provenance (
    project_id, user_id, created_by_invitation, previous_is_admin, previous_is_favorite
  ) VALUES (
    invitation.project_id, p_actor_user_id, NOT participant_existed,
    CASE WHEN participant_existed THEN previous_participant.is_admin END,
    CASE WHEN participant_existed THEN previous_participant.is_favorite END
  ) ON CONFLICT DO NOTHING;

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
DECLARE
  invitation public.project_invitations%ROWTYPE;
  evidence public.project_invitation_acceptance_evidence%ROWTYPE;
  membership_provenance public.project_invitation_membership_provenance%ROWTYPE;
  participant_provenance public.project_invitation_participant_provenance%ROWTYPE;
  has_other_organization_invitation boolean;
  has_other_project_invitation boolean;
  remaining_project_admin boolean;
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
    PERFORM pg_advisory_xact_lock(hashtextextended('invitation-membership:' || invitation.organization_id || ':' || invitation.accepted_by_user_id, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('invitation-participant:' || invitation.project_id || ':' || invitation.accepted_by_user_id, 0));
    SELECT EXISTS (
      SELECT 1 FROM public.project_invitations other
      WHERE other.id <> invitation.id AND other.organization_id = invitation.organization_id
        AND other.accepted_by_user_id = invitation.accepted_by_user_id AND other.status = 'accepted'
    ) INTO has_other_organization_invitation;
    SELECT EXISTS (
      SELECT 1 FROM public.project_invitations other
      WHERE other.id <> invitation.id AND other.project_id = invitation.project_id
        AND other.accepted_by_user_id = invitation.accepted_by_user_id AND other.status = 'accepted'
    ) INTO has_other_project_invitation;

    SELECT participant_provenance_source.* INTO participant_provenance FROM public.project_invitation_participant_provenance participant_provenance_source
      WHERE participant_provenance_source.project_id = invitation.project_id AND participant_provenance_source.user_id = invitation.accepted_by_user_id FOR UPDATE;
    IF FOUND THEN
      IF has_other_project_invitation THEN
        SELECT EXISTS (
          SELECT 1 FROM public.project_invitations other
          WHERE other.id <> invitation.id AND other.project_id = invitation.project_id
            AND other.accepted_by_user_id = invitation.accepted_by_user_id
            AND other.status = 'accepted' AND other.invited_role = 'admin'
        ) INTO remaining_project_admin;
        UPDATE public.participants participant_target SET
          is_admin = coalesce(participant_provenance.previous_is_admin, false) OR remaining_project_admin
        WHERE participant_target.project_id = invitation.project_id AND participant_target.user_id = invitation.accepted_by_user_id;
      ELSIF participant_provenance.created_by_invitation THEN
        DELETE FROM public.participants participant_target
        WHERE participant_target.project_id = invitation.project_id AND participant_target.user_id = invitation.accepted_by_user_id;
        DELETE FROM public.project_invitation_participant_provenance participant_provenance_target
        WHERE participant_provenance_target.project_id = invitation.project_id AND participant_provenance_target.user_id = invitation.accepted_by_user_id;
      ELSE
        UPDATE public.participants participant_target SET
          is_admin = participant_provenance.previous_is_admin,
          is_favorite = participant_provenance.previous_is_favorite
        WHERE participant_target.project_id = invitation.project_id AND participant_target.user_id = invitation.accepted_by_user_id;
        DELETE FROM public.project_invitation_participant_provenance participant_provenance_target
        WHERE participant_provenance_target.project_id = invitation.project_id AND participant_provenance_target.user_id = invitation.accepted_by_user_id;
      END IF;
    END IF;

    SELECT membership_provenance_source.* INTO membership_provenance FROM public.project_invitation_membership_provenance membership_provenance_source
      WHERE membership_provenance_source.organization_id = invitation.organization_id AND membership_provenance_source.user_id = invitation.accepted_by_user_id FOR UPDATE;
    IF FOUND AND NOT has_other_organization_invitation THEN
      IF membership_provenance.created_by_invitation THEN
        DELETE FROM public.organization_members membership_target
        WHERE membership_target.organization_id = invitation.organization_id AND membership_target.user_id = invitation.accepted_by_user_id;
      ELSE
        UPDATE public.organization_members membership_target SET
          status = membership_provenance.previous_status,
          deleted_at = membership_provenance.previous_deleted_at
        WHERE membership_target.organization_id = invitation.organization_id AND membership_target.user_id = invitation.accepted_by_user_id;
      END IF;
      DELETE FROM public.project_invitation_membership_provenance membership_provenance_target
      WHERE membership_provenance_target.organization_id = invitation.organization_id AND membership_provenance_target.user_id = invitation.accepted_by_user_id;
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
