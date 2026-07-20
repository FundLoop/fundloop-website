import { createClient } from "npm:@supabase/supabase-js@2"
import { executeProjectAttributionDatasetSubmitCommand } from "../../../lib/attribution/project-attribution-command.ts"
import { validateProjectAttributionDatasetSubmitInput } from "../../../lib/edge-functions/project-attribution-dataset-submit-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
}

function getDenoRuntime() {
  return typeof globalThis === "object" && globalThis && "Deno" in globalThis ? globalThis.Deno : undefined
}

function getEnv(name: string) {
  return getDenoRuntime()?.env?.get?.(name)
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  })
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  }

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(edgeCommandFailure("function_not_configured", "Supabase function environment variables are not configured."))
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(edgeCommandFailure("invalid_payload", "Request body must be valid JSON."))
  }

  const authorization = request.headers.get("Authorization")
  const authClient = createClient(supabaseUrl, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return json(edgeCommandFailure("not_authenticated", "User not authenticated."))
  }

  const validation = validateProjectAttributionDatasetSubmitInput(body)
  if (!validation.ok) {
    return json(validation)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const commandResult = await executeProjectAttributionDatasetSubmitCommand(adminClient, {
    ...validation.data,
    actorUserId: user.id,
  })

  if (!commandResult.ok) {
    return json(edgeCommandFailure(commandResult.error.code, commandResult.error.message))
  }

  return json(edgeCommandSuccess(commandResult.data))
}

const denoRuntime = getDenoRuntime()
if (denoRuntime?.serve) {
  denoRuntime.serve(handleRequest)
}

export { handleRequest }
