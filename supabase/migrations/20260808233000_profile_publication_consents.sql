INSERT INTO public.legal_document_versions (document_kind, document_identifier, version, content_hash, locale, status)
VALUES ('privacy', 'fundloop-privacy-ca-review-draft-2026-08-08', '2026-08-08.review.1', '97523eedf0c1cbf79b3cfd87eee42392815dd6458d45e1ceeaf68b2e859eb65a', 'en-CA', 'review');

ALTER TABLE public.users ALTER COLUMN is_public SET DEFAULT false;
UPDATE public.users SET is_public = false WHERE is_public IS NULL;
ALTER TABLE public.users ALTER COLUMN is_public SET NOT NULL;

CREATE TABLE public.profile_publication_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  document_identifier text NOT NULL, content_hash text NOT NULL, document_status text NOT NULL CHECK (document_status IN ('review', 'effective')),
  locale text NOT NULL, action text NOT NULL CHECK (action IN ('grant', 'withdraw')), fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_surface text NOT NULL CHECK (source_surface = 'account_profile_visibility'), recorded_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_publication_consents_user_latest ON public.profile_publication_consents (user_id, recorded_at DESC, id DESC);
ALTER TABLE public.profile_publication_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_publication_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profile_publication_consents TO authenticated; GRANT ALL ON TABLE public.profile_publication_consents TO service_role;
CREATE POLICY profile_publication_consents_self_select ON public.profile_publication_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_profile_publication_choice(p_actor_user_id uuid, p_document_identifier text, p_content_hash text, p_locale text, p_action text, p_fields jsonb, p_source_surface text)
RETURNS TABLE (consent_id uuid, recorded_at timestamptz, is_public boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE document_row public.legal_document_versions%ROWTYPE; consent_row public.profile_publication_consents%ROWTYPE;
BEGIN
  SELECT * INTO document_row FROM public.legal_document_versions WHERE document_identifier = p_document_identifier AND content_hash = p_content_hash AND locale = p_locale AND status = 'review';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current_review_privacy_document_required'; END IF;
  IF p_action NOT IN ('grant', 'withdraw') THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_profile_publication_action'; END IF;
  UPDATE public.users SET is_public = (p_action = 'grant'), is_name_public = (p_action = 'grant' AND p_fields ? 'display_name'), is_pfp_public = (p_action = 'grant' AND p_fields ? 'avatar'), is_occupation_public = (p_action = 'grant' AND p_fields ? 'occupation'), is_location_public = (p_action = 'grant' AND p_fields ? 'location'), is_gender_public = false, is_birthyear_public = false, is_birthday_public = false WHERE user_id = p_actor_user_id;
  INSERT INTO public.profile_publication_consents (user_id, document_version_id, document_identifier, content_hash, document_status, locale, action, fields, source_surface) VALUES (p_actor_user_id, document_row.id, document_row.document_identifier, document_row.content_hash, 'review', document_row.locale, p_action, p_fields, p_source_surface) RETURNING * INTO consent_row;
  RETURN QUERY SELECT consent_row.id, consent_row.recorded_at, (p_action = 'grant');
END; $$;
REVOKE ALL ON FUNCTION public.record_profile_publication_choice(uuid, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.record_profile_publication_choice(uuid, text, text, text, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_discoverable_public_user_ids() RETURNS TABLE (user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT latest.user_id FROM (SELECT DISTINCT ON (consent.user_id) consent.user_id, consent.action FROM public.profile_publication_consents consent WHERE consent.document_status = 'review' ORDER BY consent.user_id, consent.recorded_at DESC, consent.id DESC) latest JOIN public.users profile ON profile.user_id = latest.user_id WHERE latest.action = 'grant' AND profile.is_public = true AND profile.status = 'active' AND profile.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.list_discoverable_public_user_ids() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.list_discoverable_public_user_ids() TO anon, authenticated, service_role;

