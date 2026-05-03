export const STORAGE_BUCKETS = {
  zkasDatasets: "zkas-datasets",
  zkasIdentities: "zkas-identities",
  zkasRuns: "zkas-runs",
  monthlyCycleReports: "monthly-cycle-reports",
  projectAssets: "project-assets",
  onboardingUploads: "onboarding-uploads",
  bookkeepingExports: "bookkeeping-exports",
  auditProofs: "audit-proofs",
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

export type StorageArtifactVisibility = "private" | "public_read_model"
export type StorageArtifactRetention = "draft" | "cycle_locked" | "audit" | "published"

export type StorageArtifactKind =
  | "zkas_dataset"
  | "zkas_identity_artifact"
  | "zkas_calculation_package"
  | "zkas_run_manifest"
  | "zkas_run_result"
  | "monthly_cycle_report"
  | "project_asset"
  | "onboarding_upload"
  | "bookkeeping_export"
  | "audit_proof"

export type StorageArtifactReference = {
  bucket: StorageBucket
  path: string
  kind: StorageArtifactKind
  mimeType: string | null
  hash: string | null
  visibility: StorageArtifactVisibility
  retention: StorageArtifactRetention
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function normalizeSegment(value: string | number) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function requireSegment(value: string | number, label: string) {
  const segment = normalizeSegment(value)
  if (!segment) {
    throw new Error(`${label} must produce a non-empty storage path segment.`)
  }
  return segment
}

function requireCycleKey(cycleKey: string) {
  if (!CYCLE_KEY_PATTERN.test(cycleKey)) {
    throw new Error("Storage cycle keys must use YYYY-MM format.")
  }
  return cycleKey
}

function normalizeFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("Storage file names must be non-empty.")
  }

  return normalized
}

export function buildZkasDatasetArtifactPath(input: {
  cycleKey: string
  projectId: number
  fileHash: string
  format: "csv" | "json"
}) {
  const cycleKey = requireCycleKey(input.cycleKey)
  const projectId = requireSegment(input.projectId, "Project id")
  const hash = requireSegment(input.fileHash, "Dataset hash")
  return `${cycleKey}/project-${projectId}/dataset-${hash}.${input.format}`
}

export function buildZkasIdentityArtifactPath(input: {
  cycleKey: string
  artifactHash: string
}) {
  const cycleKey = requireCycleKey(input.cycleKey)
  const hash = requireSegment(input.artifactHash, "Identity artifact hash")
  return `${cycleKey}/identity-${hash}.json`
}

export function buildZkasRunArtifactPath(input: {
  cycleKey: string
  runId?: number
  cycleId?: number
  artifact: "calculation-package" | "run-manifest" | "run-result" | "attestation"
  version?: string
}) {
  const cycleKey = requireCycleKey(input.cycleKey)
  const version = requireSegment(input.version ?? "v1", "Artifact version")

  if (input.artifact === "calculation-package") {
    if (!input.cycleId) throw new Error("Calculation package artifacts require a cycle id.")
    return `${cycleKey}/cycle-${requireSegment(input.cycleId, "Cycle id")}/calculation-package.${version}.json`
  }

  if (!input.runId) throw new Error("Run artifacts require a run id.")
  return `${cycleKey}/run-${requireSegment(input.runId, "Run id")}/${input.artifact}.${version}.json`
}

export function buildMonthlyCycleReportArtifactPath(input: {
  cycleKey: string
  audience: "public" | "user" | "founder" | "operator"
  subjectId?: string | number | null
  fileName: string
}) {
  const cycleKey = requireCycleKey(input.cycleKey)
  const audience = requireSegment(input.audience, "Report audience")
  const subject = input.subjectId === null || input.subjectId === undefined ? null : requireSegment(input.subjectId, "Report subject")
  const fileName = normalizeFileName(input.fileName)
  return [cycleKey, audience, subject, fileName].filter(Boolean).join("/")
}

export function buildProjectAssetArtifactPath(input: {
  projectId: number
  fileName: string
}) {
  return `project-${requireSegment(input.projectId, "Project id")}/${normalizeFileName(input.fileName)}`
}

export function buildOnboardingUploadArtifactPath(input: {
  userId: string
  flow: "user" | "project"
  fileName: string
}) {
  return `user-${requireSegment(input.userId, "User id")}/${requireSegment(input.flow, "Onboarding flow")}/${normalizeFileName(input.fileName)}`
}

export function buildBookkeepingExportArtifactPath(input: {
  cycleKey: string
  fileName: string
}) {
  return `${requireCycleKey(input.cycleKey)}/${normalizeFileName(input.fileName)}`
}

export function buildAuditProofArtifactPath(input: {
  cycleKey: string
  proofType: string
  fileName: string
}) {
  return `${requireCycleKey(input.cycleKey)}/${requireSegment(input.proofType, "Proof type")}/${normalizeFileName(input.fileName)}`
}

export function normalizeStorageArtifactReference(input: {
  bucket: StorageBucket
  path: string | null | undefined
  kind: StorageArtifactKind
  mimeType?: string | null
  hash?: string | null
  visibility?: StorageArtifactVisibility
  retention?: StorageArtifactRetention
}): StorageArtifactReference | null {
  const path = input.path?.trim()
  if (!path) return null

  return {
    bucket: input.bucket,
    path,
    kind: input.kind,
    mimeType: input.mimeType ?? null,
    hash: input.hash ?? null,
    visibility: input.visibility ?? "private",
    retention: input.retention ?? "audit",
  }
}
