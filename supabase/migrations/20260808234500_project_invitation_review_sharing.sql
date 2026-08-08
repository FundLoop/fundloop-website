ALTER TABLE public.project_invitations
  DROP CONSTRAINT project_invitations_status_check;

ALTER TABLE public.project_invitations
  ADD CONSTRAINT project_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked'));

ALTER TABLE public.project_invitations
  ADD COLUMN shared_profile_fields jsonb NOT NULL DEFAULT '["display_name","avatar","profile_headline"]'::jsonb,
  ADD COLUMN policy_document_version_id uuid REFERENCES public.legal_document_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN policy_document_identifier text,
  ADD COLUMN policy_content_hash text,
  ADD COLUMN policy_locale text,
  ADD COLUMN policy_status text;

UPDATE public.project_invitations invitation
SET policy_document_version_id = document.id,
    policy_document_identifier = document.document_identifier,
    policy_content_hash = document.content_hash,
    policy_locale = document.locale,
    policy_status = document.status
FROM public.legal_document_versions document
WHERE document.document_kind = 'privacy'
  AND document.status = 'review'
  AND invitation.policy_document_version_id IS NULL;

ALTER TABLE public.project_invitations
  ALTER COLUMN policy_document_version_id SET NOT NULL,
  ALTER COLUMN policy_document_identifier SET NOT NULL,
  ALTER COLUMN policy_content_hash SET NOT NULL,
  ALTER COLUMN policy_locale SET NOT NULL,
  ALTER COLUMN policy_status SET NOT NULL,
  ADD CONSTRAINT project_invitations_policy_status_check CHECK (policy_status IN ('review', 'effective')),
  ADD CONSTRAINT project_invitations_shared_fields_array_check CHECK (jsonb_typeof(shared_profile_fields) = 'array'),
  ADD CONSTRAINT project_invitations_shared_fields_approved_check CHECK (
    shared_profile_fields <@ '["display_name","avatar","profile_headline","bio","occupation","location"]'::jsonb
    AND jsonb_array_length(shared_profile_fields) > 0
  );

CREATE TABLE public.project_invitation_acceptance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.project_invitations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('acknowledge_accept', 'decline', 'revoke', 'expire')),
  policy_document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  policy_document_identifier text NOT NULL,
  policy_content_hash text NOT NULL,
  policy_locale text NOT NULL,
  policy_status text NOT NULL CHECK (policy_status IN ('review', 'effective')),
  shared_profile_fields jsonb NOT NULL,
  source_surface text NOT NULL DEFAULT 'project_invitation_review',
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_invitation_evidence_fields_array_check CHECK (jsonb_typeof(shared_profile_fields) = 'array')
);

CREATE INDEX project_invitation_evidence_invitation_latest
ON public.project_invitation_acceptance_evidence (invitation_id, recorded_at DESC, id DESC);

ALTER TABLE public.project_invitation_acceptance_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_invitation_acceptance_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.project_invitation_acceptance_evidence TO authenticated;
GRANT ALL ON TABLE public.project_invitation_acceptance_evidence TO service_role;

CREATE POLICY project_invitation_evidence_scoped_select
ON public.project_invitation_acceptance_evidence
FOR SELECT TO authenticated
USING (
  actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.participants participant
    WHERE participant.project_id = project_invitation_acceptance_evidence.project_id
      AND participant.user_id = auth.uid()
      AND participant.is_admin = true
  )
);

CREATE OR REPLACE FUNCTION public.inspect_project_invitation_review(
  p_token_digest text,
  p_actor_user_id uuid,
  p_actor_email text
)
RETURNS TABLE (
  invitation_id uuid,
  project_id bigint,
  project_slug text,
  project_name text,
  invited_role text,
  status text,
  expires_at timestamptz,
  shared_profile_fields jsonb,
  policy_document_identifier text,
  policy_content_hash text,
  policy_locale text,
  policy_status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE invitation public.project_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.project_invitations WHERE token_digest = p_token_digest FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found'; END IF;
  IF invitation.invitee_email <> lower(btrim(p_actor_email)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch';
  END IF;
  IF invitation.status = 'pending' AND invitation.expires_at <= now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = invitation.id;
    INSERT INTO public.project_invitation_acceptance_evidence (
      invitation_id, project_id, actor_user_id, action, policy_document_version_id,
      policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
    ) VALUES (
      invitation.id, invitation.project_id, NULL, 'expire', invitation.policy_document_version_id,
      invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
      invitation.policy_status, invitation.shared_profile_fields
    );
    invitation.status := 'expired';
  END IF;
  RETURN QUERY SELECT invitation.id, invitation.project_id, project.slug, project.name,
    invitation.invited_role, invitation.status, invitation.expires_at, invitation.shared_profile_fields,
    invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale, invitation.policy_status
  FROM public.projects project WHERE project.id = invitation.project_id;
END; $$;

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
  UPDATE public.project_invitations SET status = 'accepted', accepted_by_user_id = p_actor_user_id, accepted_at = clock_timestamp()
  WHERE id = invitation.id RETURNING * INTO invitation;

  RETURN QUERY SELECT invitation.id, invitation.project_id, project_row.slug, project_row.name,
    invitation.organization_id, invitation.invited_role, invitation.status, invitation.accepted_at,
    evidence_row.id, evidence_row.policy_status, evidence_row.shared_profile_fields;
END; $$;

CREATE OR REPLACE FUNCTION public.decline_project_invitation_review(
  p_token_digest text, p_actor_user_id uuid, p_actor_email text
)
RETURNS TABLE (invitation_id uuid, status text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE invitation public.project_invitations%ROWTYPE; evidence public.project_invitation_acceptance_evidence%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.project_invitations WHERE token_digest = p_token_digest FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found'; END IF;
  IF invitation.status <> 'pending' THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_not_pending'; END IF;
  IF invitation.invitee_email <> lower(btrim(p_actor_email)) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch'; END IF;
  UPDATE public.project_invitations SET status = 'declined' WHERE id = invitation.id;
  INSERT INTO public.project_invitation_acceptance_evidence (
    invitation_id, project_id, actor_user_id, action, policy_document_version_id,
    policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
  ) VALUES (
    invitation.id, invitation.project_id, p_actor_user_id, 'decline', invitation.policy_document_version_id,
    invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
    invitation.policy_status, invitation.shared_profile_fields
  ) RETURNING * INTO evidence;
  RETURN QUERY SELECT invitation.id, 'declined'::text, evidence.recorded_at;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_project_invitation_review(
  p_invitation_id uuid, p_actor_user_id uuid
)
RETURNS TABLE (invitation_id uuid, status text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE invitation public.project_invitations%ROWTYPE; evidence public.project_invitation_acceptance_evidence%ROWTYPE;
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

CREATE OR REPLACE FUNCTION public.list_project_member_shared_profiles(p_project_id bigint)
RETURNS TABLE (
  user_id uuid, display_name text, avatar_url text, profile_headline text,
  bio text, occupation_name text, location_name text, is_admin boolean, shared_profile_fields jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT profile.user_id,
    CASE WHEN invitation.shared_profile_fields ? 'display_name' THEN profile.display_name END,
    CASE WHEN invitation.shared_profile_fields ? 'avatar' THEN profile.avatar_url END,
    CASE WHEN invitation.shared_profile_fields ? 'profile_headline' THEN profile.profile_headline END,
    CASE WHEN invitation.shared_profile_fields ? 'bio' THEN profile.bio END,
    CASE WHEN invitation.shared_profile_fields ? 'occupation' THEN occupation.name END,
    CASE WHEN invitation.shared_profile_fields ? 'location' THEN location.name END,
    participant.is_admin,
    invitation.shared_profile_fields
  FROM public.participants participant
  JOIN public.users profile ON profile.user_id = participant.user_id
  JOIN public.project_invitations invitation ON invitation.project_id = participant.project_id
    AND invitation.accepted_by_user_id = participant.user_id AND invitation.status = 'accepted'
  LEFT JOIN public.ref_occupations occupation ON occupation.id = profile.occupation_id
  LEFT JOIN public.ref_locations location ON location.id = profile.location_id
  WHERE participant.project_id = p_project_id
    AND EXISTS (SELECT 1 FROM public.participants viewer WHERE viewer.project_id = p_project_id AND viewer.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.project_invitation_acceptance_evidence evidence
      WHERE evidence.invitation_id = invitation.id AND evidence.action = 'acknowledge_accept'
        AND NOT EXISTS (
          SELECT 1 FROM public.project_invitation_acceptance_evidence later
          WHERE later.invitation_id = invitation.id AND later.action = 'revoke'
            AND (later.recorded_at, later.id) > (evidence.recorded_at, evidence.id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.accept_project_invitation(text, uuid, text) FROM service_role;
REVOKE ALL ON FUNCTION public.inspect_project_invitation_review(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_project_invitation_review(text, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_project_invitation_review(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_project_invitation_review(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_project_invitation_review(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation_review(text, uuid, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.decline_project_invitation_review(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_project_invitation_review(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.list_project_member_shared_profiles(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_member_shared_profiles(bigint) TO authenticated, service_role;
