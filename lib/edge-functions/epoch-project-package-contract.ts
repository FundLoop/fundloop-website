import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION = "epoch-project-package-workflow"

export type EpochProjectPackageStatus =
  | "draft" | "validation_failed" | "review_ready" | "frozen"
  | "approved" | "silent_approved" | "opted_out" | "rolled_forward"

export type EpochProjectPackageSummary = {
  id: number
  projectId: number
  projectName: string
  projectSlug: string
  intendedCycleKey: string
  canonicalCycleKey: string | null
  version: number
  status: EpochProjectPackageStatus
  listStatus: "missing" | "invalid" | "valid"
  fundingStatus: "missing" | "unsettled" | "settled"
  complianceStatus: "pending" | "failed" | "passed"
  cubidStatus: "missing" | "held" | "eligible"
  cutoffAt: string
  reconciliationEmailDeliveredAt: string | null
  reconciliationDeadlineAt: string | null
  paymentCount: number
  fundingSourceCount: number
  cohortCount: number
  eligibleUserCount: number
  heldUserCount: number
  preliminaryUsd: string
  manifestHash: string
  projectFeeAssessedOnce: boolean
  baseFeeDeferred: boolean
}

export type EpochProjectPackageWorkflowInput =
  | { action: "read"; projectSlug?: string }
  | {
      action: "validate"
      projectSlug: string
      cycleKey: string
      kybStatus: "passed" | "pending" | "failed"
      kycStatus: "passed" | "pending" | "failed"
      sanctionsStatus: "passed" | "pending" | "failed"
      complianceEvidenceHash: string
      complianceValidUntil: string
      maximumCubidScore: string
      cubidTtlHours?: number
      observedAt?: string
    }
  | { action: "send_reconciliation_email"; packageId: number; attemptId?: string }
  | { action: "approve"; packageId: number; evidenceHash: string; decidedAt?: string }
  | { action: "opt_out"; packageId: number; evidenceHash: string; reason: string; decidedAt?: string }
  | { action: "finalize_silent"; observedAt?: string }

export type EpochProjectPackageWorkflowOutput =
  | { action: "read"; packages: EpochProjectPackageSummary[] }
  | { action: "validate"; packageId: number }
  | { action: "send_reconciliation_email"; packageId: number; deliveryEventId: number; providerMessageId: string; deadlineAt: string }
  | { action: "approve" | "opt_out"; packageId: number; decisionEventId: number }
  | { action: "finalize_silent"; finalizedCount: number }

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const cyclePattern = /^\d{4}-(0[1-9]|1[0-2])$/
const hashPattern = /^[0-9a-f]{64}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(input).every((key) => allowed.includes(key))
}

function positiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0
}

function optionalIso(value: unknown) {
  return value === undefined || (typeof value === "string" && Number.isFinite(Date.parse(value)))
}

function status(value: unknown): value is "passed" | "pending" | "failed" {
  return value === "passed" || value === "pending" || value === "failed"
}

export function validateEpochProjectPackageWorkflowInput(input: unknown): EdgeCommandResult<EpochProjectPackageWorkflowInput> {
  if (!isObject(input) || typeof input.action !== "string") {
    return edgeCommandFailure("invalid_payload", "Request body must contain an action.")
  }
  if (input.action === "read") {
    if (!exactKeys(input, ["action", "projectSlug"]) || (input.projectSlug !== undefined && (typeof input.projectSlug !== "string" || !slugPattern.test(input.projectSlug)))) {
      return edgeCommandFailure("invalid_payload", "Read input is invalid.")
    }
    return edgeCommandSuccess({ action: "read", projectSlug: input.projectSlug as string | undefined })
  }
  if (input.action === "validate") {
    const allowed = ["action","projectSlug","cycleKey","kybStatus","kycStatus","sanctionsStatus","complianceEvidenceHash","complianceValidUntil","maximumCubidScore","cubidTtlHours","observedAt"]
    const maximum = typeof input.maximumCubidScore === "string" ? Number(input.maximumCubidScore) : NaN
    if (!exactKeys(input, allowed) || typeof input.projectSlug !== "string" || !slugPattern.test(input.projectSlug)
      || typeof input.cycleKey !== "string" || !cyclePattern.test(input.cycleKey) || !status(input.kybStatus)
      || !status(input.kycStatus) || !status(input.sanctionsStatus) || typeof input.complianceEvidenceHash !== "string"
      || !hashPattern.test(input.complianceEvidenceHash) || typeof input.complianceValidUntil !== "string"
      || !Number.isFinite(Date.parse(input.complianceValidUntil)) || !Number.isFinite(maximum) || maximum <= 0
      || (input.cubidTtlHours !== undefined && (!Number.isInteger(input.cubidTtlHours) || Number(input.cubidTtlHours) < 1 || Number(input.cubidTtlHours) > 168))
      || !optionalIso(input.observedAt)) {
      return edgeCommandFailure("invalid_payload", "Package validation input is invalid.")
    }
    return edgeCommandSuccess(input as EpochProjectPackageWorkflowInput)
  }
  if (input.action === "send_reconciliation_email") {
    if (!exactKeys(input, ["action","packageId","attemptId"]) || !positiveInteger(input.packageId)
      || (input.attemptId !== undefined && (typeof input.attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.attemptId)))) {
      return edgeCommandFailure("invalid_payload", "Email input is invalid.")
    }
    return edgeCommandSuccess(input as EpochProjectPackageWorkflowInput)
  }
  if (input.action === "approve" || input.action === "opt_out") {
    const allowed = input.action === "opt_out" ? ["action","packageId","evidenceHash","reason","decidedAt"] : ["action","packageId","evidenceHash","decidedAt"]
    if (!exactKeys(input, allowed) || !positiveInteger(input.packageId) || typeof input.evidenceHash !== "string"
      || !hashPattern.test(input.evidenceHash) || !optionalIso(input.decidedAt)
      || (input.action === "opt_out" && (typeof input.reason !== "string" || input.reason.trim().length === 0))) {
      return edgeCommandFailure("invalid_payload", "Package decision input is invalid.")
    }
    return edgeCommandSuccess(input as EpochProjectPackageWorkflowInput)
  }
  if (input.action === "finalize_silent") {
    if (!exactKeys(input, ["action","observedAt"]) || !optionalIso(input.observedAt)) {
      return edgeCommandFailure("invalid_payload", "Silent approval input is invalid.")
    }
    return edgeCommandSuccess(input as EpochProjectPackageWorkflowInput)
  }
  return edgeCommandFailure("invalid_payload", "Unknown package workflow action.")
}

function isSummary(value: unknown): value is EpochProjectPackageSummary {
  if (!isObject(value)) return false
  return Number.isInteger(value.id) && Number.isInteger(value.projectId) && typeof value.projectSlug === "string"
    && typeof value.projectName === "string" && typeof value.intendedCycleKey === "string"
    && (value.canonicalCycleKey === null || typeof value.canonicalCycleKey === "string")
    && Number.isInteger(value.version) && typeof value.status === "string" && typeof value.manifestHash === "string"
    && typeof value.preliminaryUsd === "string"
}

export function isEpochProjectPackageWorkflowOutput(value: unknown): value is EpochProjectPackageWorkflowOutput {
  if (!isObject(value) || typeof value.action !== "string") return false
  if (value.action === "read") return Array.isArray(value.packages) && value.packages.every(isSummary)
  if (value.action === "validate") return positiveInteger(value.packageId)
  if (value.action === "send_reconciliation_email") return positiveInteger(value.packageId) && positiveInteger(value.deliveryEventId)
    && typeof value.providerMessageId === "string" && typeof value.deadlineAt === "string"
  if (value.action === "approve" || value.action === "opt_out") return positiveInteger(value.packageId) && positiveInteger(value.decisionEventId)
  if (value.action === "finalize_silent") return Number.isInteger(value.finalizedCount) && Number(value.finalizedCount) >= 0
  return false
}
