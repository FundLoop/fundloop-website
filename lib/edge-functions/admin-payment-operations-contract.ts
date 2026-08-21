import type { OnchainReconciliationRunSummary } from "../onchain/payment-reconciliation.ts"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION = "admin-payment-receipt-confirm"
export const ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION = "admin-onchain-payment-reconciliation-run"

export type AdminPaymentReceiptConfirmCommandInput = {
  paymentId: number
  attemptId?: string
}

export type AdminPaymentReceiptConfirmCommandOutput = {
  paymentId: number
  statusCode: string
  confirmedAt: string
}

export type AdminOnchainPaymentReconciliationRunCommandInput = {
  limit?: number
  paymentId?: number
  submissionId?: number
  attemptId?: string
}

export type AdminOnchainPaymentReconciliationRunCommandOutput = OnchainReconciliationRunSummary

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalAttemptId(input: Record<string, unknown>) {
  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  const attemptId = typeof input.attemptId === "string" ? input.attemptId.trim() : ""
  return edgeCommandSuccess(attemptId || undefined)
}

function readPositiveInteger(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return edgeCommandFailure("invalid_payload", `${key} must be a positive integer.`)
  }

  return edgeCommandSuccess(value as number)
}

function readOptionalPositiveInteger(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (value === undefined || value === null || value === "") {
    return edgeCommandSuccess(undefined)
  }

  if (!Number.isInteger(value) || (value as number) <= 0) {
    return edgeCommandFailure("invalid_payload", `${key} must be a positive integer when provided.`)
  }

  return edgeCommandSuccess(value as number)
}

export function validateAdminPaymentReceiptConfirmInput(
  input: unknown,
): EdgeCommandResult<AdminPaymentReceiptConfirmCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const attemptId = readOptionalAttemptId(input)
  if (!attemptId.ok) {
    return attemptId
  }

  const paymentId = readPositiveInteger(input, "paymentId")
  if (!paymentId.ok) {
    return paymentId
  }

  return edgeCommandSuccess({
    paymentId: paymentId.data,
    attemptId: attemptId.data,
  })
}

export function validateAdminOnchainPaymentReconciliationRunInput(
  input: unknown,
): EdgeCommandResult<AdminOnchainPaymentReconciliationRunCommandInput> {
  if (input === undefined || input === null) {
    return edgeCommandSuccess({})
  }

  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const attemptId = readOptionalAttemptId(input)
  if (!attemptId.ok) {
    return attemptId
  }

  const limit = readOptionalPositiveInteger(input, "limit")
  if (!limit.ok) {
    return limit
  }

  const paymentId = readOptionalPositiveInteger(input, "paymentId")
  if (!paymentId.ok) {
    return paymentId
  }

  const submissionId = readOptionalPositiveInteger(input, "submissionId")
  if (!submissionId.ok) {
    return submissionId
  }

  return edgeCommandSuccess({
    attemptId: attemptId.data,
    limit: limit.data,
    paymentId: paymentId.data,
    submissionId: submissionId.data,
  })
}

function isAdminPaymentReceiptConfirmOutput(value: unknown): value is AdminPaymentReceiptConfirmCommandOutput {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isInteger((value as { paymentId?: unknown }).paymentId) &&
      typeof (value as { statusCode?: unknown }).statusCode === "string" &&
      typeof (value as { confirmedAt?: unknown }).confirmedAt === "string",
  )
}

function isReconciliationOutcome(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isInteger((value as { submissionId?: unknown }).submissionId) &&
      (typeof (value as { paymentId?: unknown }).paymentId === "number" ||
        (value as { paymentId?: unknown }).paymentId === null) &&
      typeof (value as { status?: unknown }).status === "string" &&
      typeof (value as { txHash?: unknown }).txHash === "string",
  )
}

function isAdminOnchainPaymentReconciliationRunOutput(
  value: unknown,
): value is AdminOnchainPaymentReconciliationRunCommandOutput {
  return Boolean(
    value &&
      typeof value === "object" &&
      (((value as { source?: unknown }).source === "cron") || (value as { source?: unknown }).source === "admin_manual") &&
      Number.isInteger((value as { processedCount?: unknown }).processedCount) &&
      Number.isInteger((value as { confirmedCount?: unknown }).confirmedCount) &&
      Number.isInteger((value as { failedCount?: unknown }).failedCount) &&
      Number.isInteger((value as { confirmingCount?: unknown }).confirmingCount) &&
      Number.isInteger((value as { unresolvedCount?: unknown }).unresolvedCount) &&
      Array.isArray((value as { results?: unknown }).results) &&
      ((value as { results: unknown[] }).results).every(isReconciliationOutcome) &&
      Array.isArray((value as { touchedProjectSlugs?: unknown }).touchedProjectSlugs),
  )
}

export function normalizeAdminPaymentReceiptConfirmResult(result: EdgeCommandResult<unknown>) {
  if (!result.ok) {
    return result
  }

  if (!isAdminPaymentReceiptConfirmOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export function normalizeAdminOnchainPaymentReconciliationRunResult(result: EdgeCommandResult<unknown>) {
  if (!result.ok) {
    return result
  }

  if (!isAdminOnchainPaymentReconciliationRunOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}
