import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"
import type {
  ProjectAttributionDatasetReviewCommandInput,
  ProjectAttributionDatasetReviewCommandOutput,
} from "../edge-functions/project-attribution-dataset-review-contract.ts"
import type { ProjectAttributionRowSummary } from "../edge-functions/project-attribution-dataset-submit-contract.ts"

type DatasetRow = {
  id: number
  project_id: number
  monthly_cycle_id: number
  status: "draft" | "submitted" | "approved" | "rejected"
  row_count: number
  total_attribution_points: number
  note: string | null
  proof_type: "raw_rows" | "zk_activity_sum" | null
  proof_artifact_uri: string | null
  verifier_backend: "tee" | "zk" | null
  verification_status: "not_required" | "pending" | "verified" | "failed" | null
  submitted_by_user_id: string | null
  submitted_at: string
  updated_at: string
}

type ProjectRow = {
  id: number
  slug: string | null
  name: string
}

type CycleRow = {
  id: number
  cycle_key: string
}

type AttributionRowRecord = {
  id: number
  row_index: number
  scoped_cubid_id: string
  user_id: string | null
  user_email: string | null
  attribution_points: number
  category: string | null
  evidence_reference: string | null
  notes: string | null
  resolution_status: "resolved" | "unresolved"
  resolution_message: string | null
}

export type ProjectAttributionReviewFailureCode =
  | "forbidden"
  | "dataset_not_found"
  | "dataset_not_submitted"
  | "project_not_found"
  | "cycle_not_found"
  | "review_failed"
  | "rows_failed"
  | "audit_failed"

export type ProjectAttributionReviewCommandResult =
  | { ok: true; data: ProjectAttributionDatasetReviewCommandOutput }
  | { ok: false; error: { code: ProjectAttributionReviewFailureCode; message: string } }

export type ProjectAttributionReviewCommandExecutionInput = ProjectAttributionDatasetReviewCommandInput & {
  actorUserId: string
  actorRole: string
}

function failure(code: ProjectAttributionReviewFailureCode, message: string): ProjectAttributionReviewCommandResult {
  return { ok: false, error: { code, message } }
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function toSummaryRow(row: AttributionRowRecord): ProjectAttributionRowSummary {
  return {
    id: row.id,
    rowIndex: row.row_index,
    scopedCubidId: row.scoped_cubid_id,
    userId: row.user_id,
    userEmail: row.user_email,
    attributionPoints: numberValue(row.attribution_points),
    category: row.category,
    evidenceReference: row.evidence_reference,
    notes: row.notes,
    resolutionStatus: row.resolution_status,
    resolutionMessage: row.resolution_message,
  }
}

async function insertReviewEvent(
  supabase: SupabaseClient<Database>,
  input: {
    cycle: CycleRow
    dataset: DatasetRow
    actorUserId: string
    actorRole: string
    attemptId: string
    decision: string
    message: string
    metadata?: Json
  },
) {
  const { error } = await supabase.from("monthly_cycle_events").insert({
    monthly_cycle_id: input.cycle.id,
    cycle_key: input.cycle.cycle_key,
    event_type: "attribution_dataset_review",
    attempt_id: input.attemptId,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    outcome: "success",
    severity: input.decision === "rejected" ? "warning" : "info",
    message: input.message,
    metadata: input.metadata ?? {},
  })

  return error
}

export async function executeProjectAttributionDatasetReviewCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectAttributionReviewCommandExecutionInput,
): Promise<ProjectAttributionReviewCommandResult> {
  if (input.actorRole !== "internal_admin") {
    return failure("forbidden", "You do not have internal operator access to review attribution datasets.")
  }

  const { data: dataset, error: datasetError } = await supabase
    .from("project_attribution_datasets")
    .select(
      "id, project_id, monthly_cycle_id, status, row_count, total_attribution_points, note, proof_type, proof_artifact_uri, verifier_backend, verification_status, submitted_by_user_id, submitted_at, updated_at",
    )
    .eq("id", input.datasetId)
    .maybeSingle()

  if (datasetError || !dataset) {
    return failure("dataset_not_found", datasetError?.message ?? "Attribution dataset not found.")
  }

  const typedDataset = dataset as DatasetRow
  if (typedDataset.status !== "submitted") {
    return failure("dataset_not_submitted", "Only submitted attribution datasets can be approved or rejected.")
  }

  const [{ data: project, error: projectError }, { data: cycle, error: cycleError }] = await Promise.all([
    supabase.from("projects").select("id, slug, name").eq("id", typedDataset.project_id).maybeSingle(),
    supabase.from("monthly_cycles").select("id, cycle_key").eq("id", typedDataset.monthly_cycle_id).maybeSingle(),
  ])

  if (projectError || !project) {
    return failure("project_not_found", projectError?.message ?? "Project not found for attribution dataset.")
  }

  if (cycleError || !cycle) {
    return failure("cycle_not_found", cycleError?.message ?? "Monthly cycle not found for attribution dataset.")
  }

  const now = new Date().toISOString()
  const reviewPatch =
    input.decision === "approved"
      ? {
          status: "approved",
          approved_by_user_id: input.actorUserId,
          approved_at: now,
          rejected_by_user_id: null,
          rejected_at: null,
          rejection_reason: null,
        }
      : {
          status: "rejected",
          approved_by_user_id: null,
          approved_at: null,
          rejected_by_user_id: input.actorUserId,
          rejected_at: now,
          rejection_reason: input.reason ?? "Rejected by operator.",
        }

  const { data: reviewedDataset, error: reviewError } = await supabase
    .from("project_attribution_datasets")
    .update(reviewPatch)
    .eq("id", typedDataset.id)
    .eq("status", "submitted")
    .select(
      "id, project_id, monthly_cycle_id, status, row_count, total_attribution_points, note, proof_type, proof_artifact_uri, verifier_backend, verification_status, submitted_by_user_id, submitted_at, updated_at",
    )
    .single()

  if (reviewError || !reviewedDataset) {
    return failure("review_failed", reviewError?.message ?? "Attribution dataset review could not be recorded.")
  }

  const { data: rows, error: rowsError } = await supabase
    .from("project_attribution_rows")
    .select(
      "id, row_index, scoped_cubid_id, user_id, user_email, attribution_points, category, evidence_reference, notes, resolution_status, resolution_message",
    )
    .eq("dataset_id", typedDataset.id)
    .order("row_index", { ascending: true })

  if (rowsError || !rows) {
    return failure("rows_failed", rowsError?.message ?? "Attribution rows could not be loaded after review.")
  }

  const typedProject = project as ProjectRow
  const typedCycle = cycle as CycleRow
  const typedReviewedDataset = reviewedDataset as DatasetRow
  const attemptId = input.attemptId ?? crypto.randomUUID()
  const auditError = await insertReviewEvent(supabase, {
    cycle: typedCycle,
    dataset: typedReviewedDataset,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    attemptId,
    decision: input.decision,
    message:
      input.decision === "approved"
        ? `Approved attribution dataset ${typedReviewedDataset.id}.`
        : `Rejected attribution dataset ${typedReviewedDataset.id}.`,
    metadata: {
      dataset_id: typedReviewedDataset.id,
      project_id: typedReviewedDataset.project_id,
      project_slug: typedProject.slug,
      decision: input.decision,
      row_count: typedReviewedDataset.row_count,
      total_attribution_points: typedReviewedDataset.total_attribution_points,
      reason: input.reason ?? null,
    },
  })

  if (auditError) {
    return failure("audit_failed", auditError.message)
  }

  return {
    ok: true,
    data: {
      id: typedReviewedDataset.id,
      projectId: typedReviewedDataset.project_id,
      projectSlug: typedProject.slug ?? String(typedProject.id),
      cycleId: typedReviewedDataset.monthly_cycle_id,
      cycleKey: typedCycle.cycle_key,
      status: typedReviewedDataset.status,
      rowCount: typedReviewedDataset.row_count,
      totalAttributionPoints: numberValue(typedReviewedDataset.total_attribution_points),
      note: typedReviewedDataset.note,
      proofType: typedReviewedDataset.proof_type,
      proofArtifactUri: typedReviewedDataset.proof_artifact_uri,
      verifierBackend: typedReviewedDataset.verifier_backend,
      verificationStatus: typedReviewedDataset.verification_status,
      submittedByUserId: typedReviewedDataset.submitted_by_user_id,
      submittedAt: typedReviewedDataset.submitted_at,
      updatedAt: typedReviewedDataset.updated_at,
      rows: (rows as AttributionRowRecord[]).map(toSummaryRow),
      decision: input.decision,
      reviewedAt: now,
      reviewedByUserId: input.actorUserId,
      reason: input.decision === "rejected" ? input.reason ?? "Rejected by operator." : null,
    },
  }
}
