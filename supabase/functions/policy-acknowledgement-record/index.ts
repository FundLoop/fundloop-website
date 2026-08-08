import { validatePolicyAcknowledgementInput } from "../../../lib/edge-functions/policy-acknowledgement-contract.ts"
import { executePolicyAcknowledgementCommand } from "../../../lib/policies/policy-acknowledgement-command.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const validation = validatePolicyAcknowledgementInput(body.body)
  if (!validation.ok) return json(validation)
  const result = await executePolicyAcknowledgementCommand(auth.adminClient, auth.user.id, validation.data)
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }

