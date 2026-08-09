DROP FUNCTION IF EXISTS public.list_discoverable_public_user_ids();

CREATE FUNCTION public.list_discoverable_public_user_ids()
RETURNS TABLE (user_id uuid, fields jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT latest.user_id, latest.fields
  FROM (
    SELECT DISTINCT ON (consent.user_id)
      consent.user_id,
      consent.action,
      consent.fields
    FROM public.profile_publication_consents consent
    WHERE consent.document_status = 'review'
    ORDER BY consent.user_id, consent.recorded_at DESC, consent.id DESC
  ) latest
  JOIN public.users profile ON profile.user_id = latest.user_id
  WHERE latest.action = 'grant'
    AND profile.is_public = true
    AND profile.status = 'active'
    AND profile.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.list_discoverable_public_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_discoverable_public_user_ids() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decline_project_invitation_review(
  p_token_digest text, p_actor_user_id uuid, p_actor_email text
)
RETURNS TABLE (invitation_id uuid, status text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  invitation public.project_invitations%ROWTYPE;
  evidence public.project_invitation_acceptance_evidence%ROWTYPE;
  next_action text;
BEGIN
  SELECT * INTO invitation
  FROM public.project_invitations
  WHERE token_digest = p_token_digest
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found';
  END IF;
  IF invitation.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_not_pending';
  END IF;
  IF invitation.invitee_email <> lower(btrim(p_actor_email)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch';
  END IF;

  next_action := CASE WHEN invitation.expires_at <= clock_timestamp() THEN 'expire' ELSE 'decline' END;

  UPDATE public.project_invitations
  SET status = CASE WHEN next_action = 'expire' THEN 'expired' ELSE 'declined' END
  WHERE id = invitation.id;

  INSERT INTO public.project_invitation_acceptance_evidence (
    invitation_id, project_id, actor_user_id, action, policy_document_version_id,
    policy_document_identifier, policy_content_hash, policy_locale, policy_status, shared_profile_fields
  ) VALUES (
    invitation.id, invitation.project_id, p_actor_user_id, next_action, invitation.policy_document_version_id,
    invitation.policy_document_identifier, invitation.policy_content_hash, invitation.policy_locale,
    invitation.policy_status, invitation.shared_profile_fields
  ) RETURNING * INTO evidence;

  RETURN QUERY SELECT invitation.id,
    CASE WHEN next_action = 'expire' THEN 'expired' ELSE 'declined' END,
    evidence.recorded_at;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_project_invitation_review(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_project_invitation_review(text, uuid, text) TO service_role;
