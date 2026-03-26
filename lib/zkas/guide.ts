export const ZKAS_DATASET_TEMPLATE_CSV = `month,project_id,app_user_id,activity_score,activity_count,confidence_weight
2026-04,42,user-001,3.5,12,1
2026-04,42,user-002,1.2,4,0.8
`

export const ZKAS_DATASET_TEMPLATE_JSON = JSON.stringify(
  [
    {
      month: "2026-04",
      project_id: 42,
      app_user_id: "user-001",
      activity_score: 3.5,
      activity_count: 12,
      confidence_weight: 1,
    },
    {
      month: "2026-04",
      project_id: 42,
      app_user_id: "user-002",
      activity_score: 1.2,
      activity_count: 4,
      confidence_weight: 0.8,
    },
  ],
  null,
  2,
)

export const ZKAS_DATASET_DERIVATION_STEPS = [
  "Choose one reporting month and export only activity that occurred in that month.",
  "Aggregate your product activity first, then emit exactly one row per unique active app user.",
  "Use a stable app_user_id that matches the same namespace used in the monthly confidential identity artifact.",
  "Only include activity_score, activity_count, or confidence_weight if you can provide that column for every row.",
  "Do not submit duplicate month/project_id/app_user_id combinations or mixed-project data in the same file.",
]

export const ZKAS_DATASET_CHECKLIST = [
  "The selected upload month matches the month column in every row.",
  "Every row uses this project's numeric project_id.",
  "app_user_id is never blank.",
  "Optional numeric columns are fully populated if used at all.",
  "CSV headers or JSON keys match the canonical field names exactly.",
]

export const ZKAS_IDENTITY_ARTIFACT_FIELDS = [
  "project_id",
  "app_user_id",
  "zkas_user_id",
  "fundloop_user_id (optional but required for in-app publication to resolved users)",
]
