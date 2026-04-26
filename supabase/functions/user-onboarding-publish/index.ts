import { validateUserOnboardingPublishInput } from "../../../lib/edge-functions/user-onboarding-publish-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeUserOnboardingPublishCommand } from "../../../lib/onboarding/user-onboarding-commands.ts"
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  }

  const bodyResult = await parseJsonBody(request)
  const validation = validateUserOnboardingPublishInput(bodyResult.ok ? bodyResult.body : undefined)
  if (!validation.ok) {
    return json(validation)
  }

  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return json(edgeCommandFailure(auth.code ?? "function_not_configured", auth.error))
  }

  const result = await executeUserOnboardingPublishCommand(auth.adminClient, {
    actorUserId: auth.user.id,
    actorEmail: auth.user.email ?? null,
  })

  if (!result.ok) {
    return json(edgeCommandFailure(result.error.code, result.error.message))
  }

  return json(edgeCommandSuccess(result.data))
}

serve(handleRequest)

export { handleRequest }
