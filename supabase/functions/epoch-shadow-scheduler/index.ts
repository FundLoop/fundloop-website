import { validateEpochShadowSchedulerInput } from "../../../lib/edge-functions/epoch-shadow-scheduler-contract.ts"
import { edgeCommandFailure } from "../../../lib/edge-functions/result.ts"
import { runEpochShadowScheduler } from "../../../lib/monthly-cycles/epoch-shadow-scheduler.ts"
import { authenticateRequestOrInternalSecret, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  const environment = (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").toLowerCase()
  if (environment === "production") return json(edgeCommandFailure("production_disabled", "Epoch shadow scheduling is unavailable in production."))
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const auth = await authenticateRequestOrInternalSecret(request, {
    secretEnvName: "FUNDLOOP_EPOCH_SCHEDULER_SECRET", secretHeaderName: "x-fundloop-cron-secret",
  })
  if (!auth.ok || auth.mode !== "internal_secret") return json(edgeCommandFailure(auth.code ?? "forbidden", auth.error ?? "Internal scheduler authorization required."))
  const validation = validateEpochShadowSchedulerInput(body.body, environment)
  if (!validation.ok) return json(validation)
  const result = await runEpochShadowScheduler(auth.adminClient, validation.data)
  return json(result.ok ? { ok: true, data: result } : edgeCommandFailure("scheduler_failed", result.error))
}

serve(handleRequest)
export { handleRequest }
