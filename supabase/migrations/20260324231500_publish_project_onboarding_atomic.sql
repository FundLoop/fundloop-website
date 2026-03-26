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
  p_category_ids integer[]
)
RETURNS TABLE(project_id integer, project_slug text)
LANGUAGE sql
SECURITY DEFINER
AS '
  WITH actor AS (
    SELECT auth.uid() AS user_id
  ),
  founder_role AS (
    SELECT
      actor.user_id,
      COALESCE(
        (SELECT id FROM public.ref_roles WHERE name = ''Founder'' ORDER BY id LIMIT 1),
        (SELECT id FROM public.ref_roles WHERE name = ''Admin'' ORDER BY id LIMIT 1)
      ) AS role_id
    FROM actor
  ),
  inserted_organization AS (
    INSERT INTO public.organizations (name, description, website, status)
    SELECT
      btrim(p_name),
      btrim(p_description),
      nullif(btrim(coalesce(p_website, '''')), ''''),
      ''active''
    FROM founder_role
    RETURNING id
  ),
  inserted_org_member AS (
    INSERT INTO public.organization_members (organization_id, user_id, role_id, role_assigned_by, status)
    SELECT
      inserted_organization.id,
      founder_role.user_id,
      founder_role.role_id,
      founder_role.user_id,
      ''active''
    FROM inserted_organization
    CROSS JOIN founder_role
    RETURNING organization_id
  ),
  inserted_project AS (
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
      payment_periodicity_id,
      default_payment_method_id,
      status
    )
    SELECT
      inserted_organization.id,
      btrim(p_name),
      btrim(p_slug),
      nullif(btrim(coalesce(p_website, '''')), ''''),
      btrim(p_description),
      nullif(btrim(coalesce(p_detailed_description, '''')), ''''),
      nullif(btrim(coalesce(p_logo_url, '''')), ''''),
      nullif(btrim(coalesce(p_contact_email, '''')), ''''),
      nullif(btrim(coalesce(p_billing_email, '''')), ''''),
      nullif(btrim(coalesce(p_billing_frequency, '''')), ''''),
      p_payment_percentage,
      p_payment_periodicity_id,
      p_default_payment_method_id,
      ''active''
    FROM inserted_organization
    RETURNING id, slug
  ),
  inserted_categories AS (
    INSERT INTO public.project_categories (project_id, category_id)
    SELECT
      inserted_project.id,
      category_id
    FROM inserted_project
    CROSS JOIN unnest(coalesce(p_category_ids, ARRAY[]::integer[])) AS category_id
    RETURNING project_id
  ),
  inserted_participant AS (
    INSERT INTO public.participants (project_id, user_id, is_admin)
    SELECT
      inserted_project.id,
      founder_role.user_id,
      true
    FROM inserted_project
    CROSS JOIN founder_role
    RETURNING project_id
  ),
  deleted_draft AS (
    DELETE FROM public.project_onboarding_drafts
    USING founder_role
    WHERE public.project_onboarding_drafts.user_id = founder_role.user_id
    RETURNING public.project_onboarding_drafts.id
  )
  SELECT
    inserted_project.id AS project_id,
    inserted_project.slug AS project_slug
  FROM inserted_project
';
