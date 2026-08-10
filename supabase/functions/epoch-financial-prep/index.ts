import { validateEpochFinancialPrepInput } from "../../../lib/edge-functions/epoch-financial-prep-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowed = new Set(["local","development","dev","preview","test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  if (!parsed.ok) return json(edgeCommandFailure("invalid_payload", parsed.error ?? "Request body must be valid JSON."))
  const validated = validateEpochFinancialPrepInput(parsed.body)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  if (!isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  const runtime = environment()
  if (!allowed.has(runtime)) return json(edgeCommandFailure("epoch_financial_prep_runtime_disabled", "Financial prep is unavailable in production."))
  const input = validated.data
  if (input.action === "read") {
    let query = auth.adminClient.from("epoch_financial_prep_operator_view").select("*").order("deterministic_source_order")
    if (input.cycleKey) query = query.eq("cycle_key", input.cycleKey)
    const { data, error } = await query
    if (error) return json(edgeCommandFailure("epoch_financial_prep_read_failed", error.message))
    return json(edgeCommandSuccess({ action: "read", sources: data ?? [] }))
  }
  const trusted = { ...input, deploymentEnvironment: runtime, actorUserId: auth.user.id }
  const rpc = input.action === "record_fx" ? "record_epoch_fx_observation"
    : input.action === "post_fx" ? "post_epoch_fx_snapshot"
    : input.action === "prepare_sources" ? "prepare_epoch_financial_sources" : "harvest_epoch_source_lot"
  const contractVersion = input.action === "record_fx" ? "epoch_fx_observation.v1" : input.action === "post_fx" ? "epoch_fx_snapshot.v1"
    : input.action === "prepare_sources" ? "epoch_financial_prep.v1" : "epoch_source_harvest.v1"
  const { data, error } = await auth.adminClient.rpc(rpc, { p_command: { ...trusted, contractVersion } })
  if (error) return json(edgeCommandFailure(error.message.match(/epoch_[a-z_]+/)?.[0] ?? "epoch_financial_prep_failed", error.message))
  return json(edgeCommandSuccess({ action: input.action, result: Number(data) }))
}

serve(handleRequest)
export { handleRequest }
