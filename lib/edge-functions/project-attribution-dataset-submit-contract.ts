import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION = "project-attribution-dataset-submit"

export type ProjectAttributionDatasetStatus = "draft" | "submitted"
export type ProjectAttributionProofType = "raw_rows" | "zk_activity_sum"
export type ProjectAttributionVerifierBackend = "tee" | "zk"
export type ProjectAttributionVerificationStatus = "not_required" | "pending" | "verified" | "failed"

export type ProjectAttributionRowInput = {
  scopedCubidId: string
  userId?: string
  userEmail?: string
  attributionPoints: number
  category?: string
  evidenceReference?: string
  notes?: string
}

export type ProjectAttributionDatasetSubmitCommandInput = {
  projectSlug: string
  cycleKey: string
  status?: ProjectAttributionDatasetStatus
  rows: ProjectAttributionRowInput[]
  note?: string
  proofType?: ProjectAttributionProofType
  proofArtifactUri?: string
  verifierBackend?: ProjectAttributionVerifierBackend
  verificationStatus?: ProjectAttributionVerificationStatus
  attemptId?: string
}

export type ProjectAttributionRowSummary = {
  id: number
  rowIndex: number
  scopedCubidId: string
  userId: string | null
  userEmail: string | null
  attributionPoints: number
  category: string | null
  evidenceReference: string | null
  notes: string | null
  resolutionStatus: "resolved" | "unresolved"
  resolutionMessage: string | null
}

export type ProjectAttributionDatasetSummary = {
  id: number
  projectId: number
  projectSlug: string
  cycleId: number
  cycleKey: string
  status: "draft" | "submitted" | "approved" | "rejected"
  rowCount: number
  totalAttributionPoints: number
  note: string | null
  proofType: ProjectAttributionProofType | null
  proofArtifactUri: string | null
  verifierBackend: ProjectAttributionVerifierBackend | null
  verificationStatus: ProjectAttributionVerificationStatus | null
  submittedByUserId: string | null
  submittedAt: string
  updatedAt: string
  rows: ProjectAttributionRowSummary[]
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_ROWS = 500

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readString(input: Record<string, unknown>, key: string, message?: string) {
  const value = typeof input[key] === "string" ? input[key].trim() : ""
  if (!value) {
    return edgeCommandFailure("invalid_payload", message ?? `${key} is required.`)
  }

  return edgeCommandSuccess(value)
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  if (input[key] === undefined || input[key] === null) return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string") return edgeCommandFailure("invalid_payload", `${key} must be a string when provided.`)
  const value = input[key].trim()
  return edgeCommandSuccess(value || undefined)
}

function readOptionalEnum<T extends string>(input: Record<string, unknown>, key: string, values: readonly T[]) {
  if (input[key] === undefined || input[key] === null || input[key] === "") return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string" || !values.includes(input[key] as T)) {
    return edgeCommandFailure("invalid_payload", `${key} is invalid.`)
  }

  return edgeCommandSuccess(input[key] as T)
}

function readPoints(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return edgeCommandFailure("invalid_payload", "attributionPoints must be a non-negative number.")
  }

  return edgeCommandSuccess(Math.round(value * 1_000_000) / 1_000_000)
}

function normalizeRows(rows: ProjectAttributionRowInput[]) {
  const byScopedCubid = new Map<string, ProjectAttributionRowInput>()
  for (const row of rows) {
    const existing = byScopedCubid.get(row.scopedCubidId)
    if (!existing) {
      byScopedCubid.set(row.scopedCubidId, row)
      continue
    }

    byScopedCubid.set(row.scopedCubidId, {
      ...existing,
      userId: existing.userId ?? row.userId,
      userEmail: existing.userEmail ?? row.userEmail,
      attributionPoints: Math.round((existing.attributionPoints + row.attributionPoints) * 1_000_000) / 1_000_000,
      category: existing.category ?? row.category,
      evidenceReference: existing.evidenceReference ?? row.evidenceReference,
      notes: [existing.notes, row.notes].filter(Boolean).join(" | ") || undefined,
    })
  }

  return Array.from(byScopedCubid.values())
}

export function validateProjectAttributionDatasetSubmitInput(
  input: unknown,
): EdgeCommandResult<ProjectAttributionDatasetSubmitCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readString(input, "projectSlug", "projectSlug is required.")
  if (!projectSlug.ok) return projectSlug
  const cycleKey = readString(input, "cycleKey", "cycleKey is required.")
  if (!cycleKey.ok) return cycleKey
  if (!CYCLE_KEY_PATTERN.test(cycleKey.data)) {
    return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")
  }

  const status = readOptionalEnum(input, "status", ["draft", "submitted"] as const)
  if (!status.ok) return status

  if (!Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > MAX_ROWS) {
    return edgeCommandFailure("invalid_payload", `rows must include between 1 and ${MAX_ROWS} attribution rows.`)
  }

  const rows: ProjectAttributionRowInput[] = []
  for (const [index, rawRow] of input.rows.entries()) {
    if (!isPlainObject(rawRow)) {
      return edgeCommandFailure("invalid_payload", `rows[${index}] must be a JSON object.`)
    }

    const scopedCubidId = readString(rawRow, "scopedCubidId", `rows[${index}].scopedCubidId is required.`)
    if (!scopedCubidId.ok) return scopedCubidId
    const attributionPoints = readPoints(rawRow.attributionPoints)
    if (!attributionPoints.ok) return attributionPoints

    const userId = readOptionalString(rawRow, "userId")
    if (!userId.ok) return userId
    if (userId.data && !UUID_PATTERN.test(userId.data)) {
      return edgeCommandFailure("invalid_payload", `rows[${index}].userId must be a UUID when provided.`)
    }

    const userEmail = readOptionalString(rawRow, "userEmail")
    if (!userEmail.ok) return userEmail
    const category = readOptionalString(rawRow, "category")
    if (!category.ok) return category
    const evidenceReference = readOptionalString(rawRow, "evidenceReference")
    if (!evidenceReference.ok) return evidenceReference
    const notes = readOptionalString(rawRow, "notes")
    if (!notes.ok) return notes

    rows.push({
      scopedCubidId: scopedCubidId.data,
      userId: userId.data,
      userEmail: userEmail.data?.toLowerCase(),
      attributionPoints: attributionPoints.data,
      category: category.data,
      evidenceReference: evidenceReference.data,
      notes: notes.data,
    })
  }

  const note = readOptionalString(input, "note")
  if (!note.ok) return note
  const proofType = readOptionalEnum(input, "proofType", ["raw_rows", "zk_activity_sum"] as const)
  if (!proofType.ok) return proofType
  const proofArtifactUri = readOptionalString(input, "proofArtifactUri")
  if (!proofArtifactUri.ok) return proofArtifactUri
  const verifierBackend = readOptionalEnum(input, "verifierBackend", ["tee", "zk"] as const)
  if (!verifierBackend.ok) return verifierBackend
  const verificationStatus = readOptionalEnum(input, "verificationStatus", ["not_required", "pending", "verified", "failed"] as const)
  if (!verificationStatus.ok) return verificationStatus
  const attemptId = readOptionalString(input, "attemptId")
  if (!attemptId.ok) return attemptId

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    cycleKey: cycleKey.data,
    status: status.data ?? "submitted",
    rows: normalizeRows(rows),
    note: note.data,
    proofType: proofType.data ?? "raw_rows",
    proofArtifactUri: proofArtifactUri.data,
    verifierBackend: verifierBackend.data,
    verificationStatus: verificationStatus.data ?? "not_required",
    attemptId: attemptId.data,
  })
}

function isProjectAttributionRowSummary(value: unknown): value is ProjectAttributionRowSummary {
  if (!isPlainObject(value)) return false

  return (
    Number.isInteger(value.id) &&
    Number.isInteger(value.rowIndex) &&
    typeof value.scopedCubidId === "string" &&
    (typeof value.userId === "string" || value.userId === null) &&
    (typeof value.userEmail === "string" || value.userEmail === null) &&
    typeof value.attributionPoints === "number" &&
    (typeof value.category === "string" || value.category === null) &&
    (typeof value.evidenceReference === "string" || value.evidenceReference === null) &&
    (typeof value.notes === "string" || value.notes === null) &&
    (value.resolutionStatus === "resolved" || value.resolutionStatus === "unresolved") &&
    (typeof value.resolutionMessage === "string" || value.resolutionMessage === null)
  )
}

function isProjectAttributionDatasetSummary(value: unknown): value is ProjectAttributionDatasetSummary {
  if (!isPlainObject(value)) return false

  return (
    Number.isInteger(value.id) &&
    Number.isInteger(value.projectId) &&
    typeof value.projectSlug === "string" &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    ["draft", "submitted", "approved", "rejected"].includes(String(value.status)) &&
    Number.isInteger(value.rowCount) &&
    typeof value.totalAttributionPoints === "number" &&
    (typeof value.note === "string" || value.note === null) &&
    (value.proofType === "raw_rows" || value.proofType === "zk_activity_sum" || value.proofType === null) &&
    (typeof value.proofArtifactUri === "string" || value.proofArtifactUri === null) &&
    (value.verifierBackend === "tee" || value.verifierBackend === "zk" || value.verifierBackend === null) &&
    (["not_required", "pending", "verified", "failed"].includes(String(value.verificationStatus)) ||
      value.verificationStatus === null) &&
    (typeof value.submittedByUserId === "string" || value.submittedByUserId === null) &&
    typeof value.submittedAt === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.rows) &&
    value.rows.every(isProjectAttributionRowSummary)
  )
}

export function normalizeProjectAttributionDatasetSubmitResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectAttributionDatasetSummary> {
  if (!result.ok) return result
  if (!isProjectAttributionDatasetSummary(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `${PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}
