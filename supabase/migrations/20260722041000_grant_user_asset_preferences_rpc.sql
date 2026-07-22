REVOKE ALL ON FUNCTION public.replace_user_asset_preferences_atomic(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_user_asset_preferences_atomic(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_user_asset_preferences_atomic(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_asset_preferences_atomic(uuid, jsonb) TO service_role;
