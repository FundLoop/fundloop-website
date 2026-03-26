import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

let adminClient: SupabaseClient<Database> | null = null

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured.")
  }

  return { url, serviceRoleKey }
}

export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getAdminSupabaseClient() {
  if (!adminClient) {
    adminClient = createAdminSupabaseClient()
  }

  return adminClient
}
