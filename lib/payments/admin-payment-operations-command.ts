import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizePaymentFlowErrorCode,
  normalizePaymentFlowErrorMessage,
  sanitizePaymentFlowMetadata,
  type PaymentFlow,
  type PaymentFlowActorRole,
  type PaymentFlowStage,
} from "../observability/payment-flow.ts"
import {
  runOnchainPaymentReconciliation,
  type OnchainReconciliationRunSummary,
  type ReconciliationRunSource,
} from "../onchain/payment-reconciliation.ts"
import type { Database } from "../../types/supabase.ts"

export type AdminPaymentOperationsCommandDeps = {
  environment: "local" | "preview" | "production"
}

export type AdminPaymentReceiptConfirmInput = {
  actorUserId: string
  actorRole: "internal_admin"
  attemptId: string
  paymentId: number
}

export type AdminOnchainPaymentReconciliationRunInput = {
  actorUserId: string | null
  actorRole: "internal_admin" | "system"
  attemptId: string
  source: ReconciliationRunSource
  limit?: number
  paymentId?: number
  submissionId?: number
}

export type AdminPaymentReceiptConfirmOutput = {
  paymentId: number
  statusCode: string
  confirmedAt: string
}

export type AdminPaymentOperationsCommandError = {
  code: string
  message: string
  projectId: number | null
  paymentId: number | null
  submissionId: number | null
}

export type AdminPaymentOperationsCommandResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: AdminPaymentOperationsCommandError
    }

function commandFailure(
  code: string,
  message: string,
  options?: {
    projectId?: number | null
    paymentId?: number | null
    submissionId?: number | null
  },
): Extract<AdminPaymentOperationsCommandResult<never>, { ok: false }> {
  return {
    ok: false,
    error: {
      code,
      message,
      projectId: options?.projectId ?? null,
      paymentId: options?.paymentId ?? null,
      submissionId: options?.submissionId ?? null,
    },
  }
}

async function recordAdminPaymentEvent(
  supabase: SupabaseClient<Database>,
  deps: AdminPaymentOperationsCommandDeps,
  input: {
    flow: PaymentFlow
    stage: PaymentFlowStage
    outcome: "attempt" | "success" | "failure"
    attemptId: string
    actorUserId?: string | null
    actorRole: PaymentFlowActorRole
    projectId?: number | null
    paymentId?: number | null
    submissionId?: number | null
    error?: unknown
    metadata?: Record<string, unknown>
  },
) {
  try {
    await supabase.from("payment_flow_events").insert({
      flow: input.flow,
      stage: input.stage,
      outcome: input.outcome,
      severity: input.outcome === "failure" ? "error" : "info",
      attempt_id: input.attemptId,
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole,
      project_id: input.projectId ?? null,
      payment_id: input.paymentId ?? null,
      submission_id: input.submissionId ?? null,
      environment: deps.environment,
      error_code: input.error ? normalizePaymentFlowErrorCode(input.stage, input.error) : null,
      error_message: input.error ? normalizePaymentFlowErrorMessage(input.error) : null,
      metadata: sanitizePaymentFlowMetadata(input.metadata ?? {}),
    })
  } catch (error) {
    console.error("Failed to store admin payment observability event", error)
  }
}

export async function executeAdminPaymentReceiptConfirmCommand(
  supabase: SupabaseClient<Database>,
  input: AdminPaymentReceiptConfirmInput,
  deps: AdminPaymentOperationsCommandDeps,
): Promise<AdminPaymentOperationsCommandResult<AdminPaymentReceiptConfirmOutput>> {
  await recordAdminPaymentEvent(supabase, deps, {
    flow: "admin_confirmation",
    stage: "submit",
    outcome: "attempt",
    attemptId: input.attemptId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    paymentId: input.paymentId,
  })

  const [
    { data: payment, error: paymentError },
    { data: confirmedStatus, error: confirmedStatusError },
    { data: onchainSubmission, error: onchainSubmissionError },
  ] = await Promise.all([
    supabase.from("payments").select("id, project_id, projects(slug)").eq("id", input.paymentId).single(),
    supabase.from("ref_payment_statuses").select("id, code").eq("code", "confirmed").single(),
    supabase.from("onchain_payment_submissions").select("id").eq("payment_id", input.paymentId).limit(1).maybeSingle(),
  ])

  if (paymentError || confirmedStatusError || onchainSubmissionError) {
    const error = "Failed to load payment confirmation prerequisites."
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      paymentId: input.paymentId,
      error,
      metadata: {
        paymentQueryFailed: Boolean(paymentError),
        confirmedStatusQueryFailed: Boolean(confirmedStatusError),
        onchainSubmissionQueryFailed: Boolean(onchainSubmissionError),
      },
    })
    return commandFailure("query_failed", error, { paymentId: input.paymentId })
  }

  if (!payment) {
    const error = "Payment not found."
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      paymentId: input.paymentId,
      error,
    })
    return commandFailure("payment_not_found", error, { paymentId: input.paymentId })
  }

  if (onchainSubmission?.id) {
    const error = "Crypto-submitted payments must be advanced by onchain reconciliation instead of manual confirmation."
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      projectId: payment.project_id,
      paymentId: input.paymentId,
      submissionId: onchainSubmission.id,
      error,
    })
    return commandFailure("requires_reconciliation", error, {
      projectId: payment.project_id,
      paymentId: input.paymentId,
      submissionId: onchainSubmission.id,
    })
  }

  if (!confirmedStatus?.id) {
    const error = "The confirmed payment status is not configured."
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      projectId: payment.project_id,
      paymentId: input.paymentId,
      error,
    })
    return commandFailure("status_not_configured", error, {
      projectId: payment.project_id,
      paymentId: input.paymentId,
    })
  }

  const confirmedAt = new Date().toISOString()
  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status_id: confirmedStatus.id,
      confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    })
    .eq("id", input.paymentId)

  if (updatePaymentError) {
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_confirmation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      projectId: payment.project_id,
      paymentId: input.paymentId,
      error: updatePaymentError.message,
    })
    return commandFailure("update_failed", updatePaymentError.message, {
      projectId: payment.project_id,
      paymentId: input.paymentId,
    })
  }

  await recordAdminPaymentEvent(supabase, deps, {
    flow: "admin_confirmation",
    stage: "submit",
    outcome: "success",
    attemptId: input.attemptId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    projectId: payment.project_id,
    paymentId: input.paymentId,
    metadata: {
      confirmedAt,
    },
  })

  return {
    ok: true,
    data: {
      paymentId: input.paymentId,
      statusCode: confirmedStatus.code,
      confirmedAt,
    },
  }
}

export async function executeAdminOnchainPaymentReconciliationRunCommand(
  supabase: SupabaseClient<Database>,
  input: AdminOnchainPaymentReconciliationRunInput,
  deps: AdminPaymentOperationsCommandDeps,
): Promise<AdminPaymentOperationsCommandResult<OnchainReconciliationRunSummary>> {
  await recordAdminPaymentEvent(supabase, deps, {
    flow: "admin_reconciliation",
    stage: "submit",
    outcome: "attempt",
    attemptId: input.attemptId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    paymentId: input.paymentId ?? null,
    submissionId: input.submissionId ?? null,
    metadata: {
      source: input.source,
      limit: input.limit ?? null,
    },
  })

  try {
    const summary = await runOnchainPaymentReconciliation(
      {
        source: input.source,
        limit: input.limit,
        paymentId: input.paymentId,
        submissionId: input.submissionId,
      },
      { supabase },
    )

    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_reconciliation",
      stage: "submit",
      outcome: "success",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      paymentId: input.paymentId ?? null,
      submissionId: input.submissionId ?? null,
      metadata: {
        source: summary.source,
        processedCount: summary.processedCount,
        confirmedCount: summary.confirmedCount,
        failedCount: summary.failedCount,
        confirmingCount: summary.confirmingCount,
        unresolvedCount: summary.unresolvedCount,
      },
    })

    return {
      ok: true,
      data: summary,
    }
  } catch (error) {
    await recordAdminPaymentEvent(supabase, deps, {
      flow: "admin_reconciliation",
      stage: "submit",
      outcome: "failure",
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      paymentId: input.paymentId ?? null,
      submissionId: input.submissionId ?? null,
      error,
      metadata: {
        source: input.source,
        limit: input.limit ?? null,
      },
    })

    return commandFailure(normalizePaymentFlowErrorCode("submit", error), normalizePaymentFlowErrorMessage(error) ?? "Could not run onchain payment reconciliation.", {
      paymentId: input.paymentId ?? null,
      submissionId: input.submissionId ?? null,
    })
  }
}
