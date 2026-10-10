-- Paginated read model for the public projects API (#266 stage 1).
--
-- Why a database function: PostgREST caps every read at 1,000 rows (supabase/config.toml), so
-- loading the directory into application code and filtering it there silently truncates once the
-- directory grows past the cap — matches beyond it could never appear, and member counts assembled
-- from a capped membership read would understate or zero out. Keyset paging, the search predicate
-- and the member count therefore all belong in one statement the database can bound.
--
-- SECURITY INVOKER on purpose: this runs with the caller's privileges, so RLS and the grants on
-- projects, ref_categories and project_active_members decide what anon can see, exactly as before.
-- The function widens nothing; it only moves the paging and counting into SQL.
--
-- The keyset is projects.id: unique, never null, monotonic with creation. Projects without a slug
-- are excluded, because the public id is the slug and a slug-less project cannot be addressed by
-- this API or rendered by the website's own project page.

create or replace function public.api_v1_public_projects_page(
  p_search text default null,
  p_after_id bigint default null,
  p_limit integer default 25
)
returns table (
  id bigint,
  slug text,
  name text,
  description text,
  logo_url text,
  website text,
  category_name text,
  created_at timestamptz,
  member_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 101);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_pattern text;
begin
  if v_search is not null then
    -- A caller's % or _ must match literally rather than act as a wildcard.
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    project.id,
    project.slug,
    project.name,
    coalesce(project.description, '') as description,
    project.logo_url,
    project.website,
    category.name as category_name,
    project.created_at,
    (select count(distinct member.user_id)
       from public.project_active_members member
      where member.project_id = project.id) as member_count
  from public.projects project
  left join public.ref_categories category on category.id = project.category_id
  where project.status::text = 'active'
    and project.is_public = true
    and project.deleted_at is null
    and project.slug is not null
    and (p_after_id is null or project.id < p_after_id)
    and (
      v_pattern is null
      -- Matched against the same fields joined in the same order the website joins them
      -- (projectMatchesSearch in lib/public-discovery.ts), not field by field. Per-field matching
      -- would miss a term that spans two fields: a project named "Alpha" described as "Beta"
      -- matches the website's search for "alpha beta", and must match here too.
      or concat_ws(
           ' ',
           project.name,
           coalesce(project.description, ''),
           coalesce(category.name, ''),
           coalesce(project.detailed_description, '')
         ) ilike v_pattern
    )
  order by project.id desc
  limit v_limit;
end;
$$;

revoke all on function public.api_v1_public_projects_page(text, bigint, integer) from public;
grant execute on function public.api_v1_public_projects_page(text, bigint, integer) to anon, authenticated, service_role;
