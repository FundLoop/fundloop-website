import { createClient } from "npm:@supabase/supabase-js@2"

export const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-fundloop-cron-secret",
}

function getDenoRuntime() {
  return typeof globalThis === "object" && globalThis && "Deno" in globalThis ? globalThis.Deno : undefined
}

export function getEnv(name) {
  return getDenoRuntime()?.env?.get?.(name)
}

export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  })
}

export function serve(handler) {
  const denoRuntime = getDenoRuntime()
  if (denoRuntime?.serve) {
    denoRuntime.serve(handler)
  }
}

export function createFunctionClients(request) {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      ok: false,
      error: "Supabase function environment variables are not configured.",
    }
  }

  const authorization = request.headers.get("Authorization")

  const authClient = createClient(supabaseUrl, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    ok: true,
    authClient,
    adminClient,
  }
}

export async function authenticateRequest(request) {
  const clients = createFunctionClients(request)
  if (!clients.ok) {
    return clients
  }

  const {
    data: { user },
    error,
  } = await clients.authClient.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      error: error?.message ?? "User not authenticated.",
      code: "not_authenticated",
      adminClient: clients.adminClient,
      user: null,
    }
  }

  return {
    ok: true,
    authClient: clients.authClient,
    adminClient: clients.adminClient,
    user,
  }
}

export async function authenticateRequestOrInternalSecret(
  request,
  options = { secretEnvName: "FUNDLOOP_PAYMENTS_CRON_SECRET", secretHeaderName: "x-fundloop-cron-secret" },
) {
  const clients = createFunctionClients(request)
  if (!clients.ok) {
    return clients
  }

  const requestSecret = request.headers.get(options.secretHeaderName)?.trim()
  const configuredSecret = getEnv(options.secretEnvName)?.trim()

  if (requestSecret) {
    if (!configuredSecret) {
      return {
        ok: false,
        error: `${options.secretEnvName} is not configured.`,
        code: "misconfigured_secret",
      }
    }

    if (requestSecret !== configuredSecret) {
      return {
        ok: false,
        error: "Invalid internal secret.",
        code: "invalid_internal_secret",
      }
    }

    return {
      ok: true,
      mode: "internal_secret",
      adminClient: clients.adminClient,
      user: null,
    }
  }

  const {
    data: { user },
    error,
  } = await clients.authClient.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      error: error?.message ?? "User not authenticated.",
      code: "not_authenticated",
      adminClient: clients.adminClient,
      user: null,
    }
  }

  return {
    ok: true,
    mode: "user",
    authClient: clients.authClient,
    adminClient: clients.adminClient,
    user,
  }
}

export async function parseJsonBody(request) {
  try {
    return {
      ok: true,
      body: await request.json(),
    }
  } catch {
    return {
      ok: false,
      error: "Request body must be valid JSON.",
    }
  }
}
