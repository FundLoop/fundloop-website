import { validateProjectPaymentDrafts, type NormalizedProjectPaymentDraft, type ProjectPaymentDraftInput } from "../payments.ts"
import type { PaymentRecordSummary } from "../payments/payment-record-summary.ts"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_PAYMENT_DRAFTS_CREATE_FUNCTION = "project-payment-drafts-create"

export type ProjectPaymentDraftsCreateInput = {
  projectSlug: string
  attemptId?: string
  payments: ProjectPaymentDraftInput[]
}

export type ProjectPaymentDraftsCreateValidatedInput = {
  projectSlug: string
  attemptId?: string
  payments: NormalizedProjectPaymentDraft[]
}

export type ProjectPaymentDraftsCreateOutput = PaymentRecordSummary[]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string"
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number"
}

function isNullableOnchainSubmissionSummary(value: unknown) {
  if (value === null) {
    return true
  }

  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.id === "number" &&
    isNullableNumber(value.payment_id) &&
    typeof value.project_id === "number" &&
    typeof value.payment_method_id === "number" &&
    typeof value.period_id === "number" &&
    typeof value.tx_hash === "string" &&
    typeof value.wallet_address === "string" &&
    typeof value.status === "string" &&
    typeof value.confirmation_count === "number" &&
    typeof value.confirmation_depth === "number" &&
    isNullableString(value.failure_code) &&
    isNullableString(value.failure_reason) &&
    typeof value.submitted_at === "string" &&
    isNullableString(value.last_checked_at) &&
    isNullableString(value.reconciled_at) &&
    isNullableNumber(value.matched_log_index)
  )
}

export function isProjectPaymentDraftsCreateOutput(value: unknown): value is ProjectPaymentDraftsCreateOutput {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isPlainObject(entry)) {
        return false
      }

      return (
        typeof entry.id === "number" &&
        isNullableNumber(entry.project_id) &&
        typeof entry.project_name === "string" &&
        isNullableString(entry.project_slug) &&
        typeof entry.period_start === "string" &&
        typeof entry.period_end === "string" &&
        typeof entry.revenue === "number" &&
        typeof entry.payment_amount === "number" &&
        typeof entry.payment_percentage === "number" &&
        isNullableNumber(entry.payment_method_id) &&
        typeof entry.payment_method_name === "string" &&
        typeof entry.payment_method_code === "string" &&
        isNullableNumber(entry.status_id) &&
        typeof entry.status_name === "string" &&
        typeof entry.status_code === "string" &&
        isNullableString(entry.created_at) &&
        isNullableString(entry.updated_at) &&
        isNullableString(entry.paid_at) &&
        isNullableString(entry.confirmed_at) &&
        isNullableString(entry.notes) &&
        isNullableOnchainSubmissionSummary(entry.latest_onchain_submission)
      )
    })
  )
}

export function validateProjectPaymentDraftsCreateInput(input: unknown): EdgeCommandResult<ProjectPaymentDraftsCreateValidatedInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : ""
  if (!projectSlug) {
    return edgeCommandFailure("invalid_payload", "projectSlug is required.")
  }

  if (!Array.isArray(input.payments)) {
    return edgeCommandFailure("invalid_payload", "payments must be an array.")
  }

  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  const paymentValidation = validateProjectPaymentDrafts(input.payments as ProjectPaymentDraftInput[])
  if (!paymentValidation.ok) {
    return edgeCommandFailure("payment_validation_failed", paymentValidation.error)
  }

  return edgeCommandSuccess({
    projectSlug,
    attemptId: typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined,
    payments: paymentValidation.data,
  })
}
