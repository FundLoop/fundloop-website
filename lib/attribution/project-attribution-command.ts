import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type {
  ProjectAttributionDatasetStatus,
  ProjectAttributionDatasetSubmitCommandInput,
  ProjectAttributionDatasetSummary,
  ProjectAttributionRowInput,
  ProjectAttributionRowSummary,
} from "../edge-functions/project-attribution-dataset-submit-contract.ts"

type ProjectRow = {
  id: number
  slug: string
  name: string
  organization_id: number | null
}

type RoleReferenceRow = {
  id: number
}

type MonthlyCycleRow = {
  id: number
  cycle_key: string
  status: string
}

type UserResolutionRow = {
  user_id: string
  email: string | null
  cubid_id: string | null
  cubid_identity_status: "unlinked" | "linked" | "verified"
  primary_email_identity: string | null
}

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

export type ProjectAttributionCommandInput = ProjectAttributionDatasetSubmitCommandInput & {
  actorUserId: string
}

export type ProjectAttributionCommandFailureCode =
  | "project_not_found"
  | "permission_denied"
  | "cycle_not_found"
  | "cycle_not_open"
  | "reference_data_unavailable"
  | "user_resolution_failed"
  | "user_not_cubid_linked"
  | "dataset_failed"
  | "rows_failed"

export type ProjectAttributionCommandResult =
  | {
      ok: true
      data: ProjectAttributionDatasetSummary
    }
  | {
      ok: false
      error: {
        code: ProjectAttributionCommandFailureCode
        message: string
        projectId: number | null
        cycleId: number | null
      }
    }

type CommandFailure = Extract<ProjectAttributionCommandResult, { ok: false }>

function commandFailure(
  code: ProjectAttributionCommandFailureCode,
  message: string,
  context: { projectId?: number | null; cycleId?: number | null } = {},
): CommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      projectId: context.projectId ?? null,
      cycleId: context.cycleId ?? null,
    },
  }
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

function toDatasetSummary(
  dataset: DatasetRow,
  project: ProjectRow,
  cycle: MonthlyCycleRow,
  rows: AttributionRowRecord[],
): ProjectAttributionDatasetSummary {
  return {
    id: dataset.id,
    projectId: dataset.project_id,
    projectSlug: project.slug,
    cycleId: dataset.monthly_cycle_id,
    cycleKey: cycle.cycle_key,
    status: dataset.status,
    rowCount: dataset.row_count,
    totalAttributionPoints: numberValue(dataset.total_attribution_points),
    note: dataset.note,
    proofType: dataset.proof_type,
    proofArtifactUri: dataset.proof_artifact_uri,
    verifierBackend: dataset.verifier_backend,
    verificationStatus: dataset.verification_status,
    submittedByUserId: dataset.submitted_by_user_id,
    submittedAt: dataset.submitted_at,
    updatedAt: dataset.updated_at,
    rows: rows.map(toSummaryRow),
  }
}

async function resolveProject(
  supabase: SupabaseClient<Database>,
  projectSlug: string,
): Promise<{ ok: true; data: ProjectRow } | CommandFailure> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, slug, name, organization_id")
    .eq("slug", projectSlug)
    .maybeSingle()

  if (error || !project) {
    return commandFailure("project_not_found", error?.message ?? "Project not found.")
  }

  return { ok: true, data: project as ProjectRow }
}

async function assertProjectContributorAccess(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  project: ProjectRow,
): Promise<{ ok: true } | CommandFailure> {
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("project_id", project.id)
    .eq("user_id", actorUserId)
    .maybeSingle()

  if (participantError) {
    return commandFailure("reference_data_unavailable", participantError.message, { projectId: project.id })
  }

  if (participant?.id) return { ok: true }

  const { data: adminRoles, error: adminRolesError } = await supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
  if (adminRolesError) {
    return commandFailure("reference_data_unavailable", adminRolesError.message, { projectId: project.id })
  }

  const adminRoleIds = ((adminRoles as RoleReferenceRow[] | null) ?? []).map((role) => role.id)
  if (project.organization_id && adminRoleIds.length > 0) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", actorUserId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (membershipError) {
      return commandFailure("reference_data_unavailable", membershipError.message, { projectId: project.id })
    }

    if (membership?.id) return { ok: true }
  }

  return commandFailure("permission_denied", "You do not have permission to submit attribution for this project.", {
    projectId: project.id,
  })
}

async function resolveOpenCycle(
  supabase: SupabaseClient<Database>,
  cycleKey: string,
  projectId: number,
): Promise<{ ok: true; data: MonthlyCycleRow } | CommandFailure> {
  const { data: cycle, error } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, status")
    .eq("cycle_key", cycleKey)
    .maybeSingle()

  if (error || !cycle) {
    return commandFailure("cycle_not_found", error?.message ?? "Monthly cycle not found.", { projectId })
  }

  const typedCycle = cycle as MonthlyCycleRow
  if (typedCycle.status !== "open") {
    return commandFailure("cycle_not_open", "Attribution datasets can only be changed while the cycle is open.", {
      projectId,
      cycleId: typedCycle.id,
    })
  }

  return { ok: true, data: typedCycle }
}

function userMatchesScopedCubid(user: UserResolutionRow, scopedCubidId: string) {
  return user.cubid_id === scopedCubidId
}

async function resolveRowUser(
  supabase: SupabaseClient<Database>,
  row: ProjectAttributionRowInput,
  context: { projectId: number; cycleId: number },
): Promise<{ ok: true; data: UserResolutionRow } | CommandFailure> {
  const query = supabase.from("users").select("user_id, email, cubid_id, cubid_identity_status, primary_email_identity")
  const result = row.userId
    ? await query.eq("user_id", row.userId).maybeSingle()
    : row.userEmail
      ? await query.eq("primary_email_identity", row.userEmail).maybeSingle()
      : await query.eq("cubid_id", row.scopedCubidId).maybeSingle()

  if (result.error) {
    return commandFailure("reference_data_unavailable", result.error.message, context)
  }

  if (!result.data) {
    return commandFailure("user_resolution_failed", `No FundLoop user resolved for scoped CUBID identity ${row.scopedCubidId}.`, context)
  }

  const user = result.data as UserResolutionRow
  if (!userMatchesScopedCubid(user, row.scopedCubidId)) {
    return commandFailure("user_resolution_failed", `Resolved user does not match scoped CUBID identity ${row.scopedCubidId}.`, context)
  }

  if (user.cubid_identity_status !== "linked" && user.cubid_identity_status !== "verified") {
    return commandFailure("user_not_cubid_linked", `Resolved user ${user.user_id} is not CUBID-linked.`, context)
  }

  return { ok: true, data: user }
}

async function resolveRows(
  supabase: SupabaseClient<Database>,
  rows: ProjectAttributionRowInput[],
  context: { projectId: number; cycleId: number },
): Promise<{ ok: true; data: Array<ProjectAttributionRowInput & { resolvedUser: UserResolutionRow }> } | CommandFailure> {
  const resolvedRows: Array<ProjectAttributionRowInput & { resolvedUser: UserResolutionRow }> = []
  for (const row of rows) {
    const resolution = await resolveRowUser(supabase, row, context)
    if (!resolution.ok) return resolution
    resolvedRows.push({ ...row, resolvedUser: resolution.data })
  }

  return { ok: true, data: resolvedRows }
}

function buildRowRecords(
  datasetId: number,
  project: ProjectRow,
  cycle: MonthlyCycleRow,
  rows: Array<ProjectAttributionRowInput & { resolvedUser: UserResolutionRow }>,
) {
  return rows.map((row, index) => ({
    dataset_id: datasetId,
    project_id: project.id,
    monthly_cycle_id: cycle.id,
    row_index: index + 1,
    scoped_cubid_id: row.scopedCubidId,
    user_id: row.resolvedUser.user_id,
    user_email: row.resolvedUser.primary_email_identity ?? row.resolvedUser.email ?? row.userEmail ?? null,
    attribution_points: row.attributionPoints,
    category: row.category ?? null,
    evidence_reference: row.evidenceReference ?? null,
    notes: row.notes ?? null,
    resolution_status: "resolved",
    resolution_message: null,
  }))
}

function datasetStatus(status: ProjectAttributionDatasetStatus | undefined) {
  return status ?? "submitted"
}

export async function executeProjectAttributionDatasetSubmitCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectAttributionCommandInput,
): Promise<ProjectAttributionCommandResult> {
  const projectResult = await resolveProject(supabase, input.projectSlug)
  if (!projectResult.ok) return projectResult
  const project = projectResult.data

  const accessResult = await assertProjectContributorAccess(supabase, input.actorUserId, project)
  if (!accessResult.ok) return accessResult

  const cycleResult = await resolveOpenCycle(supabase, input.cycleKey, project.id)
  if (!cycleResult.ok) return cycleResult
  const cycle = cycleResult.data

  const rowResolution = await resolveRows(supabase, input.rows, { projectId: project.id, cycleId: cycle.id })
  if (!rowResolution.ok) return rowResolution

  const totalAttributionPoints = rowResolution.data.reduce((sum, row) => sum + row.attributionPoints, 0)
  const { data: dataset, error: datasetError } = await supabase
    .from("project_attribution_datasets")
    .upsert(
      {
        project_id: project.id,
        monthly_cycle_id: cycle.id,
        status: datasetStatus(input.status),
        row_count: rowResolution.data.length,
        total_attribution_points: Math.round(totalAttributionPoints * 1_000_000) / 1_000_000,
        note: input.note ?? null,
        proof_type: input.proofType ?? "raw_rows",
        proof_artifact_uri: input.proofArtifactUri ?? null,
        verifier_backend: input.verifierBackend ?? null,
        verification_status: input.verificationStatus ?? "not_required",
        submitted_by_user_id: input.actorUserId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "project_id,monthly_cycle_id" },
    )
    .select(
      "id, project_id, monthly_cycle_id, status, row_count, total_attribution_points, note, proof_type, proof_artifact_uri, verifier_backend, verification_status, submitted_by_user_id, submitted_at, updated_at",
    )
    .single()

  if (datasetError || !dataset) {
    return commandFailure("dataset_failed", datasetError?.message ?? "Attribution dataset could not be saved.", {
      projectId: project.id,
      cycleId: cycle.id,
    })
  }

  const typedDataset = dataset as DatasetRow
  const deleteResult = await supabase.from("project_attribution_rows").delete().eq("dataset_id", typedDataset.id)
  if (deleteResult.error) {
    return commandFailure("rows_failed", deleteResult.error.message, { projectId: project.id, cycleId: cycle.id })
  }

  const { data: insertedRows, error: rowsError } = await supabase
    .from("project_attribution_rows")
    .insert(buildRowRecords(typedDataset.id, project, cycle, rowResolution.data))
    .select(
      "id, row_index, scoped_cubid_id, user_id, user_email, attribution_points, category, evidence_reference, notes, resolution_status, resolution_message",
    )

  if (rowsError || !insertedRows) {
    return commandFailure("rows_failed", rowsError?.message ?? "Attribution rows could not be saved.", {
      projectId: project.id,
      cycleId: cycle.id,
    })
  }

  return {
    ok: true,
    data: toDatasetSummary(typedDataset, project, cycle, insertedRows as AttributionRowRecord[]),
  }
}
