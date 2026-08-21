import { calculateFundedRedistributionV2, type FundedRedistributionV2Input } from "../../../lib/monthly-cycles/funded-redistribution-v2-calculator.ts"
import { validateEpochAllocationCloseInput } from "../../../lib/edge-functions/epoch-allocation-close-contract.ts"
import { handleRequest as handleAuthenticatedHttpRequest, commandFailure } from "../../../lib/edge-functions/authenticated-command-http.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowedEnvironments = new Set(["local", "development", "dev", "preview", "test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
function errorCode(message: string) {
  return message.match(/epoch_close_[a-z0-9_]+/)?.[0] ?? message.match(/funded_allocation_v2_[a-z0-9_]+/)?.[0] ?? "epoch_close_failed"
}
function failure(code: string, message: string, status: number, headers?: HeadersInit) {
  return commandFailure(code, message, status, headers)
}

type HandlerDependencies = { authenticateRequest?: typeof authenticateRequest }

async function handleRequest(request: Request, dependencies?: HandlerDependencies) {
  // Deno.serve supplies connection info as its second handler argument. Only
  // treat that position as test injection when it contains the explicit auth
  // function; otherwise use the real command-runtime boundary.
  const authenticate = typeof dependencies?.authenticateRequest === "function"
    ? dependencies.authenticateRequest
    : authenticateRequest
  return handleAuthenticatedHttpRequest(request, authenticate, async (auth) => {
    const parsed = await parseJsonBody(request)
    if (!parsed.ok) return failure("invalid_payload", parsed.error ?? "Request body must be valid JSON.", 400)
    const validated = validateEpochAllocationCloseInput(parsed.body)
    if (!validated.ok) return json(validated, { status: 400 })
    const deploymentEnvironment = environment()
    if (!allowedEnvironments.has(deploymentEnvironment)) return json(edgeCommandFailure("epoch_close_runtime_disabled", "Epoch close posting is unavailable in production."))
    const input = validated.data
    const internalAdmin = isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))
    if (input.action === "read") {
      if (input.scope === "operator") {
        if (!internalAdmin) return failure("forbidden", "Internal operator access is required.", 403)
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
    if (!internalAdmin) return failure("forbidden", "Internal operator access is required.", 403)
    if (input.action === "confirm_root") {
      const confirmed = await auth.adminClient.rpc("confirm_epoch_allocation_close_root", { p_command: {
        contractVersion: "epoch_allocation_close_root.v1", deploymentEnvironment, actorUserId: auth.user.id,
        closePackageId: input.closePackageId, rootHash: input.rootHash,
      } })
      if (confirmed.error) return json(edgeCommandFailure(errorCode(confirmed.error.message), confirmed.error.message))
      return json(edgeCommandSuccess({ action: "confirm_root", ...(confirmed.data as Record<string, unknown>) }))
    }
    const cycle = await auth.adminClient.from("monthly_cycles").select("id").eq("cycle_key", input.cycleKey).maybeSingle()
    if (cycle.error || !cycle.data) return json(edgeCommandFailure("epoch_close_cycle_invalid", "Cycle not found."))
    const locked = await auth.adminClient.from("epoch_allocation_manifests")
      .select("id,manifest_hash,manifest,status")
      .eq("monthly_cycle_id", cycle.data.id)
      .eq("policy_key", "settled_cubid_redistribution_v2")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (locked.error || !locked.data || !["locked", "calculated"].includes(locked.data.status)) {
      return json(edgeCommandFailure("epoch_close_v2_manifest_unavailable", "A selected and calculated v2 allocation manifest is required."))
    }
    const manifest = {
      manifestId: locked.data.id,
      manifestHash: locked.data.manifest_hash,
      manifest: locked.data.manifest as Omit<FundedRedistributionV2Input, "manifestHash">,
    }
    const run = await auth.adminClient.from("epoch_allocation_runs").select("id,result_hash").eq("manifest_id", manifest.manifestId).maybeSingle()
    if (run.error || !run.data) return json(edgeCommandFailure("epoch_close_run_unavailable", "A persisted allocation result is required."))
    try {
      const rerun = await calculateFundedRedistributionV2({ ...manifest.manifest, manifestHash: manifest.manifestHash })
      if (rerun.resultHash !== run.data.result_hash) return json(edgeCommandFailure("epoch_close_deterministic_rerun_mismatch", "The independent deterministic rerun did not match the persisted result."))
      const approved = await auth.adminClient.rpc("approve_epoch_allocation_close_v2", { p_command: {
        contractVersion: "epoch_allocation_close.v2", deploymentEnvironment, actorUserId: auth.user.id, runId: run.data.id,
        manifestHash: manifest.manifestHash, resultHash: run.data.result_hash, rerunResultHash: rerun.resultHash,
      } })
      if (approved.error) return json(edgeCommandFailure(errorCode(approved.error.message), approved.error.message))
      return json(edgeCommandSuccess({ action: "approve", ...(approved.data as Record<string, unknown>) }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Epoch close approval failed."
      return json(edgeCommandFailure(errorCode(message), message))
    }
  })
}

serve(handleRequest)
export { handleRequest }
