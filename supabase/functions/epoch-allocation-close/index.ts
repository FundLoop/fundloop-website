import { calculateFundedRedistribution, type FundedRedistributionInput } from "../../../lib/monthly-cycles/funded-redistribution-calculator.ts"
import { validateEpochAllocationCloseInput } from "../../../lib/edge-functions/epoch-allocation-close-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowedEnvironments = new Set(["local", "development", "dev", "preview", "test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
function errorCode(message: string) { return message.match(/epoch_close_[a-z_]+/)?.[0] ?? "epoch_close_failed" }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  if (!parsed.ok) return json(edgeCommandFailure("invalid_payload", parsed.error ?? "Request body must be valid JSON."))
  const validated = validateEpochAllocationCloseInput(parsed.body)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const deploymentEnvironment = environment()
  if (!allowedEnvironments.has(deploymentEnvironment)) return json(edgeCommandFailure("epoch_close_runtime_disabled", "Epoch close posting is unavailable in production."))
  const input = validated.data
  const internalAdmin = isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))
  if (input.action === "read") {
    if (input.scope === "operator") {
      if (!internalAdmin) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
      const { data, error } = await auth.adminClient.from("epoch_close_operator_view").select("*").eq("cycle_key", input.cycleKey)
      if (error) return json(edgeCommandFailure("epoch_close_read_failed", error.message))
      return json(edgeCommandSuccess({ action: "read", scope: input.scope, rows: data ?? [] }))
    }
    let projectId: number | null = null
    if (input.scope === "project") {
      const project = await auth.adminClient.from("projects").select("id").eq("slug", input.projectSlug).maybeSingle()
      if (project.error || !project.data) return json(edgeCommandFailure("epoch_close_project_unavailable", "Project not found."))
      projectId = project.data.id
    }
    const result = await auth.adminClient.rpc("read_epoch_close_scope", { p_actor_user_id: auth.user.id, p_scope: input.scope, p_cycle_key: input.cycleKey, p_project_id: projectId })
    if (result.error) return json(edgeCommandFailure(errorCode(result.error.message), result.error.message))
    return json(edgeCommandSuccess({ action: "read", scope: input.scope, rows: Array.isArray(result.data) ? result.data : [] }))
  }
  if (!internalAdmin) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  const locked = await auth.adminClient.rpc("lock_funded_epoch_allocation", {
    p_command: { contractVersion: "epoch_funded_allocation_lock.v1", deploymentEnvironment, actorUserId: auth.user.id, cycleKey: input.cycleKey },
  })
  if (locked.error) return json(edgeCommandFailure(errorCode(locked.error.message), locked.error.message))
  const manifest = locked.data as { manifestId: number; manifestHash: string; manifest: Omit<FundedRedistributionInput, "manifestHash"> }
  const run = await auth.adminClient.from("epoch_allocation_runs").select("id,result_hash").eq("manifest_id", manifest.manifestId).maybeSingle()
  if (run.error || !run.data) return json(edgeCommandFailure("epoch_close_run_unavailable", "A persisted allocation result is required."))
  try {
    const rerun = await calculateFundedRedistribution({ ...manifest.manifest, manifestHash: manifest.manifestHash })
    if (rerun.resultHash !== run.data.result_hash) return json(edgeCommandFailure("epoch_close_deterministic_rerun_mismatch", "The independent deterministic rerun did not match the persisted result."))
    const approved = await auth.adminClient.rpc("approve_epoch_allocation_close", { p_command: {
      contractVersion: "epoch_allocation_close.v1", deploymentEnvironment, actorUserId: auth.user.id, runId: run.data.id,
      manifestHash: manifest.manifestHash, resultHash: run.data.result_hash, rerunResultHash: rerun.resultHash,
    } })
    if (approved.error) return json(edgeCommandFailure(errorCode(approved.error.message), approved.error.message))
    return json(edgeCommandSuccess({ action: "approve", ...(approved.data as Record<string, unknown>) }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epoch close approval failed."
    return json(edgeCommandFailure(errorCode(message), message))
  }
}

serve(handleRequest)
export { handleRequest }
