import { calculateFundedRedistributionV2, type FundedRedistributionV2Input } from "../../../lib/monthly-cycles/funded-redistribution-v2-calculator.ts"
import { validateEpochFundedAllocationInput } from "../../../lib/edge-functions/epoch-funded-allocation-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowedEnvironments = new Set(["local", "development", "dev", "preview", "test"])

function deploymentEnvironment() {
  return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
}

function errorCode(message: string) {
  return message.match(/epoch_allocation_[a-z0-9_]+/)?.[0] ?? message.match(/funded_allocation_v2_[a-z0-9_]+/)?.[0] ?? "epoch_allocation_failed"
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  }
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request)
  if (!parsed.ok) return json(edgeCommandFailure("invalid_payload", parsed.error ?? "Request body must be valid JSON."))
  const validated = validateEpochFundedAllocationInput(parsed.body)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  if (!isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) {
    return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  }
  const environment = deploymentEnvironment()
  if (!allowedEnvironments.has(environment)) {
    return json(edgeCommandFailure("epoch_allocation_runtime_disabled", "Funded allocation is unavailable in production."))
  }
  const input = validated.data
  if (input.action === "read") {
    let query = auth.adminClient.from("epoch_allocation_operator_view_v2").select("*").order("cycle_key", { ascending: false })
    if (input.cycleKey) query = query.eq("cycle_key", input.cycleKey)
    const { data, error } = await query
    if (error) return json(edgeCommandFailure("epoch_allocation_read_failed", error.message))
    return json(edgeCommandSuccess({ action: "read", allocations: data ?? [] }))
  }
  if (input.action === "preview") {
    const preview = await auth.adminClient.rpc("epoch_allocation_v2_preview_input", {
      p_cycle_key: input.cycleKey,
      p_cap_multiple: input.capMultiple,
      p_environment: environment,
    })
    if (preview.error) return json(edgeCommandFailure(errorCode(preview.error.message), preview.error.message))
    const previewInput = preview.data as Omit<FundedRedistributionV2Input, "manifestHash" | "selectedPreviewHash"> & { inputHash: string }
    try {
      const artifact = await calculateFundedRedistributionV2({
        ...previewInput,
        manifestHash: previewInput.inputHash,
        selectedPreviewHash: previewInput.inputHash,
      })
      return json(edgeCommandSuccess({ action: "preview", previewHash: previewInput.inputHash, artifact }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Allocation preview failed."
      return json(edgeCommandFailure(errorCode(message), message))
    }
  }
  if (input.action === "lock") {
    const lock = await auth.adminClient.rpc("lock_funded_epoch_allocation_v2", {
      p_command: {
        contractVersion: "epoch_funded_allocation_lock.v2",
        deploymentEnvironment: environment,
        actorUserId: auth.user.id,
        cycleKey: input.cycleKey,
        capMultiple: input.capMultiple,
        selectedPreviewHash: input.selectedPreviewHash,
      },
    })
    if (lock.error) return json(edgeCommandFailure(errorCode(lock.error.message), lock.error.message))
    return json(edgeCommandSuccess({ action: "lock", ...(lock.data as Record<string, unknown>) }))
  }
  const cycle = await auth.adminClient.from("monthly_cycles").select("id").eq("cycle_key", input.cycleKey).maybeSingle()
  if (cycle.error || !cycle.data) return json(edgeCommandFailure("epoch_allocation_cycle_invalid", "Cycle not found."))
  const lockedResult = await auth.adminClient.from("epoch_allocation_manifests")
    .select("id,manifest_hash,manifest").eq("monthly_cycle_id", cycle.data.id)
    .eq("policy_key", "settled_cubid_redistribution_v2").order("version", { ascending: false }).limit(1).maybeSingle()
  if (lockedResult.error || !lockedResult.data) {
    return json(edgeCommandFailure("epoch_allocation_v2_manifest_not_locked", "Select and lock a cap preview before calculating."))
  }
  const locked = {
    manifestId: lockedResult.data.id,
    manifestHash: lockedResult.data.manifest_hash,
    manifest: lockedResult.data.manifest as Omit<FundedRedistributionV2Input, "manifestHash">,
  }
  try {
    const artifact = await calculateFundedRedistributionV2({ ...locked.manifest, manifestHash: locked.manifestHash })
    const recorded = await auth.adminClient.rpc("record_funded_epoch_allocation_v2", {
    p_command: {
      contractVersion: "epoch_funded_allocation_result.v2",
      deploymentEnvironment: environment,
      actorUserId: auth.user.id,
      manifestId: locked.manifestId,
      resultHash: artifact.resultHash,
      artifact,
    },
  })
    if (recorded.error) return json(edgeCommandFailure(errorCode(recorded.error.message), recorded.error.message))
    return json(edgeCommandSuccess({ action: "calculate", manifestId: locked.manifestId, runId: Number(recorded.data), artifact }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Funded allocation calculation failed."
    return json(edgeCommandFailure(errorCode(message), message))
  }
}

serve(handleRequest)
export { handleRequest }
