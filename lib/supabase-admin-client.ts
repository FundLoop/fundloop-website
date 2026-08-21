import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../types/supabase.ts"

type RuntimeEnv = Record<string, string | undefined>

function getDenoRuntime() {
  const runtime = globalThis as typeof globalThis & {
    Deno?: {
      env?: {
        get?: (name: string) => string | undefined
      }
    }
  }

  return typeof globalThis === "object" && globalThis && "Deno" in runtime ? runtime.Deno : undefined
}

function getDefaultRuntimeEnv(): RuntimeEnv {
  if (typeof process !== "undefined" && process?.env) {
    return process.env as RuntimeEnv
  }

  const denoRuntime = getDenoRuntime()
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") {
          return undefined
        }

        return denoRuntime?.env?.get?.(property)
      },
    },
  ) as RuntimeEnv
}

export function getSupabaseAdminConfig(env: RuntimeEnv = getDefaultRuntimeEnv()) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured.")
  }

  return { url, serviceRoleKey }
}

export function createAdminSupabaseClient(env: RuntimeEnv = getDefaultRuntimeEnv()): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig(env)

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
