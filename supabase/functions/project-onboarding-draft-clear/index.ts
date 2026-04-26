import { validateProjectOnboardingDraftClearInput } from "../../../lib/edge-functions/project-onboarding-draft-clear-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeProjectOnboardingDraftClearCommand } from "../../../lib/onboarding/project-onboarding-commands.ts"
import { authenticateRequest, corsHeaders, json, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  }

  const validation = validateProjectOnboardingDraftClearInput()
  if (!validation.ok) {
    return json(validation)
  }

  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return json(edgeCommandFailure(auth.code ?? "function_not_configured", auth.error))
  }

  const result = await executeProjectOnboardingDraftClearCommand(auth.adminClient, {
    actorUserId: auth.user.id,
  })

  if (!result.ok) {
    return json(edgeCommandFailure(result.error.code, result.error.message))
  }

  return json(edgeCommandSuccess(null))
}

serve(handleRequest)

export { handleRequest }
