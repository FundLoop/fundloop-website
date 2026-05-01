import { STORAGE_BUCKETS } from "@/lib/storage/artifacts"

export const ZKAS_ACCESS_ROLE_NAME = "zkas_access"
export const ZKAS_DATASET_BUCKET = STORAGE_BUCKETS.zkasDatasets
export const ZKAS_IDENTITY_BUCKET = STORAGE_BUCKETS.zkasIdentities
export const ZKAS_RUN_BUCKET = STORAGE_BUCKETS.zkasRuns
export const ZKAS_SCHEMA_VERSION = "zkas.v1"
export const ZKAS_PUBLISHED_RESULT_NOTIFICATION_CODE = "zkas_published_result"

export const ZKAS_REQUIRED_COLUMNS = ["month", "project_id", "app_user_id"] as const
export const ZKAS_OPTIONAL_COLUMNS = ["activity_score", "activity_count", "confidence_weight"] as const

export const ZKAS_ALLOWED_DATASET_FORMATS = ["csv", "json"] as const

export const ZKAS_CUBID_SCORE_BUCKETS = [
  { key: "unresolved", label: "Unresolved", min: null, max: null },
  { key: "0_24", label: "0-24", min: 0, max: 24.999999 },
  { key: "25_49", label: "25-49", min: 25, max: 49.999999 },
  { key: "50_74", label: "50-74", min: 50, max: 74.999999 },
  { key: "75_plus", label: "75+", min: 75, max: null },
] as const
