import { validateProjectMonthlyContributionSubmitInput } from "../../../lib/edge-functions/project-monthly-contribution-submit-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeProjectMonthlyContributionSubmitCommand } from "../../../lib/contributions/project-monthly-contribution-command.ts"
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  }

  const bodyResult = await parseJsonBody(request)
  const validation = validateProjectMonthlyContributionSubmitInput(bodyResult.ok ? bodyResult.body : undefined)
  if (!validation.ok) {
    return json(validation)
  }

  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return json(edgeCommandFailure(auth.code ?? "function_not_configured", auth.error))
  }

  const commandResult = await executeProjectMonthlyContributionSubmitCommand(auth.adminClient, {
    ...validation.data,
    actorUserId: auth.user.id,
  })

  if (!commandResult.ok) {
    return json(edgeCommandFailure(commandResult.error.code, commandResult.error.message))
  }

  return json(edgeCommandSuccess(commandResult.data))
}

serve(handleRequest)

export { handleRequest }
