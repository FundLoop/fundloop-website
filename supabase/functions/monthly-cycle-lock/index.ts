import { validateMonthlyCycleLockInput } from "../../../lib/edge-functions/monthly-cycle-lock-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { executeMonthlyCycleLockCommand } from "../../../lib/monthly-cycles/monthly-cycle-lock-command.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function getActorRole(user) {
  if (!user?.email || !isInternalAdminEmail(user.email, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) {
    return null
  }

  return "internal_admin"
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  }

  const bodyResult = await parseJsonBody(request)
  if (!bodyResult.ok) {
    return json(edgeCommandFailure("invalid_payload", bodyResult.error))
  }

  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  }

  const actorRole = getActorRole(auth.user)
  if (!actorRole) {
    return json(edgeCommandFailure("forbidden", "You do not have internal admin access."))
  }

  const validation = validateMonthlyCycleLockInput(bodyResult.body)
  if (!validation.ok) {
    return json(validation)
  }

  const result = await executeMonthlyCycleLockCommand(auth.adminClient, {
    cycleKey: validation.data.cycleKey,
    attemptId: validation.data.attemptId ?? crypto.randomUUID(),
    actorUserId: auth.user.id,
    actorRole,
    overrideUnresolvedOnchain: validation.data.overrideUnresolvedOnchain,
    overrideReason: validation.data.overrideReason,
  })

  if (!result.ok) {
    return json(edgeCommandFailure(result.error.code, result.error.message))
  }

  return json(edgeCommandSuccess(result.data))
}

serve(handleRequest)

export { handleRequest }
