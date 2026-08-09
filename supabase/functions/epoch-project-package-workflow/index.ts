import { validateEpochProjectPackageWorkflowInput } from "../../../lib/edge-functions/epoch-project-package-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function environment() {
  return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
}

function internalAdmin(email: string | undefined | null) {
  return isInternalAdminEmail(email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))
}

function failureCode(message: string) {
  const match = message.match(/epoch_project_package_[a-z_]+/)
  return match?.[0] ?? "epoch_project_package_command_failed"
}

function summary(row: Record<string, unknown>) {
  return {
    id: Number(row.id), projectId: Number(row.project_id), projectName: String(row.project_name), projectSlug: String(row.project_slug),
    intendedCycleKey: String(row.intended_cycle_key), canonicalCycleKey: row.canonical_cycle_key ? String(row.canonical_cycle_key) : null,
    version: Number(row.version), status: row.status, listStatus: row.list_status, fundingStatus: row.funding_status,
    complianceStatus: row.compliance_status, cubidStatus: row.cubid_status, cutoffAt: String(row.cutoff_at),
    reconciliationEmailDeliveredAt: row.reconciliation_email_delivered_at ? String(row.reconciliation_email_delivered_at) : null,
    reconciliationDeadlineAt: row.reconciliation_deadline_at ? String(row.reconciliation_deadline_at) : null,
    paymentCount: Number(row.payment_count), fundingSourceCount: Number(row.funding_source_count), cohortCount: Number(row.cohort_count),
    eligibleUserCount: Number(row.eligible_user_count), heldUserCount: Number(row.held_user_count),
    preliminaryUsd: String(row.preliminary_usd), manifestHash: String(row.manifest_hash),
    projectFeeAssessedOnce: Boolean(row.project_fee_assessed_once), baseFeeDeferred: Boolean(row.base_fee_deferred),
  }
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const validation = validateEpochProjectPackageWorkflowInput(body.body)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const input = validation.data
  const runtimeEnvironment = environment()
  const isOperator = internalAdmin(auth.user.email)

  if ((input.action === "validate" || input.action === "send_reconciliation_email" || input.action === "finalize_silent") && !isOperator) {
    return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  }
  if (input.action === "read" && !input.projectSlug && !isOperator) {
    return json(edgeCommandFailure("forbidden", "A project scope is required."))
  }

  if (input.action === "read") {
    const { data, error } = await auth.adminClient.rpc("list_epoch_project_packages", {
      p_actor_user_id: auth.user.id,
      p_project_slug: input.projectSlug ?? null,
    })
    if (error) return json(edgeCommandFailure(failureCode(error.message), error.message))
    return json(edgeCommandSuccess({ action: "read", packages: (data ?? []).map((row) => summary(row as Record<string, unknown>)) }))
  }

  if (input.action === "validate") {
    const { data, error } = await auth.adminClient.rpc("validate_epoch_project_package", { p_command: {
      ...input, deploymentEnvironment: runtimeEnvironment, actorRole: "internal_admin", actorUserId: auth.user.id,
    } })
    if (error) return json(edgeCommandFailure(failureCode(error.message), error.message))
    return json(edgeCommandSuccess({ action: "validate", packageId: Number(data) }))
  }

  if (input.action === "send_reconciliation_email") {
    if (runtimeEnvironment !== "local" && runtimeEnvironment !== "test") {
      return json(edgeCommandFailure("epoch_project_package_email_provider_disabled", "Reconciliation email delivery is local/test only."))
    }
    const mailpitUrl = getEnv("FUNDLOOP_MAILPIT_API_URL")?.trim().replace(/\/$/, "")
    if (!mailpitUrl?.startsWith("http://")) return json(edgeCommandFailure("epoch_project_package_email_not_configured", "Local Mailpit API is not configured."))
    const { data: preparedRows, error: prepareError } = await auth.adminClient.rpc("prepare_epoch_project_package_email", {
      p_package_id: input.packageId, p_actor_user_id: auth.user.id, p_actor_role: "internal_admin", p_environment: runtimeEnvironment,
    })
    if (prepareError || !preparedRows?.[0]) return json(edgeCommandFailure(failureCode(prepareError?.message ?? ""), prepareError?.message ?? "Package email could not be prepared."))
    const prepared = preparedRows[0]
    const response = await fetch(`${mailpitUrl}/api/v1/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      From: { Email: "review@fundloop.local", Name: "FundLoop Review" },
      To: [{ Email: prepared.recipient_email }], Subject: prepared.subject, Text: prepared.text_body,
      Headers: { "X-FundLoop-Package": String(input.packageId) }, Tags: ["fundloop", "reconciliation"],
    }) })
    if (!response.ok) return json(edgeCommandFailure("epoch_project_package_email_delivery_failed", `Mailpit rejected delivery (${response.status}).`))
    const provider = await response.json().catch(() => ({})) as { ID?: string; id?: string }
    const providerMessageId = String(provider.ID ?? provider.id ?? `mailpit-${input.packageId}-${Date.now()}`)
    const deliveredAt = new Date().toISOString()
    const { data: deliveryEventId, error: recordError } = await auth.adminClient.rpc("record_epoch_project_package_email_delivery", { p_command: {
      contractVersion: "epoch_project_package_email.v1", deploymentEnvironment: runtimeEnvironment,
      packageId: input.packageId, attemptId: input.attemptId ?? crypto.randomUUID(), providerKey: "mailpit_local",
      providerMessageId, recipientHash: prepared.recipient_hash, evidenceHash: prepared.evidence_hash,
      actorUserId: auth.user.id, deliveredAt,
    } })
    if (recordError) return json(edgeCommandFailure(failureCode(recordError.message), recordError.message))
    const { data: rows } = await auth.adminClient.rpc("list_epoch_project_packages", { p_actor_user_id: auth.user.id, p_project_slug: null })
    const updated = (rows ?? []).find((row) => Number(row.id) === input.packageId)
    return json(edgeCommandSuccess({ action: "send_reconciliation_email", packageId: input.packageId,
      deliveryEventId: Number(deliveryEventId), providerMessageId, deadlineAt: String(updated?.reconciliation_deadline_at ?? deliveredAt) }))
  }

  if (input.action === "approve" || input.action === "opt_out") {
    const { data, error } = await auth.adminClient.rpc("decide_epoch_project_package", { p_command: {
      contractVersion: "epoch_project_package_decision.v1", deploymentEnvironment: runtimeEnvironment,
      packageId: input.packageId, decision: input.action === "approve" ? "approve" : "opt_out",
      actorUserId: auth.user.id, evidenceHash: input.evidenceHash,
      ...(input.action === "opt_out" ? { reason: input.reason.trim() } : {}), ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
    } })
    if (error) return json(edgeCommandFailure(failureCode(error.message), error.message))
    return json(edgeCommandSuccess({ action: input.action, packageId: input.packageId, decisionEventId: Number(data) }))
  }

  const { data, error } = await auth.adminClient.rpc("finalize_silent_epoch_project_packages", {
    p_environment: runtimeEnvironment, p_now: input.observedAt ?? new Date().toISOString(),
  })
  if (error) return json(edgeCommandFailure(failureCode(error.message), error.message))
  return json(edgeCommandSuccess({ action: "finalize_silent", finalizedCount: Number(data) }))
}

serve(handleRequest)
export { handleRequest }
