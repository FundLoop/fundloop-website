import { isFinancialCutoverEnvironmentEnabled, validateFinancialCutoverInput } from "../../../lib/edge-functions/financial-cutover-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
function errorCode(message: string) { return message.match(/financial_cutover_[a-z_]+/)?.[0] ?? "financial_cutover_failed" }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  const validated = validateFinancialCutoverInput(parsed.ok ? parsed.body : undefined)
  if (!validated.ok) return json(validated)
  const deploymentEnvironment = environment()
  if (!isFinancialCutoverEnvironmentEnabled(deploymentEnvironment)) {
    return json(edgeCommandFailure("financial_cutover_runtime_disabled", "Financial cutover is unavailable in production."))
  }
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  if (!isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) {
    return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  }
  const input = validated.data
  if (input.action === "read") {
    const [report, sources] = await Promise.all([
      auth.adminClient.from("financial_cutover_reconciliation_report").select("*").eq("run_id", input.runId),
      auth.adminClient.from("financial_cutover_source_report").select("*").eq("run_id", input.runId).order("source_type").order("source_id"),
    ])
    if (report.error || sources.error) return json(edgeCommandFailure("financial_cutover_read_failed", report.error?.message ?? sources.error?.message ?? "Cutover report unavailable."))
    return json(edgeCommandSuccess({ action: "read", report: report.data ?? [], sources: sources.data ?? [], noValueTransferred: true }))
  }
  const command = input.action === "prepare"
    ? { contractVersion: "financial_cutover_prepare.v1", deploymentEnvironment, idempotencyKey: input.idempotencyKey,
        evidenceHash: input.evidenceHash, approvedOpeningBalances: input.approvedOpeningBalances }
    : { contractVersion: input.action === "activate" ? "financial_cutover_activate.v1" : "financial_cutover_rollback.v1",
        deploymentEnvironment, runId: input.runId, manifestHash: input.manifestHash, evidenceHash: input.evidenceHash }
  const result = input.action === "prepare"
    ? await auth.adminClient.rpc("prepare_financial_cutover", { p_actor_user_id: auth.user.id, p_command: command })
    : input.action === "activate"
      ? await auth.adminClient.rpc("activate_financial_cutover", { p_actor_user_id: auth.user.id, p_command: command })
      : await auth.adminClient.rpc("rollback_financial_cutover", { p_actor_user_id: auth.user.id, p_command: command })
  if (result.error) return json(edgeCommandFailure(errorCode(result.error.message), result.error.message))
  return json(edgeCommandSuccess({ action: input.action, result: result.data, noValueTransferred: true }))
}

serve(handleRequest)
export { handleRequest }
