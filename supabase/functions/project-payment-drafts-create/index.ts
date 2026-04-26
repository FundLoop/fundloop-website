import { createClient } from "npm:@supabase/supabase-js@2"
import { validateProjectPaymentDraftsCreateInput } from "../../../lib/edge-functions/project-payment-drafts-create-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeProjectPaymentDraftsCommand } from "../../../lib/payments/project-payment-drafts-command.ts"

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
}

function getDenoRuntime() {
  return typeof globalThis === "object" && globalThis && "Deno" in globalThis ? globalThis.Deno : undefined
}

function getEnv(name) {
  return getDenoRuntime()?.env?.get?.(name)
}

function resolveDeploymentEnvironment() {
  const explicitValue = getEnv("FUNDLOOP_DEPLOYMENT_ENV")?.trim()?.toLowerCase()
  if (explicitValue === "local" || explicitValue === "preview" || explicitValue === "production") {
    return explicitValue
  }

  const vercelValue = getEnv("VERCEL_ENV")?.trim()?.toLowerCase()
  if (vercelValue === "local" || vercelValue === "preview" || vercelValue === "production") {
    return vercelValue
  }

  return "local"
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  })
}

function getAttemptIdFromBody(body) {
  return typeof body?.attemptId === "string" && body.attemptId.trim() ? body.attemptId.trim() : crypto.randomUUID()
}

function getProjectSlugFromBody(body) {
  return typeof body?.projectSlug === "string" ? body.projectSlug.trim() : ""
}

function getPaymentCountFromBody(body) {
  return Array.isArray(body?.payments) ? body.payments.length : 0
}

async function recordPaymentSaveEvent(client, event) {
  try {
    const { error } = await client.from("payment_flow_events").insert({
      flow: "payment_save",
      stage: event.stage,
      outcome: event.outcome,
      severity: event.severity,
      attempt_id: event.attemptId,
      actor_user_id: event.actorUserId ?? null,
      actor_role: event.actorRole ?? (event.actorUserId ? "authenticated_user" : "unauthenticated"),
      project_id: event.projectId ?? null,
      payment_id: null,
      submission_id: null,
      payment_method_id: event.paymentMethodId ?? null,
      chain_id: null,
      chain_asset_id: null,
      intake_contract_id: null,
      tx_hash: null,
      wallet_address: null,
      environment: resolveDeploymentEnvironment(),
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage ?? null,
      metadata: {
        projectSlug: event.projectSlug,
        paymentCount: event.paymentCount,
      },
    })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error("Failed to record project payment draft observability event", error)
  }
}

async function handleRequest(request) {
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

  let body
  try {
    body = await request.json()
  } catch {
    return json(edgeCommandFailure("invalid_payload", "Request body must be valid JSON."))
  }

  const attemptId = getAttemptIdFromBody(body)
  const projectSlug = getProjectSlugFromBody(body)
  const paymentCount = getPaymentCountFromBody(body)
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

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    await recordPaymentSaveEvent(adminClient, {
      stage: "submit",
      outcome: "failure",
      severity: "error",
      attemptId,
      actorUserId: null,
      actorRole: "unauthenticated",
      projectSlug,
      paymentCount,
      errorCode: "not_authenticated",
      errorMessage: authError?.message ?? "User not authenticated.",
    })

    return json(edgeCommandFailure("not_authenticated", "User not authenticated."))
  }

  const validation = validateProjectPaymentDraftsCreateInput(body)
  if (!validation.ok) {
    await recordPaymentSaveEvent(adminClient, {
      stage: "validation",
      outcome: "failure",
      severity: "warning",
      attemptId,
      actorUserId: user.id,
      actorRole: "authenticated_user",
      projectSlug,
      paymentCount,
      errorCode: validation.error.code,
      errorMessage: validation.error.message,
    })

    return json(validation)
  }

  await recordPaymentSaveEvent(adminClient, {
    stage: "submit",
    outcome: "attempt",
    severity: "info",
    attemptId,
    actorUserId: user.id,
    actorRole: "authenticated_user",
    projectSlug: validation.data.projectSlug,
    paymentCount: validation.data.payments.length,
  })

  const commandResult = await executeProjectPaymentDraftsCommand(adminClient, {
    actorUserId: user.id,
    projectSlug: validation.data.projectSlug,
    payments: validation.data.payments,
  })

  if (!commandResult.ok) {
    const isValidationFailure =
      commandResult.error.code === "reference_data_unavailable" && commandResult.error.paymentMethodId !== null
    const actorRole =
      commandResult.error.code === "permission_denied" || commandResult.error.code === "project_not_found"
        ? "authenticated_user"
        : "project_admin"

    await recordPaymentSaveEvent(adminClient, {
      stage: isValidationFailure ? "validation" : "submit",
      outcome: "failure",
      severity: isValidationFailure ? "warning" : "error",
      attemptId,
      actorUserId: user.id,
      actorRole,
      projectId: commandResult.error.projectId,
      paymentMethodId: commandResult.error.paymentMethodId,
      projectSlug: validation.data.projectSlug,
      paymentCount: validation.data.payments.length,
      errorCode: commandResult.error.code,
      errorMessage: commandResult.error.message,
    })

    return json(edgeCommandFailure(commandResult.error.code, commandResult.error.message))
  }

  await recordPaymentSaveEvent(adminClient, {
    stage: "submit",
    outcome: "success",
    severity: "info",
    attemptId,
    actorUserId: user.id,
    actorRole: "project_admin",
    projectId: commandResult.data.projectId,
    projectSlug: validation.data.projectSlug,
    paymentCount: commandResult.data.payments.length,
  })

  return json(edgeCommandSuccess(commandResult.data.payments))
}

const denoRuntime = getDenoRuntime()
if (denoRuntime?.serve) {
  denoRuntime.serve(handleRequest)
}

export { handleRequest }
