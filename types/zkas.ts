export type ZkasDatasetFormat = "csv" | "json"

export type ZkasDatasetStatus =
  | "uploaded"
  | "validated"
  | "failed"
  | "approved"
  | "included"
  | "replaced"
  | "archived"

export type ZkasIssueSeverity = "error" | "warning"

export type ZkasRunStatus =
  | "draft"
  | "locked"
  | "running"
  | "completed"
  | "failed"
  | "finalized"

export type ZkasExecutionMode = "local" | "nitro"
export type ZkasVerificationStatus = "pending" | "verified" | "rejected"

export type ZkasAttemptStatus = "pending" | "running" | "completed" | "failed"

export type ZkasDatasetRow = {
  month: string
  project_id: number
  app_user_id: string
  activity_score?: number | null
  activity_count?: number | null
  confidence_weight?: number | null
}

export type ZkasValidationIssue = {
  severity: ZkasIssueSeverity
  code: string
  message: string
  rowNumber?: number
  field?: keyof ZkasDatasetRow | "file"
  metadata?: Record<string, string | number | boolean | null>
}

export type ZkasValidationSummary = {
  rowCount: number
  detectedColumns: string[]
  usedOptionalColumns: Array<"activity_score" | "activity_count" | "confidence_weight">
  issueCounts: {
    errors: number
    warnings: number
  }
}

export type ParsedZkasDataset = {
  format: ZkasDatasetFormat
  rows: ZkasDatasetRow[]
  summary: ZkasValidationSummary
  issues: ZkasValidationIssue[]
}

export type ZkasIdentityMapping = {
  project_id: number
  app_user_id: string
  zkas_user_id: string
  fundloop_user_id?: string | null
}

export type ZkasRunManifestDataset = {
  dataset_id: number
  project_id: number
  format: ZkasDatasetFormat
  object_path: string
  file_hash: string
  row_count: number
}

export type ZkasRunManifestPayment = {
  payment_id: number
  project_id: number
  amount_usd: number
  period_end: string
}

export type ZkasRunManifest = {
  version: "run-manifest.v1"
  run_id: number
  month: string
  usd_pool: number
  allocation_policy: "proportional_pool"
  engine_bundle: {
    git_ref: string
    image_ref: string
    config_version: string
  }
  schema_version: string
  datasets: ZkasRunManifestDataset[]
  payments: ZkasRunManifestPayment[]
  identity_artifact: {
    artifact_id: number
    object_path: string
    artifact_hash: string
    schema_version: string
  }
}

export type ZkasRunResultRow = {
  zkas_user_id: string
  eligibility: boolean
  aggregate_score: number
  allocation_usd: number
  app_count: number
  project_count: number
  output_row_hash: string
}

export type ZkasRunResultArtifact = {
  version: "run-result.v1"
  run_id: number
  month: string
  usd_pool: number
  total_score: number
  total_allocated_usd: number
  user_count: number
  rows: ZkasRunResultRow[]
  execution: {
    mode: ZkasExecutionMode
    started_at: string
    completed_at: string
    attestation?: {
      provider: string
      document_path: string | null
    } | null
  }
}

export type LocalExecutionManifest = {
  version: "local-run-manifest.v1"
  run_id: number
  month: string
  usd_pool: number
  allocation_policy: "proportional_pool"
  datasets: Array<{
    dataset_id: number
    project_id: number
    format: ZkasDatasetFormat
    file_path: string
    file_hash: string
  }>
  identity_artifact: {
    artifact_id: number
    file_path: string
    artifact_hash: string
  }
}

export type ZkasPublishedUserResult = {
  run_id: number
  user_id: string
  zkas_user_id: string
  allocation_usd: number
  aggregate_score: number
  published_at: string
  notification_id?: number | null
}

export type ZkasProjectAnalyticsSummary = {
  run_id: number
  project_id: number
  dataset_id: number
  contributed_amount_usd: number
  active_user_count: number
  avg_contribution_per_active_user_usd: number
  published_user_count: number
  attributed_payout_usd: number
  avg_attributed_payout_per_published_user_usd: number
}

export type ZkasProjectCubidBucket = {
  run_id: number
  project_id: number
  bucket_key: string
  bucket_label: string
  user_count: number
}

export type ZkasPublishedResultNotificationPayload = {
  type: "zkas_published_result"
  run_id: number
  month: string
  allocation_usd: number
  destination: string
}
