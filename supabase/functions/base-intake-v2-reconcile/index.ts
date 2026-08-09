import { validateBaseIntakeReconciliationCommand } from "../../../lib/onchain/base-intake-v2-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequestOrInternalSecret, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const environment = (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "").toLowerCase()
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const auth = await authenticateRequestOrInternalSecret(request, {
    secretEnvName: "FUNDLOOP_BASE_INTAKE_SECRET",
    secretHeaderName: "x-fundloop-base-intake-secret",
  })
  if (!auth.ok || auth.mode !== "internal_secret") return json(edgeCommandFailure("forbidden", "Internal Base reconciliation authorization required."))
  const input = validateBaseIntakeReconciliationCommand(body.body, environment)
  if (!input.ok) return json(input)
  const { data, error } = await auth.adminClient.rpc("reconcile_base_intake_v2_receipt", {
    p_command: { ...input.data, deploymentEnvironment: environment },
  })
  return json(error ? edgeCommandFailure("reconciliation_failed", error.message) : edgeCommandSuccess({ reconciliationId: data }))
}

serve(handleRequest)
export { handleRequest }
