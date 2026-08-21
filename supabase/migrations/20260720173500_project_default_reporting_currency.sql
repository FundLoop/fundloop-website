ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS default_reporting_currency_code text NOT NULL DEFAULT 'USD';

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_default_reporting_currency_code_check;

ALTER TABLE public.projects
ADD CONSTRAINT projects_default_reporting_currency_code_check
CHECK (default_reporting_currency_code ~ '^[A-Z]{3,12}$');

CREATE OR REPLACE FUNCTION public.publish_project_onboarding_draft_atomic(
  p_name text,
  p_slug text,
  p_description text,
  p_website text,
  p_detailed_description text,
  p_logo_url text,
  p_contact_email text,
  p_billing_email text,
  p_billing_frequency text,
  p_payment_percentage numeric,
  p_payment_periodicity_id integer,
  p_default_payment_method_id integer,
  p_category_ids integer[],
  p_default_reporting_currency_code text DEFAULT 'USD'
)
RETURNS TABLE(project_id integer, project_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_founder_role_id integer;
  v_organization_id integer;
  v_project_id integer;
  v_default_reporting_currency_code text := upper(btrim(coalesce(p_default_reporting_currency_code, 'USD')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' OR p_slug IS NULL OR btrim(p_slug) = '' OR p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Project basics are incomplete';
  END IF;

  IF p_payment_percentage < 1 THEN
    RAISE EXCEPTION 'Project payment percentage must be at least 1';
  END IF;

  IF v_default_reporting_currency_code !~ '^[A-Z]{3,12}$' THEN
    RAISE EXCEPTION 'Project default reporting currency is invalid';
  END IF;

  SELECT id
  INTO v_founder_role_id
  FROM public.ref_roles
  WHERE name = 'Founder'
  ORDER BY id
  LIMIT 1;

  IF v_founder_role_id IS NULL THEN
    SELECT id
    INTO v_founder_role_id
    FROM public.ref_roles
    WHERE name = 'Admin'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_founder_role_id IS NULL THEN
    RAISE EXCEPTION 'No founder/admin roles available';
  END IF;

  INSERT INTO public.organizations (name, description, website, status)
  VALUES (btrim(p_name), btrim(p_description), nullif(btrim(coalesce(p_website, '')), ''), 'active')
  RETURNING id INTO v_organization_id;

  INSERT INTO public.organization_members (organization_id, user_id, role_id, role_assigned_by, status)
  VALUES (v_organization_id, v_user_id, v_founder_role_id, v_user_id, 'active');

  INSERT INTO public.projects (
    organization_id,
    name,
    slug,
    website,
    description,
    detailed_description,
    logo_url,
    email,
    billing_email,
    billing_frequency,
    payment_percentage,
    default_reporting_currency_code,
    payment_periodicity_id,
    default_payment_method_id,
    status
  )
  VALUES (
    v_organization_id,
    btrim(p_name),
    btrim(p_slug),
    nullif(btrim(coalesce(p_website, '')), ''),
    btrim(p_description),
    nullif(btrim(coalesce(p_detailed_description, '')), ''),
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_billing_email, '')), ''),
    nullif(btrim(coalesce(p_billing_frequency, '')), ''),
    p_payment_percentage,
    v_default_reporting_currency_code,
    p_payment_periodicity_id,
    p_default_payment_method_id,
    'active'
  )
  RETURNING id, slug INTO v_project_id, project_slug;

  IF coalesce(array_length(p_category_ids, 1), 0) > 0 THEN
    INSERT INTO public.project_categories (project_id, category_id)
    SELECT v_project_id, category_id
    FROM unnest(p_category_ids) AS category_id;
  END IF;

  INSERT INTO public.participants (project_id, user_id, is_admin)
  VALUES (v_project_id, v_user_id, true);

  DELETE FROM public.project_onboarding_drafts
  WHERE user_id = v_user_id;

  project_id := v_project_id;
  RETURN NEXT;
END;
$$;
