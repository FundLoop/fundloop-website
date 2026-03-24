create or replace function public.publish_project_onboarding_draft_atomic(
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
returns table(project_id integer, project_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_founder_role_id integer;
  v_organization_id integer;
  v_project_id integer;
begin
  if v_user_id is null then
    raise exception 'User not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' or p_slug is null or btrim(p_slug) = '' or p_description is null or btrim(p_description) = '' then
    raise exception 'Project basics are incomplete';
  end if;

  if p_payment_percentage < 1 then
    raise exception 'Project payment percentage must be at least 1';
  end if;

  select id
  into v_founder_role_id
  from public.ref_roles
  where name = 'Founder'
  order by id
  limit 1;

  if v_founder_role_id is null then
    select id
    into v_founder_role_id
    from public.ref_roles
    where name = 'Admin'
    order by id
    limit 1;
  end if;

  if v_founder_role_id is null then
    raise exception 'No founder/admin roles available';
  end if;

  insert into public.organizations (name, description, website, status)
  values (btrim(p_name), btrim(p_description), nullif(btrim(coalesce(p_website, '')), ''), 'active')
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role_id, role_assigned_by, status)
  values (v_organization_id, v_user_id, v_founder_role_id, v_user_id, 'active');

  insert into public.projects (
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
  values (
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
    p_payment_periodicity_id,
    p_default_payment_method_id,
    'active'
  )
  returning id, slug into v_project_id, project_slug;

  if coalesce(array_length(p_category_ids, 1), 0) > 0 then
    insert into public.project_categories (project_id, category_id)
    select v_project_id, category_id
    from unnest(p_category_ids) as category_id;
  end if;

  insert into public.participants (project_id, user_id, is_admin)
  values (v_project_id, v_user_id, true);

  delete from public.project_onboarding_drafts
  where user_id = v_user_id;

  project_id := v_project_id;
  return next;
end;
$$;

grant execute on function public.publish_project_onboarding_draft_atomic(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  integer,
  integer,
  integer[]
) to authenticated;
