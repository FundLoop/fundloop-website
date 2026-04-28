import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"

export type MonthlyCycleLockInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: "internal_admin" | "system"
  overrideUnresolvedOnchain?: boolean
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

const UNRESOLVED_ONCHAIN_STATUSES = new Set(["submitted", "confirming", "awaiting_confirmation", "pending"])

function success<T>(data: T): MonthlyCycleLockCommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): MonthlyCycleLockCommandResult<never> {
  return { ok: false, error: { code, message } }
}

function toDateOnly(value: string) {
  return value.slice(0, 10)
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function sortedUnique<T>(values: T[]) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)))
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
  await supabase.from("monthly_cycle_events").insert({
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
}

async function reattachCycleRows(supabase: SupabaseClient<Database>, cycle: CycleRow) {
  const paymentUpdate = await supabase
    .from("payments")
    .update({ monthly_cycle_id: cycle.id })
    .is("monthly_cycle_id", null)
    .gte("period_end", cycle.period_start)
    .lte("period_end", cycle.period_end)
  if (paymentUpdate.error) return paymentUpdate.error

  const submissionUpdate = await supabase
    .from("onchain_payment_submissions")
    .update({ monthly_cycle_id: cycle.id })
    .is("monthly_cycle_id", null)
    .gte("submitted_at", `${cycle.period_start}T00:00:00Z`)
    .lt("submitted_at", `${toDateOnly(new Date(new Date(cycle.period_end).getTime() + 86_400_000).toISOString())}T00:00:00Z`)
  if (submissionUpdate.error) return submissionUpdate.error

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
  if (input.overrideUnresolvedOnchain && !overrideReason) {
    return failure("override_reason_required", "Provide an override reason before locking with unresolved onchain submissions.")
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
    await insertCycleEvent(supabase, input, {
      cycleId: null,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle not found.",
    })
    return failure("cycle_not_found", "Monthly cycle not found.")
  }

  await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "lock_attempt",
    outcome: "attempt",
    message: "Monthly cycle lock attempt started.",
    metadata: {
      overrideUnresolvedOnchain: Boolean(input.overrideUnresolvedOnchain),
    },
  })

  if (cycle.status !== "open") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not open.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_open", "Only open monthly cycles can be locked.")
  }

  const attachError = await reattachCycleRows(supabase, cycle)
  if (attachError) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "error",
      message: attachError.message,
    })
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
      UNRESOLVED_ONCHAIN_STATUSES.has(String(submission.status ?? "")),
    )

    if (unresolvedSubmissions.length > 0 && !input.overrideUnresolvedOnchain) {
      await insertCycleEvent(supabase, input, {
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

    const projectIds = sortedUnique(
      [
        ...payments.map((payment) => payment.project_id).filter((id): id is number => Number.isInteger(id)),
        ...datasets.map((dataset) => dataset.project_id).filter((id): id is number => Number.isInteger(id)),
      ],
    )

    const participantsQuery =
      projectIds.length > 0
        ? await supabase.from("participants").select("project_id, user_id").in("project_id", projectIds)
        : { data: [], error: null }
    if (participantsQuery.error) return failure("query_failed", participantsQuery.error.message)
    const participants = asArray(participantsQuery.data as Array<{ project_id: number; user_id: string }> | null)
    const userIds = sortedUnique(participants.map((participant) => participant.user_id).filter(Boolean))

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

    const snapshotsQuery =
      userIds.length > 0
        ? await supabase
            .from("cubid_identity_snapshots")
            .select(
              "user_id, cubid_user_id, primary_name, primary_email, primary_phone, cubid_score, available_stamp_types, verified_stamp_types, last_synced_at",
            )
            .in("user_id", userIds)
        : { data: [], error: null }
    if (snapshotsQuery.error) return failure("query_failed", snapshotsQuery.error.message)
    const snapshots = asArray(snapshotsQuery.data as Array<Record<string, unknown>> | null)
    const snapshotsByUserId = new Map(snapshots.map((snapshot) => [String(snapshot.user_id), snapshot]))

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
      .sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)))

    const lockedAt = (deps.now?.() ?? new Date()).toISOString()
    const counts = {
      payments: payments.length,
      onchainSubmissions: onchainSubmissions.length,
      unresolvedOnchainSubmissions: unresolvedSubmissions.length,
      identitySnapshots: identitySnapshots.length,
      approvedDatasets: datasets.length,
      identityArtifacts: identityArtifacts.length,
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
        reason: input.overrideUnresolvedOnchain ? overrideReason : null,
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
        lock_override_reason: input.overrideUnresolvedOnchain ? overrideReason : null,
        updated_by_user_id: input.actorUserId,
        status_note: input.overrideUnresolvedOnchain ? "Locked with unresolved onchain override." : "Locked into immutable manifest.",
      })
      .eq("id", cycle.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle()

    if (updateError) return failure("lock_failed", updateError.message)
    if (!updatedCycle) return failure("cycle_not_open", "Monthly cycle changed before the lock could be saved.")

    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_success",
      outcome: "success",
      message: "Monthly cycle locked into immutable manifest.",
      metadata: {
        lockedManifestHash,
        counts,
        overrideApplied: Boolean(input.overrideUnresolvedOnchain),
      },
    })

    return success({
      cycleId: cycle.id,
      cycleKey: cycle.cycle_key,
      status: "locked",
      lockedAt,
      lockedManifestHash,
      counts,
      overrideApplied: Boolean(input.overrideUnresolvedOnchain),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly-cycle lock failed."
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "lock_failure",
      outcome: "failure",
      severity: "error",
      message,
    })
    return failure("lock_failed", message)
  }
}
