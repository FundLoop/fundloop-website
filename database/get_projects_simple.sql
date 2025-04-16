CREATE OR REPLACE FUNCTION get_projects_simple(limit_count integer DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  name text,
  logo_url text,
  description text,
  category_id integer,
  created_at timestamp with time zone,
  website text,
  category text,
  user_count integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.logo_url,
    p.description,
    p.category_id,
    p.created_at,
    p.website,
    c.name as category,
    COALESCE(ps.user_count, 0) as user_count
  FROM 
    projects p
  LEFT JOIN 
    ref_categories c ON p.category_id = c.id
  LEFT JOIN 
    project_stats ps ON p.id = ps.project_id
  ORDER BY 
    p.created_at DESC
  LIMIT 
    CASE WHEN limit_count IS NULL THEN NULL ELSE limit_count END;
END;
$$;
