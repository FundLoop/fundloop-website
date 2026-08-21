import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminSupabaseClient } from "@/lib/supabase-admin-client"
import type { Database } from "@/types/supabase"

let adminClient: SupabaseClient<Database> | null = null

export function getAdminSupabaseClient() {
  if (!adminClient) {
    adminClient = createAdminSupabaseClient()
  }

  return adminClient
}
