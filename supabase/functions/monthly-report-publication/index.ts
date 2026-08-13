import { validateMonthlyReportPublicationInput } from "../../../lib/edge-functions/monthly-report-publication-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowedEnvironments = new Set(["local", "dev", "development", "test", "preview"])

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  if (!parsed.ok) return json(edgeCommandFailure("invalid_payload", parsed.error ?? "Request body must be valid JSON."))
  const validated = validateMonthlyReportPublicationInput(parsed.body)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const environment = (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
  if (!allowedEnvironments.has(environment)) return json(edgeCommandFailure("monthly_report_runtime_disabled", "Reporting commands are disabled."))
  const input = validated.data
  const internal = isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))
  if (input.action !== "read") {
    if (!internal) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
    const rpc = input.action === "generate" ? "generate_monthly_cycle_reports" : "publish_monthly_cycle_reports"
    const command = {
      contractVersion: input.action === "generate" ? "monthly_cycle_reports_generate.v1" : "monthly_cycle_reports_publish.v1",
      deploymentEnvironment: environment,
      actorUserId: auth.user.id,
      closePackageId: input.closePackageId,
      ...(input.action === "publish" ? { rootHash: input.rootHash } : {}),
    }
    const result = await auth.adminClient.rpc(rpc, { p_command: command })
    if (result.error) return json(edgeCommandFailure("monthly_report_command_failed", result.error.message))
    return json(edgeCommandSuccess({ action: input.action, ...result.data as Record<string, unknown> }))
  }
  let query = auth.adminClient.from("monthly_cycle_report_artifacts").select("audience,subject_user_id,subject_project_id,artifact,artifact_hash,published_at,state,monthly_cycles!inner(cycle_key)").eq("state", "published")
  if (input.cycleKey) query = query.eq("monthly_cycles.cycle_key", input.cycleKey)
  if (input.audience) query = query.eq("audience", input.audience)
  if (!internal) query = query.or(`audience.eq.public,and(audience.eq.user,subject_user_id.eq.${auth.user.id})`)
  const result = await query.order("published_at", { ascending: false })
  if (result.error) return json(edgeCommandFailure("monthly_report_read_failed", result.error.message))
  return json(edgeCommandSuccess({ action: "read", reports: result.data ?? [] }))
}

serve(handleRequest)
export { handleRequest }
