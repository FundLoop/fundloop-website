import "server-only"

import type { OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import {
  listLatestOnchainSubmissionsForPaymentIds,
  listReconciliationQueue,
} from "@/lib/onchain/payment-reconciliation"
import {
  buildAttemptLabel,
  formatEventError,
  listRecentPaymentFlowFailures,
  type PaymentFlowEventListItem,
} from "@/lib/observability/payment-flow-server"
import {
  mapPaymentRecordSummary,
  type PaymentRecordSummary,
  type PaymentRecordSummaryRow,
} from "@/lib/payments/payment-record-summary"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

export type OperatorReadWarning = {
  code: string
  message: string
}

export type AdminPaymentOperationsWorkspace = {
  payments: PaymentRecordSummary[]
  recentFailures: PaymentFlowEventListItem[]
  warnings: OperatorReadWarning[]
}

export type AdminPaymentReconciliationProject = {
  id: number
  name: string
  slug: string | null
}

export type AdminPaymentReconciliationPayment = {
  id: number
  period_end: string
  ref_payment_statuses: {
    name: string
    code: string
  } | null
}

export type AdminPaymentReconciliationQueueRow = {
  submission: OnchainSubmissionSummary
  project: AdminPaymentReconciliationProject | null
  payment: AdminPaymentReconciliationPayment | null
}

export type AdminPaymentReconciliationWorkspace = {
  rows: AdminPaymentReconciliationQueueRow[]
  totals: {
    trackedSubmissions: number
    unresolvedSubmissions: number
    latestScopeLabel: string
  }
  warnings: OperatorReadWarning[]
}

export function normalizeOperatorReadError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function buildAdminPaymentOperationsWorkspace(input: {
  paymentRows: PaymentRecordSummaryRow[]
  latestOnchainSubmissionByPaymentId?: Map<number, OnchainSubmissionSummary>
  recentFailures?: PaymentFlowEventListItem[]
  warnings?: OperatorReadWarning[]
}): AdminPaymentOperationsWorkspace {
  const latestByPaymentId = input.latestOnchainSubmissionByPaymentId ?? new Map<number, OnchainSubmissionSummary>()

  return {
    payments: input.paymentRows.map((row) => ({
      ...mapPaymentRecordSummary(row),
      latest_onchain_submission: latestByPaymentId.get(row.id) ?? null,
    })),
    recentFailures: input.recentFailures ?? [],
    warnings: input.warnings ?? [],
  }
}

export function buildAdminPaymentReconciliationWorkspace(input: {
  queue: OnchainSubmissionSummary[]
  projects?: AdminPaymentReconciliationProject[]
  payments?: AdminPaymentReconciliationPayment[]
  warnings?: OperatorReadWarning[]
  limit?: number
}): AdminPaymentReconciliationWorkspace {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  const paymentById = new Map((input.payments ?? []).map((payment) => [payment.id, payment]))

  return {
    rows: input.queue.map((submission) => ({
      submission,
      project: projectById.get(submission.project_id) ?? null,
      payment: submission.payment_id ? (paymentById.get(submission.payment_id) ?? null) : null,
    })),
    totals: {
      trackedSubmissions: input.queue.length,
      unresolvedSubmissions: input.queue.filter(
        (entry) => entry.status === "submitted" || entry.status === "confirming",
      ).length,
      latestScopeLabel: `Showing the ${input.limit ?? 50} most recent tracked submissions.`,
    },
    warnings: input.warnings ?? [],
  }
}

export function formatPaymentFailureSummary(event: PaymentFlowEventListItem) {
  return {
    title: `${event.flow.replaceAll("_", " ")} · ${event.stage.replaceAll("_", " ")}`,
    message: formatEventError(event),
    context: [
      buildAttemptLabel(event.attempt_id),
      event.project_name,
      event.payment_id ? `Payment #${event.payment_id}` : null,
    ].filter(Boolean).join(" · "),
  }
}

export async function loadAdminPaymentOperationsWorkspace(): Promise<AdminPaymentOperationsWorkspace> {
  await requireInternalAdminActor()

  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      project_id,
      period_start,
      period_end,
      revenue,
      payment_amount,
      payment_percentage,
      payment_method_id,
      status_id,
      created_at,
      updated_at,
      paid_at,
      confirmed_at,
      notes,
      projects(name, slug),
      ref_payment_methods(name, code),
      ref_payment_statuses(name, code)
    `)
    .order("period_end", { ascending: false })
    .order("id", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const paymentRows = (data ?? []) as PaymentRecordSummaryRow[]
  const warnings: OperatorReadWarning[] = []
  let latestOnchainSubmissionByPaymentId = new Map<number, OnchainSubmissionSummary>()
  let recentFailures: PaymentFlowEventListItem[] = []

  try {
    latestOnchainSubmissionByPaymentId = await listLatestOnchainSubmissionsForPaymentIds(paymentRows.map((row) => row.id))
  } catch (error) {
    warnings.push({
      code: "latest_onchain_submission_read_failed",
      message: normalizeOperatorReadError(error, "Latest onchain submission state is temporarily unavailable."),
    })
  }

  try {
    recentFailures = await listRecentPaymentFlowFailures(5)
  } catch (error) {
    warnings.push({
      code: "recent_payment_failures_read_failed",
      message: normalizeOperatorReadError(error, "Recent payment-flow failure state is temporarily unavailable."),
    })
  }

  return buildAdminPaymentOperationsWorkspace({
    paymentRows,
    latestOnchainSubmissionByPaymentId,
    recentFailures,
    warnings,
  })
}

export async function loadAdminPaymentReconciliationWorkspace(limit = 50): Promise<AdminPaymentReconciliationWorkspace> {
  await requireInternalAdminActor()

  const queue = await listReconciliationQueue(limit)
  const supabase = getAdminSupabaseClient()
  const projectIds = Array.from(new Set(queue.map((entry) => entry.project_id)))
  const paymentIds = Array.from(new Set(queue.map((entry) => entry.payment_id).filter((value): value is number => value !== null)))
  const warnings: OperatorReadWarning[] = []
  let projects: AdminPaymentReconciliationProject[] = []
  let payments: AdminPaymentReconciliationPayment[] = []

  try {
    if (projectIds.length > 0) {
      const { data, error } = await supabase.from("projects").select("id, name, slug").in("id", projectIds)
      if (error) throw new Error(error.message)
      projects = (data ?? []) as AdminPaymentReconciliationProject[]
    }
  } catch (error) {
    warnings.push({
      code: "reconciliation_project_context_read_failed",
      message: normalizeOperatorReadError(error, "Project labels are temporarily unavailable for reconciliation rows."),
    })
  }

  try {
    if (paymentIds.length > 0) {
      const { data, error } = await supabase
        .from("payments")
        .select("id, period_end, ref_payment_statuses(name, code)")
        .in("id", paymentIds)
      if (error) throw new Error(error.message)
      payments = (data ?? []) as AdminPaymentReconciliationPayment[]
    }
  } catch (error) {
    warnings.push({
      code: "reconciliation_payment_context_read_failed",
      message: normalizeOperatorReadError(error, "Payment labels are temporarily unavailable for reconciliation rows."),
    })
  }

  return buildAdminPaymentReconciliationWorkspace({
    queue,
    projects,
    payments,
    warnings,
    limit,
  })
}
