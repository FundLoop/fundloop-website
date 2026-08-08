CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_kind text NOT NULL CHECK (document_kind IN ('terms', 'privacy')),
  document_identifier text NOT NULL UNIQUE,
  version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  locale text NOT NULL,
  status text NOT NULL CHECK (status IN ('review', 'effective')),
  approved_at timestamptz,
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_document_effective_requires_approval CHECK (status <> 'effective' OR (approved_at IS NOT NULL AND effective_at IS NOT NULL)),
  UNIQUE (document_kind, version, locale),
  UNIQUE (document_identifier, content_hash)
);

CREATE TABLE public.legal_acceptance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  document_identifier text NOT NULL,
  content_hash text NOT NULL,
  locale text NOT NULL,
  document_status text NOT NULL CHECK (document_status IN ('review', 'effective')),
  actor_capacity text NOT NULL CHECK (actor_capacity IN ('project_actor', 'user')),
  source_surface text NOT NULL CHECK (source_surface IN ('project_funding_preview', 'payout_preview')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, document_version_id, actor_capacity, source_surface)
);

INSERT INTO public.legal_document_versions (document_kind, document_identifier, version, content_hash, locale, status)
VALUES ('terms', 'fundloop-terms-ca-review-draft-2026-08-08', '2026-08-08.review.1', '5fdad9b8c1a73e4072612820d079e357e56abf0a217f499de84db2cd78b5aa20', 'en-CA', 'review');

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptance_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_document_versions, public.legal_acceptance_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.legal_document_versions, public.legal_acceptance_records TO authenticated;
GRANT ALL ON TABLE public.legal_document_versions, public.legal_acceptance_records TO service_role;
CREATE POLICY legal_document_versions_authenticated_select ON public.legal_document_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY legal_acceptance_records_self_select ON public.legal_acceptance_records FOR SELECT TO authenticated USING (auth.uid() = actor_user_id);

CREATE OR REPLACE FUNCTION public.record_review_policy_acknowledgement(p_actor_user_id uuid, p_document_identifier text, p_content_hash text, p_locale text, p_actor_capacity text, p_source_surface text)
RETURNS TABLE (acceptance_id uuid, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE document_row public.legal_document_versions%ROWTYPE; acceptance_row public.legal_acceptance_records%ROWTYPE;
BEGIN
  SELECT * INTO document_row FROM public.legal_document_versions WHERE document_identifier = p_document_identifier AND content_hash = p_content_hash AND locale = p_locale AND status = 'review';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current_review_document_required'; END IF;
  INSERT INTO public.legal_acceptance_records (actor_user_id, document_version_id, document_identifier, content_hash, locale, document_status, actor_capacity, source_surface)
  VALUES (p_actor_user_id, document_row.id, document_row.document_identifier, document_row.content_hash, document_row.locale, 'review', p_actor_capacity, p_source_surface)
  ON CONFLICT (actor_user_id, document_version_id, actor_capacity, source_surface) DO UPDATE SET accepted_at = now()
  RETURNING * INTO acceptance_row;
  RETURN QUERY SELECT acceptance_row.id, acceptance_row.accepted_at;
END; $$;
REVOKE ALL ON FUNCTION public.record_review_policy_acknowledgement(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_review_policy_acknowledgement(uuid, text, text, text, text, text) TO service_role;

