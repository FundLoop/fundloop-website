CREATE TABLE public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
  organization_id integer NOT NULL REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invited_role text NOT NULL DEFAULT 'member',
  token_digest text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  accepted_by_user_id uuid REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_invitations_email_normalized_check CHECK (invitee_email = lower(btrim(invitee_email))),
  CONSTRAINT project_invitations_email_nonempty_check CHECK (length(invitee_email) BETWEEN 3 AND 320),
  CONSTRAINT project_invitations_role_check CHECK (invited_role IN ('member', 'admin')),
  CONSTRAINT project_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CONSTRAINT project_invitations_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT project_invitations_acceptance_check CHECK (
    (status = 'accepted' AND accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL)
    OR (status <> 'accepted' AND accepted_by_user_id IS NULL AND accepted_at IS NULL)
  ),
  CONSTRAINT project_invitations_project_org_unique UNIQUE (id, project_id, organization_id),
  CONSTRAINT project_invitations_creator_idempotency_unique UNIQUE (created_by_user_id, idempotency_key)
);

CREATE UNIQUE INDEX project_invitations_one_pending_email
ON public.project_invitations (project_id, invitee_email)
WHERE status = 'pending';

CREATE INDEX project_invitations_project_created
ON public.project_invitations (project_id, created_at DESC);

CREATE INDEX project_invitations_invitee_status
ON public.project_invitations (invitee_email, status, expires_at);

CREATE TRIGGER set_project_invitations_updated_at
BEFORE UPDATE ON public.project_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.project_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.project_invitations TO service_role;

CREATE POLICY project_invitations_admin_select
ON public.project_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.participants participant
    WHERE participant.project_id = project_invitations.project_id
      AND participant.user_id = auth.uid()
      AND participant.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    JOIN public.ref_roles AS role ON role.id = membership.role_id
    WHERE membership.organization_id = project_invitations.organization_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND role.name IN ('Founder', 'Admin')
  )
);

CREATE OR REPLACE FUNCTION public.accept_project_invitation(
  p_token_digest text,
  p_actor_user_id uuid,
  p_actor_email text
)
RETURNS TABLE (
  invitation_id uuid,
  project_id bigint,
  project_slug text,
  project_name text,
  organization_id integer,
  invited_role text,
  status text,
  accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invitation public.project_invitations%ROWTYPE;
  project_row public.projects%ROWTYPE;
  member_role_id integer;
  normalized_email text := lower(btrim(p_actor_email));
BEGIN
  IF p_token_digest IS NULL OR length(p_token_digest) <> 64 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_invitation_token';
  END IF;

  SELECT * INTO invitation
  FROM public.project_invitations
  WHERE token_digest = p_token_digest
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found';
  END IF;

  IF invitation.status = 'accepted' AND invitation.accepted_by_user_id = p_actor_user_id THEN
    SELECT * INTO project_row FROM public.projects WHERE id = invitation.project_id;
    RETURN QUERY SELECT invitation.id, invitation.project_id, project_row.slug, project_row.name,
      invitation.organization_id, invitation.invited_role, invitation.status, invitation.accepted_at;
    RETURN;
  END IF;

  IF invitation.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_not_pending';
  END IF;

  IF invitation.expires_at <= now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = invitation.id;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invitation_expired';
  END IF;

  IF invitation.invitee_email <> normalized_email THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch';
  END IF;

  SELECT project.* INTO project_row
  FROM public.projects project
  WHERE project.id = invitation.project_id AND project.organization_id = invitation.organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'invitation_project_unavailable';
  END IF;

  SELECT id INTO member_role_id
  FROM public.ref_roles
  WHERE name = 'Contributor'
  ORDER BY id
  LIMIT 1;

  IF member_role_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'invitation_role_unavailable';
  END IF;

  INSERT INTO public.organization_members (
    organization_id, user_id, role_id, role_assigned_by, status, deleted_at
  ) VALUES (
    invitation.organization_id, p_actor_user_id, member_role_id, invitation.created_by_user_id, 'active', NULL
  )
  ON CONFLICT ON CONSTRAINT organization_members_pkey DO UPDATE
  SET status = 'active',
      deleted_at = NULL;

  INSERT INTO public.participants (project_id, user_id, is_admin)
  VALUES (invitation.project_id, p_actor_user_id, invitation.invited_role = 'admin')
  ON CONFLICT ON CONSTRAINT user_project_participation_pkey DO UPDATE
  SET is_admin = participants.is_admin OR EXCLUDED.is_admin;

  UPDATE public.project_invitations
  SET status = 'accepted', accepted_by_user_id = p_actor_user_id, accepted_at = now()
  WHERE id = invitation.id
  RETURNING * INTO invitation;

  RETURN QUERY SELECT invitation.id, invitation.project_id, project_row.slug, project_row.name,
    invitation.organization_id, invitation.invited_role, invitation.status, invitation.accepted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_project_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(text, uuid, text) TO service_role;
