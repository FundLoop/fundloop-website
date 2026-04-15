import { validateUserOnboardingDraftUpsertInput } from "../../../lib/edge-functions/user-onboarding-draft-upsert-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeUserOnboardingDraftUpsertCommand } from "../../../lib/onboarding/user-onboarding-commands.ts"
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "../_shared/command-runtime.js"

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

  const validation = validateUserOnboardingDraftUpsertInput(bodyResult.body)
  if (!validation.ok) {
    return json(validation)
  }

  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return json(edgeCommandFailure(auth.code ?? "function_not_configured", auth.error))
  }

  const result = await executeUserOnboardingDraftUpsertCommand(auth.adminClient, {
    actorUserId: auth.user.id,
    currentScreen: validation.data.currentScreen,
    payload: validation.data.payload,
  })

  if (!result.ok) {
    return json(edgeCommandFailure(result.error.code, result.error.message))
  }

  return json(edgeCommandSuccess(result.data))
}

serve(handleRequest)

export { handleRequest }
