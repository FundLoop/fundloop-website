import { validateWithdrawalOperatorInput } from "../../../lib/edge-functions/withdrawal-operator-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowed = new Set(["local", "development", "dev", "preview", "test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
function code(message: string) { return message.match(/withdrawal_[a-z_]+/)?.[0] ?? "withdrawal_operator_failed" }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  const validated = validateWithdrawalOperatorInput(parsed.ok ? parsed.body : undefined)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  if (!isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  const deploymentEnvironment = environment()
  if (!allowed.has(deploymentEnvironment)) return json(edgeCommandFailure("withdrawal_runtime_disabled", "Withdrawal operations are unavailable in production."))
  const input = validated.data
  const result = input.action === "prepare"
    ? await auth.adminClient.rpc("prepare_epoch_withdrawal_obligations", { p_close_package_id: input.closePackageId, p_actor_user_id: auth.user.id, p_environment: deploymentEnvironment })
    : input.action === "hold"
      ? await auth.adminClient.rpc("place_withdrawal_compliance_hold", { p_actor_user_id: auth.user.id, p_request_id: input.requestId,
          p_reason_code: input.reasonCode, p_evidence_hash: input.evidenceHash, p_environment: deploymentEnvironment })
      : await auth.adminClient.rpc("expire_withdrawal_inventory_reservations", { p_now: new Date().toISOString(), p_environment: deploymentEnvironment })
  if (result.error) return json(edgeCommandFailure(code(result.error.message), result.error.message))
  return json(edgeCommandSuccess({ action: input.action, result: result.data, noPayoutExecuted: true }))
}

serve(handleRequest)
export { handleRequest }
