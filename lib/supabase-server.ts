import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured.")
  }

  return { url, anonKey }
}

function applyCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
) {
  try {
    cookiesToSet.forEach(({ name, value, options }) => {
      cookieStore.set(name, value, options)
    })
  } catch {
    // Server components can read cookies during render but cannot always write them.
  }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseConfig()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        applyCookies(cookieStore, cookiesToSet)
      },
    },
  })
}
