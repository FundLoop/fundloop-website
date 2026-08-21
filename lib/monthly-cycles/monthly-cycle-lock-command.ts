import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"
import { isUnresolvedOnchainSubmissionStatus } from "./monthly-cycle-statuses.ts"

export type MonthlyCycleLockInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: "internal_admin" | "system"
  overrideUnresolvedOnchain?: boolean
  overrideRequiredInputs?: boolean
  overrideReason?: string
}

export type MonthlyCycleLockOutput = {
  cycleId: number
  cycleKey: string
  status: "locked"
  lockedAt: string
  lockedManifestHash: string
  counts: {
    payments: number
    onchainSubmissions: number
    unresolvedOnchainSubmissions: number
    identitySnapshots: number
    approvedDatasets: number
    identityArtifacts: number
  }
  overrideApplied: boolean
}

export type MonthlyCycleLockCommandError = {
  code: string
  message: string
}

export type MonthlyCycleLockCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MonthlyCycleLockCommandError }

type CommandDeps = {
  now?: () => Date
}

type CycleRow = Database["public"]["Tables"]["monthly_cycles"]["Row"]
type RequiredInputBlocker =
  | { code: "missing_contribution_submissions"; count: number; project_ids: number[] }
  | { code: "missing_approved_attribution_datasets"; count: number; project_ids: number[] }
  | { code: "unresolved_attribution_rows"; count: number; row_ids: number[] }
  | { code: "ineligible_attribution_users"; count: number; user_ids: string[] }
  | { code: "missing_identity_snapshots"; count: number; user_ids: string[] }

function success<T>(data: T): MonthlyCycleLockCommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): MonthlyCycleLockCommandResult<never> {
  return { ok: false, error: { code, message } }
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function sortedUnique<T>(values: T[]) {
  return [...new Set(values)].sort((a, b) => compareStableStrings(String(a), String(b)))
}

function compareStableStrings(a: string, b: string) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0)
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

async function sha256Hex(value: unknown) {
  const bytes = new TextEncoder().encode(stableStringify(value))
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function projectIdsForUser(participants: Array<{ project_id: number; user_id: string }>, userId: string) {
  return sortedUnique(
    participants
      .filter((participant) => participant.user_id === userId)
      .map((participant) => participant.project_id)
      .filter((id): id is number => Number.isInteger(id)),
  )
}

function attributionProjectIdsForUser(attributionRows: Array<Record<string, unknown>>, userId: string) {
  return sortedUnique(
    attributionRows
      .filter((row) => row.user_id === userId)
      .map((row) => row.project_id)
      .filter((id): id is number => Number.isInteger(id)),
  )
}

async function insertCycleEvent(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleLockInput,
  params: {
    cycleId: number | null
    eventType: "lock_attempt" | "lock_success" | "lock_failure"
    outcome: "attempt" | "success" | "failure"
    severity?: "info" | "warning" | "error"
    message?: string
    metadata?: Json
  },
) {
  const { error } = await supabase.from("monthly_cycle_events").insert({
    monthly_cycle_id: params.cycleId,
    cycle_key: input.cycleKey,
    event_type: params.eventType,
    attempt_id: input.attemptId,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    outcome: params.outcome,
    severity: params.severity ?? "info",
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  })
  return error
}

async function reattachCycleRows(supabase: SupabaseClient<Database>, cycle: CycleRow) {
  const paymentUpdate = await supabase
    .from("payments")
    .update({ monthly_cycle_id: cycle.id })
    .is("monthly_cycle_id", null)
    .gte("period_end", cycle.period_start)
    .lte("period_end", cycle.period_end)
  if (paymentUpdate.error) return paymentUpdate.error

  const cyclePayments = await supabase.from("payments").select("id").eq("monthly_cycle_id", cycle.id)
  if (cyclePayments.error) return cyclePayments.error
  const cyclePaymentIds = asArray(cyclePayments.data).map((payment) => payment.id)
  if (cyclePaymentIds.length > 0) {
    const submissionUpdate = await supabase
      .from("onchain_payment_submissions")
      .update({ monthly_cycle_id: cycle.id })
      .is("monthly_cycle_id", null)
      .in("payment_id", cyclePaymentIds)
    if (submissionUpdate.error) return submissionUpdate.error
  }

  for (const table of ["zkas_datasets", "zkas_identity_artifacts", "zkas_runs"] as const) {
    const update = await supabase.from(table).update({ monthly_cycle_id: cycle.id }).is("monthly_cycle_id", null).eq("month", cycle.cycle_key)
    if (update.error) return update.error
  }

  const projectStatsUpdate = await supabase
    .from("project_stats_monthly")
    .update({ monthly_cycle_id: cycle.id })
    .is("monthly_cycle_id", null)
    .eq("year", cycle.year)
    .eq("month", cycle.month)
  if (projectStatsUpdate.error) return projectStatsUpdate.error

  return null
}

async function fetchRows<T>(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
  select: string,
  cycleId: number,
) {
  const { data, error } = await supabase.from(table as never).select(select).eq("monthly_cycle_id", cycleId)
  if (error) {
    throw new Error(error.message)
  }
  return asArray(data as T[] | null)
}

export async function executeMonthlyCycleLockCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleLockInput,
  deps: CommandDeps = {},
): Promise<MonthlyCycleLockCommandResult<MonthlyCycleLockOutput>> {
  const overrideReason = input.overrideReason?.trim() ?? ""
  if ((input.overrideUnresolvedOnchain || input.overrideRequiredInputs) && !overrideReason) {
    return failure("override_reason_required", "Provide an override reason before locking with unresolved or missing monthly-cycle inputs.")
  }

  const { data: cycle, error: cycleError } = await supabase
    .from("monthly_cycles")
    .select("*")
    .eq("cycle_key", input.cycleKey)
    .maybeSingle()

  if (cycleError) {
    return failure("query_failed", cycleError.message)
  }

  if (!cycle) {
    const notFoundEventError = await insertCycleEvent(supabase, input, {
      cycleId: null,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle not found.",
    })
    if (notFoundEventError) return failure("query_failed", notFoundEventError.message)
    return failure("cycle_not_found", "Monthly cycle not found.")
  }

  const attemptEventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "lock_attempt",
    outcome: "attempt",
      message: "Monthly cycle lock attempt started.",
      metadata: {
        overrideUnresolvedOnchain: Boolean(input.overrideUnresolvedOnchain),
        overrideRequiredInputs: Boolean(input.overrideRequiredInputs),
      },
    })
  if (attemptEventError) return failure("query_failed", attemptEventError.message)

  if (cycle.status !== "open") {
    const eventError = await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not open.",
      metadata: { status: cycle.status },
    })
    if (eventError) return failure("query_failed", eventError.message)
    return failure("cycle_not_open", "Only open monthly cycles can be locked.")
  }

  const attachError = await reattachCycleRows(supabase, cycle)
  if (attachError) {
    const eventError = await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "error",
      message: attachError.message,
    })
    if (eventError) return failure("query_failed", eventError.message)
    return failure("query_failed", attachError.message)
  }

  try {
    const { data: confirmedStatus, error: statusError } = await supabase
      .from("ref_payment_statuses")
      .select("id")
      .eq("code", "confirmed")
      .maybeSingle()
    if (statusError) return failure("query_failed", statusError.message)
    if (!confirmedStatus) return failure("query_failed", "Confirmed payment status reference is missing.")

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("id, project_id, period_start, period_end, revenue, payment_amount, payment_percentage, status_id, confirmed_at, paid_at")
      .eq("monthly_cycle_id", cycle.id)
      .eq("status_id", confirmedStatus.id)
      .is("deleted_at", null)
      .order("id", { ascending: true })
    if (paymentsError) return failure("query_failed", paymentsError.message)
    const payments = asArray(paymentsData)

    const onchainSubmissions = await fetchRows<Record<string, unknown>>(
      supabase,
      "onchain_payment_submissions",
      "id, payment_id, project_id, tx_hash, status, confirmation_count, submitted_at, confirmed_at, reconciled_at",
      cycle.id,
    )
    const unresolvedSubmissions = onchainSubmissions.filter((submission) =>
      isUnresolvedOnchainSubmissionStatus(String(submission.status ?? "")),
    )

    if (unresolvedSubmissions.length > 0 && !input.overrideUnresolvedOnchain) {
      const eventError = await insertCycleEvent(supabase, input, {
        cycleId: cycle.id,
        eventType: "lock_failure",
        outcome: "failure",
        severity: "warning",
        message: "Unresolved onchain submissions block the monthly-cycle lock.",
        metadata: {
          unresolvedOnchainSubmissionIds: unresolvedSubmissions
            .map((submission) => submission.id)
            .filter((id): id is number => Number.isInteger(id)),
        },
      })
      if (eventError) return failure("query_failed", eventError.message)
      return failure(
        "unresolved_onchain_submissions",
        `${unresolvedSubmissions.length} onchain submission(s) are still unresolved. Reconcile them or provide a lock override reason.`,
      )
    }

    const datasets = (
      await fetchRows<Record<string, unknown>>(
        supabase,
        "zkas_datasets",
        "id, project_id, month, status, file_hash, schema_version, row_count, approved_at, approved_by_user_id",
        cycle.id,
      )
    ).filter((dataset) => ["approved", "included"].includes(String(dataset.status ?? "")))

    const identityArtifacts = (
      await fetchRows<Record<string, unknown>>(
        supabase,
        "zkas_identity_artifacts",
        "id, month, status, provider, artifact_hash, schema_version, uploaded_by_user_id, created_at",
        cycle.id,
      )
    ).filter((artifact) => String(artifact.status ?? "") === "approved")

    const contributionSubmissions = (
      await fetchRows<Record<string, unknown>>(
        supabase,
        "project_monthly_contribution_submissions",
        "id, project_id, period_start, period_end, source_currency_code, source_amount, usd_equivalent_amount, commitment_percentage, calculated_contribution_amount, source_reference, status, submitted_by_user_id, submitted_at, updated_at",
        cycle.id,
      )
    )
      .filter((submission) => String(submission.status ?? "") === "submitted")
      .sort((a, b) => Number(a.project_id) - Number(b.project_id) || Number(a.id) - Number(b.id))
    const committedProjectsQuery = await supabase
      .from("projects")
      .select("id, slug, name, status, payment_percentage")
      .is("deleted_at", null)
      .gt("payment_percentage", 0)
    if (committedProjectsQuery.error) return failure("query_failed", committedProjectsQuery.error.message)
    const committedProjects = asArray(committedProjectsQuery.data as Array<Record<string, unknown>> | null)
      .filter((project) => String(project.status ?? "") !== "deleted")
      .sort((a, b) => Number(a.id) - Number(b.id))

    const attributionDatasets = (
      await fetchRows<Record<string, unknown>>(
        supabase,
        "project_attribution_datasets",
        "id, project_id, monthly_cycle_id, status, row_count, total_attribution_points, note, proof_type, proof_artifact_uri, verifier_backend, verification_status, submitted_by_user_id, submitted_at, approved_by_user_id, approved_at, updated_at",
        cycle.id,
      )
    )
      .filter((dataset) => String(dataset.status ?? "") === "approved")
      .sort((a, b) => Number(a.project_id) - Number(b.project_id) || Number(a.id) - Number(b.id))
    const attributionDatasetIds = attributionDatasets.map((dataset) => dataset.id).filter((id): id is number => Number.isInteger(id))
    const attributionRowsQuery =
      attributionDatasetIds.length > 0
        ? await supabase
            .from("project_attribution_rows")
            .select(
              "id, dataset_id, project_id, monthly_cycle_id, row_index, scoped_cubid_id, user_id, user_email, attribution_points, category, evidence_reference, notes, resolution_status, resolution_message, created_at",
            )
            .in("dataset_id", attributionDatasetIds)
            .eq("monthly_cycle_id", cycle.id)
        : { data: [], error: null }
    if (attributionRowsQuery.error) return failure("query_failed", attributionRowsQuery.error.message)
    const attributionRows = asArray(attributionRowsQuery.data as Array<Record<string, unknown>> | null).sort(
      (a, b) => Number(a.dataset_id) - Number(b.dataset_id) || Number(a.row_index) - Number(b.row_index) || compareStableStrings(String(a.id), String(b.id)),
    )

    const projectIds = sortedUnique(
      [
        ...payments.map((payment) => payment.project_id).filter((id): id is number => Number.isInteger(id)),
        ...datasets.map((dataset) => dataset.project_id).filter((id): id is number => Number.isInteger(id)),
        ...contributionSubmissions.map((submission) => submission.project_id).filter((id): id is number => Number.isInteger(id)),
        ...attributionDatasets.map((dataset) => dataset.project_id).filter((id): id is number => Number.isInteger(id)),
      ],
    )

    const participantsQuery =
      projectIds.length > 0
        ? await supabase.from("participants").select("project_id, user_id").in("project_id", projectIds)
        : { data: [], error: null }
    if (participantsQuery.error) return failure("query_failed", participantsQuery.error.message)
    const participants = asArray(participantsQuery.data as Array<{ project_id: number; user_id: string }> | null)
    const userIds = sortedUnique([
      ...participants.map((participant) => participant.user_id).filter(Boolean),
      ...attributionRows.map((row) => row.user_id).filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
    ])

    const usersQuery =
      userIds.length > 0
        ? await supabase
            .from("users")
            .select("user_id, email, cubid_id, cubid_identity_status, cubid_score, primary_email_identity, status")
            .in("user_id", userIds)
            .eq("status", "active")
        : { data: [], error: null }
    if (usersQuery.error) return failure("query_failed", usersQuery.error.message)
    const users = asArray(usersQuery.data as Array<Record<string, unknown>> | null)
    const activeUserIds = sortedUnique(users.map((user) => String(user.user_id)))

    const snapshotsQuery =
      activeUserIds.length > 0
        ? await supabase
            .from("cubid_identity_snapshots")
            .select(
              "user_id, cubid_user_id, primary_name, primary_email, primary_phone, cubid_score, available_stamp_types, verified_stamp_types, last_synced_at",
            )
            .in("user_id", activeUserIds)
        : { data: [], error: null }
    if (snapshotsQuery.error) return failure("query_failed", snapshotsQuery.error.message)
    const snapshots = asArray(snapshotsQuery.data as Array<Record<string, unknown>> | null)
    const snapshotsByUserId = new Map(snapshots.map((snapshot) => [String(snapshot.user_id), snapshot]))

    const assetPreferencesQuery =
      activeUserIds.length > 0
        ? await supabase
            .from("user_asset_preferences")
            .select("id, user_id, rank, asset_type, asset_code, project_id, accepted, updated_at")
            .in("user_id", activeUserIds)
            .order("rank", { ascending: true })
        : { data: [], error: null }
    if (assetPreferencesQuery.error) return failure("query_failed", assetPreferencesQuery.error.message)
    const assetPreferences = asArray(assetPreferencesQuery.data as Array<Record<string, unknown>> | null)
    const assetPreferencesByUserId = new Map<string, Array<Record<string, unknown>>>()
    for (const preference of assetPreferences) {
      const userId = String(preference.user_id)
      const existing = assetPreferencesByUserId.get(userId) ?? []
      existing.push(preference)
      assetPreferencesByUserId.set(userId, existing)
    }

    const identitySnapshots = users
      .map((user) => {
        const snapshot = snapshotsByUserId.get(String(user.user_id))
        return {
          user_id: normalizeString(user.user_id),
          cubid_id: normalizeString(user.cubid_id) ?? normalizeString(snapshot?.cubid_user_id),
          cubid_identity_status: normalizeString(user.cubid_identity_status),
          cubid_score: normalizeNumber(snapshot?.cubid_score ?? user.cubid_score ?? null),
          primary_email:
            normalizeString(snapshot?.primary_email) ?? normalizeString(user.primary_email_identity) ?? normalizeString(user.email),
          primary_phone: normalizeString(snapshot?.primary_phone),
          available_stamp_types: normalizeStringArray(snapshot?.available_stamp_types),
          verified_stamp_types: normalizeStringArray(snapshot?.verified_stamp_types),
          last_synced_at: normalizeString(snapshot?.last_synced_at),
        }
      })
      .sort((a, b) => compareStableStrings(String(a.user_id), String(b.user_id)))
    const eligibleUsers = users
      .map((user) => {
        const userId = String(user.user_id)
        const cubidStatus = normalizeString(user.cubid_identity_status)
        return {
          user_id: normalizeString(user.user_id),
          status: normalizeString(user.status),
          cubid_id: normalizeString(user.cubid_id),
          cubid_identity_status: cubidStatus,
          is_eligible: cubidStatus === "linked" || cubidStatus === "verified",
          participant_project_ids: projectIdsForUser(participants, userId),
          attributed_project_ids: attributionProjectIdsForUser(attributionRows, userId),
        }
      })
      .sort((a, b) => compareStableStrings(String(a.user_id), String(b.user_id)))
    const assetPreferenceSummaries = activeUserIds
      .map((userId) => {
        const preferences = (assetPreferencesByUserId.get(userId) ?? [])
          .map((preference) => ({
            id: preference.id,
            rank: preference.rank,
            asset_type: preference.asset_type,
            asset_code: preference.asset_code,
            project_id: preference.project_id,
            accepted: preference.accepted,
          }))
          .sort((a, b) => Number(a.rank) - Number(b.rank) || compareStableStrings(String(a.asset_code), String(b.asset_code)))
        const projectTokenPreferences = preferences.filter((preference) => preference.asset_type === "project_token")
        return {
          user_id: userId,
          has_custom_preferences: preferences.length > 0,
          rejects_all_project_tokens:
            projectTokenPreferences.length > 0 && projectTokenPreferences.every((preference) => preference.accepted === false),
          preferences,
        }
      })
      .sort((a, b) => compareStableStrings(a.user_id, b.user_id))
    const submittedContributionProjectIds = new Set(contributionSubmissions.map((submission) => Number(submission.project_id)))
    const approvedAttributionProjectIds = new Set(attributionDatasets.map((dataset) => Number(dataset.project_id)))
    const usersById = new Map(users.map((user) => [String(user.user_id), user]))
    const identitySnapshotsByUserId = new Map(identitySnapshots.map((snapshot) => [String(snapshot.user_id), snapshot]))
    const contributionSubmissionInputs = contributionSubmissions.map((submission) => ({
      id: submission.id,
      project_id: submission.project_id,
      period_start: submission.period_start,
      period_end: submission.period_end,
      source_currency_code: submission.source_currency_code,
      source_amount: normalizeNumber(submission.source_amount),
      usd_equivalent_amount: normalizeNumber(submission.usd_equivalent_amount),
      commitment_percentage: normalizeNumber(submission.commitment_percentage),
      calculated_contribution_amount: normalizeNumber(submission.calculated_contribution_amount),
      source_reference: submission.source_reference,
      status: submission.status,
      submitted_by_user_id: submission.submitted_by_user_id,
      submitted_at: submission.submitted_at,
      updated_at: submission.updated_at,
    }))
    const attributionDatasetInputs = attributionDatasets.map((dataset) => ({
      id: dataset.id,
      project_id: dataset.project_id,
      status: dataset.status,
      row_count: dataset.row_count,
      total_attribution_points: normalizeNumber(dataset.total_attribution_points),
      note: dataset.note,
      proof_type: dataset.proof_type,
      proof_artifact_uri: dataset.proof_artifact_uri,
      verifier_backend: dataset.verifier_backend,
      verification_status: dataset.verification_status,
      submitted_by_user_id: dataset.submitted_by_user_id,
      submitted_at: dataset.submitted_at,
      approved_by_user_id: dataset.approved_by_user_id,
      approved_at: dataset.approved_at,
      updated_at: dataset.updated_at,
    }))
    const attributionRowInputs = attributionRows.map((row) => ({
      id: row.id,
      dataset_id: row.dataset_id,
      project_id: row.project_id,
      row_index: row.row_index,
      scoped_cubid_id: row.scoped_cubid_id,
      user_id: row.user_id,
      user_email: row.user_email,
      attribution_points: normalizeNumber(row.attribution_points),
      category: row.category,
      evidence_reference: row.evidence_reference,
      notes: row.notes,
      resolution_status: row.resolution_status,
      resolution_message: row.resolution_message,
      created_at: row.created_at,
    }))
    const missingContributionProjects = committedProjects
      .filter((project) => !submittedContributionProjectIds.has(Number(project.id)))
      .map((project) => ({ id: Number(project.id), slug: normalizeString(project.slug), name: normalizeString(project.name) ?? `Project ${project.id}` }))
    const missingAttributionProjects = committedProjects
      .filter((project) => !approvedAttributionProjectIds.has(Number(project.id)))
      .map((project) => ({ id: Number(project.id), slug: normalizeString(project.slug), name: normalizeString(project.name) ?? `Project ${project.id}` }))
    const unresolvedAttributionRows = attributionRowInputs.filter((row) => row.resolution_status !== "resolved" || !row.user_id)
    const ineligibleAttributionUsers = sortedUnique(
      attributionRowInputs
        .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
        .filter((userId): userId is string => {
          if (!userId) return false
          const user = usersById.get(userId)
          const status = normalizeString(user?.cubid_identity_status)
          return status !== "linked" && status !== "verified"
        }),
    )
    const missingIdentitySnapshotUsers = sortedUnique(
      attributionRowInputs
        .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
        .filter((userId): userId is string => Boolean(userId && !identitySnapshotsByUserId.has(userId))),
    )
    const requiredInputBlockers: RequiredInputBlocker[] = [
      ...(missingContributionProjects.length > 0
        ? [
            {
              code: "missing_contribution_submissions" as const,
              count: missingContributionProjects.length,
              project_ids: missingContributionProjects.map((project) => project.id),
            },
          ]
        : []),
      ...(missingAttributionProjects.length > 0
        ? [
            {
              code: "missing_approved_attribution_datasets" as const,
              count: missingAttributionProjects.length,
              project_ids: missingAttributionProjects.map((project) => project.id),
            },
          ]
        : []),
      ...(unresolvedAttributionRows.length > 0
        ? [
            {
              code: "unresolved_attribution_rows" as const,
              count: unresolvedAttributionRows.length,
              row_ids: unresolvedAttributionRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id)),
            },
          ]
        : []),
      ...(ineligibleAttributionUsers.length > 0
        ? [
            {
              code: "ineligible_attribution_users" as const,
              count: ineligibleAttributionUsers.length,
              user_ids: ineligibleAttributionUsers,
            },
          ]
        : []),
      ...(missingIdentitySnapshotUsers.length > 0
        ? [
            {
              code: "missing_identity_snapshots" as const,
              count: missingIdentitySnapshotUsers.length,
              user_ids: missingIdentitySnapshotUsers,
            },
          ]
        : []),
    ]
    if (requiredInputBlockers.length > 0 && !input.overrideRequiredInputs) {
      const eventError = await insertCycleEvent(supabase, input, {
        cycleId: cycle.id,
        eventType: "lock_failure",
        outcome: "failure",
        severity: "warning",
        message: "Required MVP monthly-cycle inputs block the lock.",
        metadata: {
          blockers: requiredInputBlockers,
        },
      })
      if (eventError) return failure("query_failed", eventError.message)
      return failure(
        "missing_mvp_required_inputs",
        "Required MVP inputs are missing or incomplete. Review contribution submissions, approved attribution, and CUBID-linked participant snapshots before locking, or provide an audited override reason.",
      )
    }

    const lockedAt = (deps.now?.() ?? new Date()).toISOString()
    const counts = {
      payments: payments.length,
      onchainSubmissions: onchainSubmissions.length,
      unresolvedOnchainSubmissions: unresolvedSubmissions.length,
      identitySnapshots: identitySnapshots.length,
      approvedDatasets: datasets.length,
      identityArtifacts: identityArtifacts.length,
    }
    const mvpCounts = {
      contributionSubmissions: contributionSubmissionInputs.length,
      attributionDatasets: attributionDatasetInputs.length,
      attributionRows: attributionRowInputs.length,
      eligibleUsers: eligibleUsers.filter((user) => user.is_eligible).length,
      assetPreferenceSummaries: assetPreferenceSummaries.length,
      usersRejectingProjectTokens: assetPreferenceSummaries.filter((summary) => summary.rejects_all_project_tokens).length,
    }
    const mvpChecksums = {
      contributionSubmissions: await sha256Hex(contributionSubmissionInputs),
      attributionDatasets: await sha256Hex(attributionDatasetInputs),
      attributionRows: await sha256Hex(attributionRowInputs),
      eligibleUsers: await sha256Hex(eligibleUsers),
      identitySnapshots: await sha256Hex(identitySnapshots),
      assetPreferenceSummaries: await sha256Hex(assetPreferenceSummaries),
    }
    const manifest = {
      version: "monthly-cycle-lock.v1",
      cycle: {
        cycle_id: cycle.id,
        cycle_key: cycle.cycle_key,
        year: cycle.year,
        month: cycle.month,
        period_start: cycle.period_start,
        period_end: cycle.period_end,
        status_before: cycle.status,
      },
      locked_at: lockedAt,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      override: {
        unresolved_onchain: Boolean(input.overrideUnresolvedOnchain),
        required_inputs: Boolean(input.overrideRequiredInputs),
        reason: input.overrideUnresolvedOnchain || input.overrideRequiredInputs ? overrideReason : null,
      },
      payments: payments.map((payment) => ({
        id: payment.id,
        project_id: payment.project_id,
        period_start: payment.period_start,
        period_end: payment.period_end,
        revenue: normalizeNumber(payment.revenue),
        payment_amount: normalizeNumber(payment.payment_amount),
        payment_percentage: normalizeNumber(payment.payment_percentage),
        confirmed_at: payment.confirmed_at,
        paid_at: payment.paid_at,
      })),
      reconciliation: onchainSubmissions
        .map((submission) => ({
          id: submission.id,
          payment_id: submission.payment_id,
          project_id: submission.project_id,
          tx_hash: submission.tx_hash,
          status: submission.status,
          confirmation_count: submission.confirmation_count,
          submitted_at: submission.submitted_at,
          confirmed_at: submission.confirmed_at,
          reconciled_at: submission.reconciled_at,
        }))
        .sort((a, b) => Number(a.id) - Number(b.id)),
      identity_snapshots: identitySnapshots,
      mvp_inputs: {
        contribution_submissions: contributionSubmissionInputs,
        attribution_datasets: attributionDatasetInputs,
        attribution_rows: attributionRowInputs,
        eligible_users: eligibleUsers,
        asset_preferences: assetPreferenceSummaries,
        counts: mvpCounts,
        checksums: mvpChecksums,
        required_input_blockers: requiredInputBlockers,
      },
      zkas_inputs: {
        datasets: datasets
          .map((dataset) => ({
            id: dataset.id,
            project_id: dataset.project_id,
            month: dataset.month,
            status: dataset.status,
            file_hash: dataset.file_hash,
            schema_version: dataset.schema_version,
            row_count: dataset.row_count,
            approved_at: dataset.approved_at,
            approved_by_user_id: dataset.approved_by_user_id,
          }))
          .sort((a, b) => Number(a.id) - Number(b.id)),
        identity_artifacts: identityArtifacts
          .map((artifact) => ({
            id: artifact.id,
            month: artifact.month,
            status: artifact.status,
            provider: artifact.provider,
            artifact_hash: artifact.artifact_hash,
            schema_version: artifact.schema_version,
            uploaded_by_user_id: artifact.uploaded_by_user_id,
            created_at: artifact.created_at,
          }))
          .sort((a, b) => Number(a.id) - Number(b.id)),
      },
      counts,
    }

    const lockedManifestHash = await sha256Hex(manifest)
    const { data: updatedCycle, error: updateError } = await supabase
      .from("monthly_cycles")
      .update({
        status: "locked",
        locked_at: lockedAt,
        locked_by_user_id: input.actorUserId,
        locked_manifest: manifest as unknown as Json,
        locked_manifest_hash: lockedManifestHash,
        lock_override_unresolved_onchain: Boolean(input.overrideUnresolvedOnchain),
        lock_override_reason: input.overrideUnresolvedOnchain || input.overrideRequiredInputs ? overrideReason : null,
        updated_by_user_id: input.actorUserId,
        status_note:
          input.overrideUnresolvedOnchain || input.overrideRequiredInputs
            ? "Locked with operator override."
            : "Locked into immutable manifest.",
      })
      .eq("id", cycle.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle()

    if (updateError) return failure("lock_failed", updateError.message)
    if (!updatedCycle) return failure("cycle_not_open", "Monthly cycle changed before the lock could be saved.")

    const successEventError = await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_success",
      outcome: "success",
      message: "Monthly cycle locked into immutable manifest.",
      metadata: {
        lockedManifestHash,
        counts,
        overrideApplied: Boolean(input.overrideUnresolvedOnchain || input.overrideRequiredInputs),
        requiredInputBlockers,
      },
    })
    if (successEventError) return failure("query_failed", successEventError.message)

    return success({
      cycleId: cycle.id,
      cycleKey: cycle.cycle_key,
      status: "locked",
      lockedAt,
      lockedManifestHash,
      counts,
      overrideApplied: Boolean(input.overrideUnresolvedOnchain || input.overrideRequiredInputs),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly-cycle lock failed."
    const eventError = await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "error",
      message,
    })
    if (eventError) return failure("query_failed", eventError.message)
    return failure("lock_failed", message)
  }
}
