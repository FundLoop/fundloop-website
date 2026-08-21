import { validateMonthlyCycleBookkeepingCreditsCreateInput } from "../../../lib/edge-functions/monthly-cycle-bookkeeping-credits-create-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { executeMonthlyCycleBookkeepingCreditsCreateCommand } from "../../../lib/monthly-cycles/monthly-cycle-bookkeeping-credits-command.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function getActorRole(user) {
  return user?.email && isInternalAdminEmail(user.email, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS")) ? "internal_admin" : null
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))

  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))

  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))

  const actorRole = getActorRole(auth.user)
  if (!actorRole) return json(edgeCommandFailure("forbidden", "You do not have internal admin access."))

  const validation = validateMonthlyCycleBookkeepingCreditsCreateInput(body.body)
  if (!validation.ok) return json(validation)

  const result = await executeMonthlyCycleBookkeepingCreditsCreateCommand(auth.adminClient, {
    ...validation.data,
    attemptId: validation.data.attemptId ?? crypto.randomUUID(),
    actorUserId: auth.user.id,
    actorRole,
  })

  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)

export { handleRequest }
