import { validateUserWithdrawalRequestInput } from "../../../lib/edge-functions/user-withdrawal-request-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeUserWithdrawalRequestCreate } from "../../../lib/withdrawals/user-withdrawal-request-command.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowedEnvironments = new Set(["local", "development", "dev", "preview", "test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  const body = await parseJsonBody(request)
  const validation = validateUserWithdrawalRequestInput(body.ok ? body.body : undefined)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const deploymentEnvironment = environment()
  if (!allowedEnvironments.has(deploymentEnvironment)) return json(edgeCommandFailure("withdrawal_runtime_disabled", "Withdrawal reservations are unavailable in production."))
  const result = await executeUserWithdrawalRequestCreate(auth.adminClient, { ...validation.data, actorUserId: auth.user.id, deploymentEnvironment })
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }
