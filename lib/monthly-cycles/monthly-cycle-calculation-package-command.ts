import type { SupabaseClient } from "@supabase/supabase-js"
import { buildZkasRunArtifactPath, STORAGE_BUCKETS } from "../storage/artifacts.ts"
import type { Database, Json } from "../../types/supabase.ts"
import {
  buildMvpContributionPoolsFromLockManifest,
  calculateMvpDistribution,
  MVP_ALLOCATION_POLICY,
  type MvpAssetPreferenceInput,
  type MvpAttributionRowInput,
  type MvpDistributionResult,
  type MvpEligibleUserInput,
} from "./mvp-distribution-calculator.ts"

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
  runStatus: "locked" | "completed"
  packageArtifactPath: string
  packageArtifactHash: string
  resultArtifactPath: string
  resultArtifactHash: string
  runManifestHash: string
  counts: {
    datasets: number
    payments: number
    identityArtifacts: number
    resultRows: number
    projectResults: number
    assetFills: number
    returnedPools: number
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
  | "id"
  | "status"
  | "locked_at"
  | "locked_manifest"
  | "locked_manifest_hash"
  | "month"
  | "result_artifact_path"
  | "result_artifact_hash"
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
  allocation_policy: typeof MVP_ALLOCATION_POLICY
  schema_version: string
  mvp_allocation: {
    policy: typeof MVP_ALLOCATION_POLICY
    result_hash: string
    totals: MvpDistributionResult["totals"]
    warnings: number
    excludedRows: number
    returnedPools: number
  }
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
  mvpDistribution: MvpDistributionResult
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
    allocation_policy: MVP_ALLOCATION_POLICY,
    schema_version: ZKAS_SCHEMA_VERSION,
    mvp_allocation: {
      policy: MVP_ALLOCATION_POLICY,
      result_hash: input.mvpDistribution.resultHash,
      totals: input.mvpDistribution.totals,
      warnings: input.mvpDistribution.warnings.length,
      excludedRows: input.mvpDistribution.excludedRows.length,
      returnedPools: input.mvpDistribution.returnedPools.length,
    },
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
    usd_pool: input.packageManifest.mvp_allocation.totals.poolUsd,
    allocation_policy: MVP_ALLOCATION_POLICY,
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

function readArrayFromManifest(manifest: unknown, key: string) {
  const record = manifest && typeof manifest === "object" && !Array.isArray(manifest) ? (manifest as Record<string, unknown>) : {}
  const mvpInputs =
    record.mvp_inputs && typeof record.mvp_inputs === "object" && !Array.isArray(record.mvp_inputs)
      ? (record.mvp_inputs as Record<string, unknown>)
      : {}
  const value = mvpInputs[key]
  return Array.isArray(value) ? value : []
}

function buildMvpAttributionRowsFromLockManifest(manifest: unknown): MvpAttributionRowInput[] {
  return readArrayFromManifest(manifest, "attribution_rows").map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    return {
      id: typeof row.id === "string" || typeof row.id === "number" ? row.id : "",
      datasetId: typeof row.dataset_id === "string" || typeof row.dataset_id === "number" ? row.dataset_id : "",
      projectId: Number(row.project_id),
      userId: typeof row.user_id === "string" ? row.user_id : null,
      scopedCubidId: typeof row.scoped_cubid_id === "string" ? row.scoped_cubid_id : null,
      attributionPoints: Number(row.attribution_points ?? 0),
      resolutionStatus: typeof row.resolution_status === "string" ? row.resolution_status : null,
    }
  })
}

function buildMvpEligibleUsersFromLockManifest(manifest: unknown): MvpEligibleUserInput[] {
  return readArrayFromManifest(manifest, "eligible_users").map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    return {
      userId: String(row.user_id ?? ""),
      cubidId: typeof row.cubid_id === "string" ? row.cubid_id : null,
      cubidIdentityStatus: typeof row.cubid_identity_status === "string" ? row.cubid_identity_status : null,
      isEligible: typeof row.is_eligible === "boolean" ? row.is_eligible : undefined,
    }
  }).filter((user) => user.userId)
}

function buildMvpAssetPreferencesFromLockManifest(manifest: unknown): MvpAssetPreferenceInput[] {
  return readArrayFromManifest(manifest, "asset_preferences").flatMap((item) => {
    const summary = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    const userId = typeof summary.user_id === "string" ? summary.user_id : ""
    const preferences = Array.isArray(summary.preferences) ? summary.preferences : []
    return preferences.map((preference) => {
      const row = preference && typeof preference === "object" ? (preference as Record<string, unknown>) : {}
      return {
        userId,
        rank: Number(row.rank ?? 0),
        assetType: String(row.asset_type ?? "fiat") as MvpAssetPreferenceInput["assetType"],
        assetCode: String(row.asset_code ?? "USD"),
        projectId: row.project_id === null || row.project_id === undefined ? null : Number(row.project_id),
        accepted: row.accepted === true,
      }
    })
  }).filter((preference) => preference.userId && preference.rank > 0)
}

function buildMvpDistributionInputFromLockManifest(cycle: CycleRow) {
  return {
    cycleKey: cycle.cycle_key,
    lockedManifestHash: cycle.locked_manifest_hash,
    priceSnapshotId: `monthly-cycle:${cycle.cycle_key}:locked-manifest`,
    contributionPools: buildMvpContributionPoolsFromLockManifest(cycle.locked_manifest),
    attributionRows: buildMvpAttributionRowsFromLockManifest(cycle.locked_manifest),
    eligibleUsers: buildMvpEligibleUsersFromLockManifest(cycle.locked_manifest),
    assetPreferences: buildMvpAssetPreferencesFromLockManifest(cycle.locked_manifest),
  }
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

async function buildResultRowPayload(input: {
  distribution: MvpDistributionResult
  cycleId: number
  runId: number
}) {
  return Promise.all(
    input.distribution.userAllocations.map(async (allocation) => {
      const rawRows = input.distribution.rawEntitlements.filter((row) => row.userId === allocation.userId)
      const aggregateScore = rawRows.reduce((sum, row) => sum + row.attributionPoints, 0)
      const payload = {
        run_id: input.runId,
        monthly_cycle_id: input.cycleId,
        zkas_user_id: allocation.userId,
        eligibility: true,
        aggregate_score: aggregateScore,
        allocation_usd: allocation.roundedFinalUsd,
        app_count: rawRows.length,
        project_count: new Set(rawRows.map((row) => row.projectId)).size,
      }
      return {
        ...payload,
        output_row_hash: await sha256Hex(payload),
      }
    }),
  )
}

function buildProjectResultPayload(input: {
  distribution: MvpDistributionResult
  cycleId: number
  runId: number
}) {
  return input.distribution.rawEntitlements.map((row) => ({
    monthly_cycle_id: input.cycleId,
    run_id: input.runId,
    project_id: row.projectId,
    user_id: row.userId,
    scoped_cubid_id: row.scopedCubidId,
    attribution_points: row.attributionPoints,
    total_project_points: row.totalProjectPoints,
    project_pool_usd: row.projectPoolUsd,
    raw_usd: row.rawUsd,
  }))
}

function buildAssetFillPayload(input: {
  distribution: MvpDistributionResult
  cycleId: number
  runId: number
}) {
  return input.distribution.assetFills.map((fill) => ({
    monthly_cycle_id: input.cycleId,
    run_id: input.runId,
    user_id: fill.userId,
    pool_id: String(fill.poolId),
    project_id: fill.projectId,
    asset_type: fill.assetType,
    asset_code: fill.assetCode,
    source_amount: fill.sourceAmount,
    usd_value: fill.usdValue,
    preference_rank: fill.preferenceRank,
    partial: fill.partial,
  }))
}

function buildReturnedPoolPayload(input: {
  distribution: MvpDistributionResult
  cycleId: number
  runId: number
}) {
  return input.distribution.returnedPools.map((row) => ({
    monthly_cycle_id: input.cycleId,
    run_id: input.runId,
    pool_id: String(row.poolId),
    project_id: row.projectId,
    asset_type: row.assetType,
    asset_code: row.assetCode,
    source_amount: row.sourceAmount,
    usd_value: row.usdValue,
    reason_code: row.reasonCode,
  }))
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

  const fundedSources = await supabase
    .from("epoch_valuation_source_lots")
    .select("id")
    .eq("monthly_cycle_id", cycle.id)
    .in("state", ["ready_for_lock", "reserved"])
  if (fundedSources.error) return failure("query_failed", fundedSources.error.message)
  if (asArray(fundedSources.data).length > 0) {
    return failure(
      "settled_allocation_required",
      "Journal-backed epoch sources must use the settled Cubid redistribution command; the legacy point-based calculator is compatibility-only.",
    )
  }

  if (!cycle.locked_at || !cycle.locked_manifest || !cycle.locked_manifest_hash) {
    return failure("cycle_not_locked", "Cycle must have a locked manifest before calculation packaging.")
  }

  const { data: existingRuns, error: existingRunsError } = await supabase
    .from("zkas_runs")
    .select("id, month, status, locked_at, locked_manifest, locked_manifest_hash, result_artifact_path, result_artifact_hash")
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
      runStatus: existingPackage.status === "completed" ? "completed" : "locked",
      packageArtifactPath: buildZkasRunArtifactPath({
        cycleKey: cycle.cycle_key,
        cycleId: cycle.id,
        artifact: "calculation-package",
      }),
      packageArtifactHash: readPackageArtifactHashFromRun(existingPackage),
      resultArtifactPath: existingPackage.result_artifact_path ?? "",
      resultArtifactHash: existingPackage.result_artifact_hash ?? "",
      runManifestHash: existingPackage.locked_manifest_hash ?? "",
      counts: {
        datasets: 0,
        payments: 0,
        identityArtifacts: 0,
        resultRows: 0,
        projectResults: 0,
        assetFills: 0,
        returnedPools: 0,
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
  const mvpDistribution = await calculateMvpDistribution(buildMvpDistributionInputFromLockManifest(cycle))
  const packageManifest = buildPackageManifest({
    cycle,
    datasets: approvedDatasets,
    identityArtifact: approvedArtifacts[0],
    payments: paymentRows,
    mvpDistribution,
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
      usd_pool: mvpDistribution.totals.poolUsd,
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
  const resultArtifactPath = buildZkasRunArtifactPath({
    cycleKey: cycle.cycle_key,
    runId: run.id,
    artifact: "run-result",
  })
  const resultArtifactText = `${stableStringify(mvpDistribution)}\n`
  const resultArtifactHash = await sha256Hex(resultArtifactText)

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

  const uploadResultError = await uploadTextArtifact(supabase, resultArtifactPath, resultArtifactText)
  if (uploadResultError) {
    await markRunFailedAfterPackagingError(supabase, run.id, uploadResultError.message)
    return failure("artifact_upload_failed", uploadResultError.message)
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
  const resultRowsPayload = await buildResultRowPayload({ distribution: mvpDistribution, cycleId: cycle.id, runId: run.id })
  const projectResultsPayload = buildProjectResultPayload({ distribution: mvpDistribution, cycleId: cycle.id, runId: run.id })
  const assetFillsPayload = buildAssetFillPayload({ distribution: mvpDistribution, cycleId: cycle.id, runId: run.id })
  const returnedPoolsPayload = buildReturnedPoolPayload({ distribution: mvpDistribution, cycleId: cycle.id, runId: run.id })

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

  if (resultRowsPayload.length > 0) {
    const { error } = await supabase.from("zkas_run_results").insert(resultRowsPayload)
    if (error) {
      await markRunFailedAfterPackagingError(supabase, run.id, error.message)
      return failure("package_failed", error.message)
    }
  }

  if (projectResultsPayload.length > 0) {
    const { error } = await supabase.from("monthly_cycle_allocation_project_results").insert(projectResultsPayload)
    if (error) {
      await markRunFailedAfterPackagingError(supabase, run.id, error.message)
      return failure("package_failed", error.message)
    }
  }

  if (assetFillsPayload.length > 0) {
    const { error } = await supabase.from("monthly_cycle_allocation_asset_fills").insert(assetFillsPayload)
    if (error) {
      await markRunFailedAfterPackagingError(supabase, run.id, error.message)
      return failure("package_failed", error.message)
    }
  }

  if (returnedPoolsPayload.length > 0) {
    const { error } = await supabase.from("monthly_cycle_allocation_returned_pools").insert(returnedPoolsPayload)
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
        status: "completed",
        locked_manifest: runManifest as unknown as Json,
        locked_manifest_hash: runManifestHash,
        result_artifact_path: resultArtifactPath,
        result_artifact_hash: resultArtifactHash,
        total_score: mvpDistribution.rawEntitlements.reduce((sum, row) => sum + row.attributionPoints, 0),
        total_allocated_usd: mvpDistribution.totals.allocatedUsd,
        user_count: mvpDistribution.userAllocations.length,
        finalized_at: calculationStartedAt,
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
      resultArtifactPath,
      resultArtifactHash,
      runManifestHash,
      counts: packageManifest.counts,
      resultCounts: {
        resultRows: resultRowsPayload.length,
        projectResults: projectResultsPayload.length,
        assetFills: assetFillsPayload.length,
        returnedPools: returnedPoolsPayload.length,
      },
    },
  })
  if (successEventError) return failure("query_failed", successEventError.message)

  return success({
    cycleId: cycle.id,
    cycleKey: cycle.cycle_key,
    status: "calculation",
    calculationStartedAt,
    runId: run.id,
    runStatus: "completed",
    packageArtifactPath,
    packageArtifactHash,
    resultArtifactPath,
    resultArtifactHash,
    runManifestHash,
    counts: {
      ...packageManifest.counts,
      resultRows: resultRowsPayload.length,
      projectResults: projectResultsPayload.length,
      assetFills: assetFillsPayload.length,
      returnedPools: returnedPoolsPayload.length,
    },
  })
}
