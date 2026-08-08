\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'invite-founder@example.test', now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'invite-member@example.test', now(), now()),
  ('20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'invite-unrelated@example.test', now(), now());
INSERT INTO public.users (user_id, display_name, full_name, email, status, avatar_url, profile_headline) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Founder', 'Founder Secret', 'invite-founder@example.test', 'active', 'founder.png', 'Founder headline'),
  ('20000000-0000-4000-8000-000000000002', 'Member Display', 'Member Secret', 'invite-member@example.test', 'active', 'member.png', 'Member headline'),
  ('20000000-0000-4000-8000-000000000003', 'Unrelated', 'Unrelated Secret', 'invite-unrelated@example.test', 'active', 'unrelated.png', 'Unrelated headline');
INSERT INTO public.organizations (id, name) VALUES (900001, 'Invitation Review Org');
INSERT INTO public.projects (id, name, description, organization_id, slug) VALUES (900001, 'Invitation Review Project', 'Test', 900001, 'invitation-review-project');
INSERT INTO public.organization_members (organization_id, user_id, role_id, role_assigned_by, status)
VALUES (900001, '20000000-0000-4000-8000-000000000001', 2, '20000000-0000-4000-8000-000000000001', 'active');
INSERT INTO public.participants (project_id, user_id, is_admin)
VALUES (900001, '20000000-0000-4000-8000-000000000001', true);

INSERT INTO public.project_invitations (
  id, project_id, organization_id, invitee_email, invited_role, token_digest, idempotency_key,
  created_by_user_id, expires_at, shared_profile_fields, policy_document_version_id,
  policy_document_identifier, policy_content_hash, policy_locale, policy_status
)
SELECT '30000000-0000-4000-8000-000000000001', 900001, 900001, 'invite-member@example.test', 'member', repeat('a',64), 'accept-key',
  '20000000-0000-4000-8000-000000000001', now() + interval '1 day', '["display_name","avatar"]', id,
  document_identifier, content_hash, locale, status
FROM public.legal_document_versions WHERE document_kind = 'privacy' AND status = 'review';

INSERT INTO public.project_invitations (
  id, project_id, organization_id, invitee_email, invited_role, token_digest, idempotency_key,
  created_by_user_id, created_at, expires_at, shared_profile_fields, policy_document_version_id,
  policy_document_identifier, policy_content_hash, policy_locale, policy_status
)
SELECT invitation_id, 900001, 900001, invitee_email, 'member', token_digest, idempotency_key,
  '20000000-0000-4000-8000-000000000001', invitation.created_at, invitation.expires_at, '["display_name"]', document.id,
  document.document_identifier, document.content_hash, document.locale, document.status
FROM public.legal_document_versions document
CROSS JOIN (VALUES
  ('30000000-0000-4000-8000-000000000002'::uuid, 'decline@example.test', repeat('b',64), 'decline-key', now(), now() + interval '1 day'),
  ('30000000-0000-4000-8000-000000000003'::uuid, 'expire@example.test', repeat('c',64), 'expire-key', now() - interval '2 days', now() - interval '1 day')
) invitation(invitation_id, invitee_email, token_digest, idempotency_key, created_at, expires_at)
WHERE document.document_kind = 'privacy' AND document.status = 'review';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.participants WHERE project_id = 900001 AND user_id = auth.uid()) THEN RAISE EXCEPTION 'pending invitation granted participant access'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = 900001 AND user_id = auth.uid()) THEN RAISE EXCEPTION 'pending invitation granted organization membership'; END IF;
  IF EXISTS (SELECT 1 FROM public.list_project_member_shared_profiles(900001)) THEN RAISE EXCEPTION 'pre-acceptance profile read was allowed'; END IF;
  BEGIN
    INSERT INTO public.project_invitation_acceptance_evidence (
      invitation_id, project_id, actor_user_id, action, policy_document_version_id, policy_document_identifier,
      policy_content_hash, policy_locale, policy_status, shared_profile_fields
    ) SELECT '30000000-0000-4000-8000-000000000001', 900001, auth.uid(), 'acknowledge_accept', id,
      document_identifier, content_hash, locale, status, '["display_name"]' FROM public.legal_document_versions WHERE document_kind='privacy' AND status='review';
    RAISE EXCEPTION 'authenticated direct evidence write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_project_invitation_review(repeat('a',64), '20000000-0000-4000-8000-000000000002', 'invite-member@example.test',
      'wrong-document', repeat('0',64), 'en-CA', '["display_name","avatar"]');
    RAISE EXCEPTION 'invalid disclosure was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'current_invitation_disclosure_required' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.participants WHERE project_id=900001 AND user_id='20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'failed acceptance created participant'; END IF;
END $$;

SELECT * FROM public.accept_project_invitation_review(
  repeat('a',64), '20000000-0000-4000-8000-000000000002', 'invite-member@example.test',
  'fundloop-privacy-ca-review-draft-2026-08-08', '97523eedf0c1cbf79b3cfd87eee42392815dd6458d45e1ceeaf68b2e859eb65a', 'en-CA', '["display_name","avatar"]'
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_invitation_acceptance_evidence WHERE invitation_id='30000000-0000-4000-8000-000000000001' AND action='acknowledge_accept') THEN RAISE EXCEPTION 'acceptance evidence missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participants WHERE project_id=900001 AND user_id='20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'accepted participant missing'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.list_project_member_shared_profiles(900001) WHERE user_id='20000000-0000-4000-8000-000000000002' AND display_name='Member Display' AND avatar_url='member.png' AND profile_headline IS NULL) <> 1 THEN RAISE EXCEPTION 'approved-field read model failed'; END IF;
  IF (SELECT count(*) FROM public.project_invitation_acceptance_evidence) <> 1 THEN RAISE EXCEPTION 'self evidence read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.list_project_member_shared_profiles(900001)) THEN RAISE EXCEPTION 'unrelated profile read was allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_invitation_acceptance_evidence) THEN RAISE EXCEPTION 'cross-user evidence read was allowed'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT * FROM public.decline_project_invitation_review(repeat('b',64), '20000000-0000-4000-8000-000000000002', 'decline@example.test');
SELECT * FROM public.inspect_project_invitation_review(repeat('c',64), '20000000-0000-4000-8000-000000000002', 'expire@example.test');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_invitation_acceptance_evidence WHERE invitation_id='30000000-0000-4000-8000-000000000002' AND action='decline') THEN RAISE EXCEPTION 'decline evidence missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_invitation_acceptance_evidence WHERE invitation_id='30000000-0000-4000-8000-000000000003' AND action='expire') THEN RAISE EXCEPTION 'expiry evidence missing'; END IF;
END $$;
SELECT * FROM public.revoke_project_invitation_review('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.participants WHERE project_id=900001 AND user_id='20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'revocation left project access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_invitation_acceptance_evidence WHERE invitation_id='30000000-0000-4000-8000-000000000001' AND action='revoke') THEN RAISE EXCEPTION 'revocation evidence missing'; END IF;
END $$;

ROLLBACK;
SELECT 'project invitation review sharing SQL validation passed' AS result;
