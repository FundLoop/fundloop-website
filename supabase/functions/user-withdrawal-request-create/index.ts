import { validateUserWithdrawalRequestCreateInput } from "../../../lib/edge-functions/user-withdrawal-request-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeUserWithdrawalRequestCreate } from "../../../lib/withdrawals/user-withdrawal-request-command.ts"
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  const body = await parseJsonBody(request)
  const validation = validateUserWithdrawalRequestCreateInput(body.ok ? body.body : undefined)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const result = await executeUserWithdrawalRequestCreate(auth.adminClient, { ...validation.data, actorUserId: auth.user.id })
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }
