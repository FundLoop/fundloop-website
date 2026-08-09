import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"

export async function loadEpochShadowObservability() {
  if ((process.env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").toLowerCase() === "production") return []
  const { data, error } = await getAdminSupabaseClient()
    .from("epoch_shadow_observability")
    .select("*")
    .order("updated_at", { ascending: false })
  if (error) throw new Error(`Unable to load shadow epoch observability: ${error.message}`)
  return data ?? []
}
