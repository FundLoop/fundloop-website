import type { SupabaseClient } from "@supabase/supabase-js"
import { buildZkasRunArtifactPath, STORAGE_BUCKETS } from "../storage/artifacts.ts"
import type { Database, Json } from "../../types/supabase.ts"

const ZKAS_RUN_BUCKET = STORAGE_BUCKETS.zkasRuns
const ZKAS_SCHEMA_VERSION = "zkas.v1"

export type MonthlyCycleCalculationPackageInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: "internal_admin" | "system"
}

export type MonthlyCycleCalculationPackageOutput = {
  cycleId: number
  cycleKey: string
  status: "calculation"
  calculationStartedAt: string
  runId: number
  runStatus: "locked"
  packageArtifactPath: string
  packageArtifactHash: string
  runManifestHash: string
  counts: {
    datasets: number
    payments: number
    identityArtifacts: number
  }
}

type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
type CommandDeps = {
  now?: () => Date
}

type CycleRow = Database["public"]["Tables"]["monthly_cycles"]["Row"]
type DatasetRow = Pick<
  Database["public"]["Tables"]["zkas_datasets"]["Row"],
  "id" | "project_id" | "month" | "format" | "object_path" | "file_hash" | "row_count" | "status"
>
type IdentityArtifactRow = Pick<
  Database["public"]["Tables"]["zkas_identity_artifacts"]["Row"],
  "id" | "month" | "object_path" | "artifact_hash" | "schema_version" | "status"
>
type PaymentRow = {
  id: number
  project_id: number
  payment_amount: number
  period_end: string
}
type ExistingRunRow = Pick<
  Database["public"]["Tables"]["zkas_runs"]["Row"],
  "id" | "status" | "locked_at" | "locked_manifest" | "locked_manifest_hash" | "month"
>

type CalculationPackageManifest = {
  version: "monthly-cycle-calculation-package.v1"
  cycle: {
    id: number
    cycle_key: string
    period_start: string
    period_end: string
    locked_manifest_hash: string
  }
  source: {
    locked_at: string
    lock_manifest_hash: string
  }
  allocation_policy: "proportional_pool"
  schema_version: string
  datasets: Array<{
    dataset_id: number
    project_id: number
    format: string
    object_path: string
    file_hash: string
    row_count: number
  }>
  payments: Array<{
    payment_id: number
    project_id: number
    amount_usd: number
    period_end: string
  }>
  identity_artifact: {
    artifact_id: number
    object_path: string
    artifact_hash: string
    schema_version: string
  }
  counts: {
    datasets: number
    payments: number
    identityArtifacts: number
  }
}

function success<T>(data: T): CommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): CommandResult<never> {
  return { ok: false, error: { code, message } }
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function compareStableStrings(a: string, b: string) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
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
  const content = typeof value === "string" ? value : stableStringify(value)
  const bytes = new TextEncoder().encode(content)
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function insertCycleEvent(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleCalculationPackageInput,
  params: {
    cycleId: number | null
    eventType: "calculation_package_attempt" | "calculation_package_success" | "calculation_package_failure"
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

function buildPackageManifest(input: {
  cycle: CycleRow
  datasets: DatasetRow[]
  identityArtifact: IdentityArtifactRow
  payments: PaymentRow[]
}): CalculationPackageManifest {
  const datasets = [...input.datasets].sort((left, right) => left.project_id - right.project_id || left.id - right.id)
  const payments = [...input.payments].sort(
    (left, right) =>
      left.project_id - right.project_id ||
      compareStableStrings(left.period_end, right.period_end) ||
      left.id - right.id,
  )

  return {
    version: "monthly-cycle-calculation-package.v1",
    cycle: {
      id: input.cycle.id,
      cycle_key: input.cycle.cycle_key,
      period_start: input.cycle.period_start,
      period_end: input.cycle.period_end,
      locked_manifest_hash: input.cycle.locked_manifest_hash ?? "",
    },
    source: {
      locked_at: input.cycle.locked_at ?? "",
      lock_manifest_hash: input.cycle.locked_manifest_hash ?? "",
    },
    allocation_policy: "proportional_pool",
    schema_version: ZKAS_SCHEMA_VERSION,
    datasets: datasets.map((dataset) => ({
      dataset_id: dataset.id,
      project_id: dataset.project_id,
      format: dataset.format,
      object_path: dataset.object_path,
      file_hash: dataset.file_hash,
      row_count: dataset.row_count,
    })),
    payments: payments.map((payment) => ({
      payment_id: payment.id,
      project_id: payment.project_id,
      amount_usd: Number(payment.payment_amount),
      period_end: payment.period_end,
    })),
    identity_artifact: {
      artifact_id: input.identityArtifact.id,
      object_path: input.identityArtifact.object_path,
      artifact_hash: input.identityArtifact.artifact_hash,
      schema_version: input.identityArtifact.schema_version,
    },
    counts: {
      datasets: datasets.length,
      payments: payments.length,
      identityArtifacts: 1,
    },
  }
}

function buildRunManifest(input: {
  packageManifest: CalculationPackageManifest
  runId: number
  gitRef: string
  packageArtifactHash: string
}) {
  return {
    version: "run-manifest.v1" as const,
    run_id: input.runId,
    month: input.packageManifest.cycle.cycle_key,
    usd_pool: input.packageManifest.payments.reduce((sum, payment) => sum + payment.amount_usd, 0),
    allocation_policy: "proportional_pool" as const,
    engine_bundle: {
      git_ref: input.gitRef,
      image_ref: "zkas/local",
      config_version: "local-v1",
    },
    schema_version: input.packageManifest.schema_version,
    package_artifact_hash: input.packageArtifactHash,
    datasets: input.packageManifest.datasets.map((dataset) => ({
      dataset_id: dataset.dataset_id,
      project_id: dataset.project_id,
      format: dataset.format,
      object_path: dataset.object_path,
      file_hash: dataset.file_hash,
      row_count: dataset.row_count,
    })),
    payments: input.packageManifest.payments,
    identity_artifact: input.packageManifest.identity_artifact,
  }
}

async function uploadTextArtifact(
  supabase: SupabaseClient<Database>,
  path: string,
  content: string,
) {
  const { error } = await supabase.storage.from(ZKAS_RUN_BUCKET).upload(path, new Blob([content], { type: "application/json" }), {
    cacheControl: "3600",
    contentType: "application/json",
    upsert: true,
  })

  return error
}

function readPackageArtifactHashFromRun(run: ExistingRunRow) {
  const manifest = run.locked_manifest
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ""
  const hash = (manifest as { package_artifact_hash?: unknown }).package_artifact_hash
  return typeof hash === "string" ? hash : ""
}

async function markRunFailedAfterPackagingError(
  supabase: SupabaseClient<Database>,
  runId: number,
  message: string,
) {
  await supabase
    .from("zkas_runs")
    .update({
      status: "failed",
      note: message,
    })
    .eq("id", runId)
}

export async function executeMonthlyCycleCalculationPackageCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleCalculationPackageInput,
  deps: CommandDeps = {},
): Promise<CommandResult<MonthlyCycleCalculationPackageOutput>> {
  const now = deps.now?.() ?? new Date()
  const calculationStartedAt = now.toISOString()
  const gitRef = typeof process !== "undefined" ? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local-dev" : "local-dev"

  const { data: cycle, error: cycleError } = await supabase.from("monthly_cycles").select("*").eq("cycle_key", input.cycleKey).maybeSingle()
  if (cycleError) return failure("query_failed", cycleError.message)

  if (!cycle) {
    const notFoundEventError = await insertCycleEvent(supabase, input, {
      cycleId: null,
      eventType: "calculation_package_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle not found.",
    })
    if (notFoundEventError) return failure("query_failed", notFoundEventError.message)
    return failure("cycle_not_found", "Monthly cycle not found.")
  }

  const attemptEventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "calculation_package_attempt",
    outcome: "attempt",
    message: "Monthly cycle calculation packaging started.",
  })
  if (attemptEventError) return failure("query_failed", attemptEventError.message)

  if (cycle.status !== "locked" && cycle.status !== "prep" && cycle.status !== "calculation") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "calculation_package_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not ready for calculation packaging.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_ready", "Only locked, prep, or calculation cycles can be packaged.")
  }

  if (!cycle.locked_at || !cycle.locked_manifest || !cycle.locked_manifest_hash) {
    return failure("cycle_not_locked", "Cycle must have a locked manifest before calculation packaging.")
  }

  const { data: existingRuns, error: existingRunsError } = await supabase
    .from("zkas_runs")
    .select("id, month, status, locked_at, locked_manifest, locked_manifest_hash")
    .eq("monthly_cycle_id", cycle.id)
    .neq("status", "failed")
    .order("id", { ascending: true })

  if (existingRunsError) return failure("query_failed", existingRunsError.message)

  const existingPackage = asArray(existingRuns as ExistingRunRow[] | null).find((run) => run.locked_at && run.locked_manifest_hash)
  if (existingPackage) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "calculation_package_success",
      outcome: "success",
      message: "Existing calculation package returned.",
      metadata: { runId: existingPackage.id, alreadyPackaged: true },
    })

    return success({
      cycleId: cycle.id,
      cycleKey: cycle.cycle_key,
      status: "calculation",
      calculationStartedAt: cycle.calculation_started_at ?? calculationStartedAt,
      runId: existingPackage.id,
      runStatus: "locked",
      packageArtifactPath: buildZkasRunArtifactPath({
        cycleKey: cycle.cycle_key,
        cycleId: cycle.id,
        artifact: "calculation-package",
      }),
      packageArtifactHash: readPackageArtifactHashFromRun(existingPackage),
      runManifestHash: existingPackage.locked_manifest_hash ?? "",
      counts: {
        datasets: 0,
        payments: 0,
        identityArtifacts: 0,
      },
    })
  }

  if (asArray(existingRuns).length > 0) {
    return failure("calculation_run_exists", "A non-packaged zkAS run already exists for this cycle. Resolve it before packaging.")
  }

  const [{ data: datasets, error: datasetsError }, { data: artifacts, error: artifactsError }, { data: confirmedStatus, error: statusError }] =
    await Promise.all([
      supabase
        .from("zkas_datasets")
        .select("id, project_id, month, format, object_path, file_hash, row_count, status")
        .eq("monthly_cycle_id", cycle.id)
        .in("status", ["approved", "included"]),
      supabase
        .from("zkas_identity_artifacts")
        .select("id, month, object_path, artifact_hash, schema_version, status")
        .eq("monthly_cycle_id", cycle.id)
        .eq("status", "approved"),
      supabase.from("ref_payment_statuses").select("id").eq("code", "confirmed").single(),
    ])

  if (datasetsError) return failure("query_failed", datasetsError.message)
  if (artifactsError) return failure("query_failed", artifactsError.message)
  if (statusError || !confirmedStatus) return failure("reference_data_missing", statusError?.message ?? "Confirmed status missing.")

  const approvedDatasets = asArray(datasets as DatasetRow[] | null)
  const approvedArtifacts = asArray(artifacts as IdentityArtifactRow[] | null)
  if (approvedDatasets.length === 0) return failure("missing_approved_datasets", "No approved attribution datasets are linked to this cycle.")
  if (approvedArtifacts.length === 0) return failure("missing_identity_artifact", "No approved identity artifact is linked to this cycle.")
  if (approvedArtifacts.length > 1) return failure("ambiguous_identity_artifacts", "Exactly one approved identity artifact must be linked to this cycle.")

  const projects = new Set<number>()
  for (const dataset of approvedDatasets) {
    if (projects.has(dataset.project_id)) {
      return failure("duplicate_project_dataset", "Only one approved dataset per project can be packaged for a cycle.")
    }
    projects.add(dataset.project_id)
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, project_id, payment_amount, period_end")
    .eq("monthly_cycle_id", cycle.id)
    .eq("status_id", confirmedStatus.id)
    .order("period_end", { ascending: true })
    .order("id", { ascending: true })

  if (paymentsError) return failure("query_failed", paymentsError.message)

  const paymentRows = asArray(payments as PaymentRow[] | null)
  const packageManifest = buildPackageManifest({
    cycle,
    datasets: approvedDatasets,
    identityArtifact: approvedArtifacts[0],
    payments: paymentRows,
  })
  const packageArtifactPath = buildZkasRunArtifactPath({
    cycleKey: cycle.cycle_key,
    cycleId: cycle.id,
    artifact: "calculation-package",
  })
  const packageText = `${stableStringify(packageManifest)}\n`
  const packageArtifactHash = await sha256Hex(packageText)

  const { data: run, error: runError } = await supabase
    .from("zkas_runs")
    .insert({
      month: cycle.cycle_key,
      monthly_cycle_id: cycle.id,
      status: "locked",
      locked_at: calculationStartedAt,
      usd_pool: packageManifest.payments.reduce((sum, payment) => sum + payment.amount_usd, 0),
      identity_artifact_id: packageManifest.identity_artifact.artifact_id,
      engine_git_ref: gitRef,
      engine_image_ref: "zkas/local",
      engine_config_version: "local-v1",
      schema_version: ZKAS_SCHEMA_VERSION,
      created_by_user_id: input.actorUserId,
    })
    .select("id")
    .single()

  if (runError || !run) return failure("package_failed", runError?.message ?? "Could not create zkAS run package.")

  const runManifest = buildRunManifest({
    packageManifest,
    runId: run.id,
    gitRef,
    packageArtifactHash,
  })
  const runManifestText = `${stableStringify(runManifest)}\n`
  const runManifestHash = await sha256Hex(runManifestText)
  const runManifestPath = buildZkasRunArtifactPath({
    cycleKey: cycle.cycle_key,
    runId: run.id,
    artifact: "run-manifest",
  })

  const uploadPackageError = await uploadTextArtifact(supabase, packageArtifactPath, packageText)
  if (uploadPackageError) {
    await markRunFailedAfterPackagingError(supabase, run.id, uploadPackageError.message)
    return failure("artifact_upload_failed", uploadPackageError.message)
  }

  const uploadRunManifestError = await uploadTextArtifact(supabase, runManifestPath, runManifestText)
  if (uploadRunManifestError) {
    await markRunFailedAfterPackagingError(supabase, run.id, uploadRunManifestError.message)
    return failure("artifact_upload_failed", uploadRunManifestError.message)
  }

  const runDatasetsPayload = packageManifest.datasets.map((dataset) => ({
    run_id: run.id,
    dataset_id: dataset.dataset_id,
    project_id: dataset.project_id,
    object_path: dataset.object_path,
    file_hash: dataset.file_hash,
    row_count: dataset.row_count,
  }))
  const runPaymentsPayload = packageManifest.payments.map((payment) => ({
    run_id: run.id,
    monthly_cycle_id: cycle.id,
    payment_id: payment.payment_id,
    project_id: payment.project_id,
    amount_usd: payment.amount_usd,
    period_end: payment.period_end,
  }))

  if (runDatasetsPayload.length > 0) {
    const { error } = await supabase.from("zkas_run_datasets").insert(runDatasetsPayload)
    if (error) {
      await markRunFailedAfterPackagingError(supabase, run.id, error.message)
      return failure("package_failed", error.message)
    }
  }

  if (runPaymentsPayload.length > 0) {
    const { error } = await supabase.from("zkas_run_payments").insert(runPaymentsPayload)
    if (error) {
      await markRunFailedAfterPackagingError(supabase, run.id, error.message)
      return failure("package_failed", error.message)
    }
  }

  const [{ error: datasetUpdateError }, { error: runUpdateError }, { data: updatedCycle, error: cycleUpdateError }] = await Promise.all([
    supabase.from("zkas_datasets").update({ status: "included" }).in(
      "id",
      packageManifest.datasets.map((dataset) => dataset.dataset_id),
    ),
    supabase
      .from("zkas_runs")
      .update({
        locked_manifest: runManifest as unknown as Json,
        locked_manifest_hash: runManifestHash,
      })
      .eq("id", run.id),
    supabase
      .from("monthly_cycles")
      .update({
        status: "calculation",
        calculation_started_at: calculationStartedAt,
        updated_by_user_id: input.actorUserId,
      })
      .eq("id", cycle.id)
      .in("status", ["locked", "prep", "calculation"])
      .select("id")
      .maybeSingle(),
  ])

  if (datasetUpdateError) {
    await markRunFailedAfterPackagingError(supabase, run.id, datasetUpdateError.message)
    return failure("package_failed", datasetUpdateError.message)
  }
  if (runUpdateError) {
    await markRunFailedAfterPackagingError(supabase, run.id, runUpdateError.message)
    return failure("package_failed", runUpdateError.message)
  }
  if (cycleUpdateError) {
    await markRunFailedAfterPackagingError(supabase, run.id, cycleUpdateError.message)
    return failure("package_failed", cycleUpdateError.message)
  }
  if (!updatedCycle) {
    await markRunFailedAfterPackagingError(supabase, run.id, "Cycle changed state before calculation packaging could complete.")
    return failure("cycle_not_ready", "Cycle changed state before calculation packaging could complete.")
  }

  const successEventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "calculation_package_success",
    outcome: "success",
    message: "Monthly cycle calculation package created.",
    metadata: {
      runId: run.id,
      packageArtifactPath,
      packageArtifactHash,
      runManifestHash,
      counts: packageManifest.counts,
    },
  })
  if (successEventError) return failure("query_failed", successEventError.message)

  return success({
    cycleId: cycle.id,
    cycleKey: cycle.cycle_key,
    status: "calculation",
    calculationStartedAt,
    runId: run.id,
    runStatus: "locked",
    packageArtifactPath,
    packageArtifactHash,
    runManifestHash,
    counts: packageManifest.counts,
  })
}
