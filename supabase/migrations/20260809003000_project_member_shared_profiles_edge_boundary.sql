DROP FUNCTION public.list_project_member_shared_profiles(bigint);

CREATE FUNCTION public.list_project_member_shared_profiles(
  p_project_id bigint,
  p_actor_user_id uuid
)
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
  JOIN LATERAL (
    SELECT accepted.*
    FROM public.project_invitations accepted
    WHERE accepted.project_id = participant.project_id
      AND accepted.accepted_by_user_id = participant.user_id
      AND accepted.status = 'accepted'
      AND accepted.policy_status = 'review'
      AND EXISTS (
        SELECT 1 FROM public.project_invitation_acceptance_evidence evidence
        WHERE evidence.invitation_id = accepted.id AND evidence.action = 'acknowledge_accept'
          AND NOT EXISTS (
            SELECT 1 FROM public.project_invitation_acceptance_evidence later
            WHERE later.invitation_id = accepted.id AND later.action = 'revoke'
              AND (later.recorded_at, later.id) > (evidence.recorded_at, evidence.id)
          )
      )
    ORDER BY accepted.accepted_at DESC, accepted.id DESC
    LIMIT 1
  ) invitation ON true
  LEFT JOIN public.ref_occupations occupation ON occupation.id = profile.occupation_id
  LEFT JOIN public.ref_locations location ON location.id = profile.location_id
  WHERE participant.project_id = p_project_id
    AND EXISTS (
      SELECT 1 FROM public.participants viewer
      WHERE viewer.project_id = p_project_id AND viewer.user_id = p_actor_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.list_project_member_shared_profiles(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_project_member_shared_profiles(bigint, uuid) TO service_role;
