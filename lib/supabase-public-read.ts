import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// A stateless anon client for the tokenless public API (#266).
//
// The SSR client in lib/supabase-server.ts is bound to the caller's cookies, which is right for
// pages and wrong here: a signed-in browser would run a public read as `authenticated` and could
// see more than the same URL returns to everyone else, a token refresh could attach Set-Cookie to
// an API response, and a response that varies by cookie cannot be cached by a CDN.
//
// This client carries no session, so these reads are always the anon role and always the same for
// every caller. It is not a second abstraction over the admin or SSR clients: it is the anon
// identity, created once per process.

let publicReadClient: SupabaseClient<Database> | null = null

export function getPublicReadSupabaseClient() {
  if (publicReadClient) return publicReadClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase environment variables are not configured.")

  publicReadClient = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "fundloop-public-api/v1" } },
  })
  return publicReadClient
}
