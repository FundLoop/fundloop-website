import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Database, Json } from "@/types/supabase"
import { assertMonthString } from "@/lib/zkas/month"
import { buildUserAssetPreferenceReadiness } from "@/lib/workspace/user-asset-preferences"
import { isUnresolvedOnchainSubmissionStatus } from "./monthly-cycle-statuses"

type CyclePrepRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  | "id"
  | "cycle_key"
  | "period_start"
  | "period_end"
  | "status"
  | "locked_at"
  | "locked_manifest"
  | "locked_manifest_hash"
  | "lock_override_unresolved_onchain"
  | "lock_override_reason"
  | "prep_started_at"
>

export type MonthlyCyclePrepPosture = "not_locked" | "blocked" | "needs_review" | "ready"
export type MonthlyCyclePrepSeverity = "blocker" | "warning" | "info"

export type MonthlyCyclePrepIssue = {
  code: string
  severity: MonthlyCyclePrepSeverity
  title: string
  description: string
  actionHref?: string
}

export type MonthlyCyclePrepManifestSummary = {
  lockedAt: string | null
  lockedManifestHash: string | null
  hashMatches: boolean | null
  overrideUnresolvedOnchain: boolean
  overrideReason: string | null
  counts: {
    payments: number
    onchainSubmissions: number
    unresolvedOnchainSubmissions: number
    identitySnapshots: number
    approvedDatasets: number
    identityArtifacts: number
  }
}

export type MonthlyCyclePrepContributionReadiness = {
  submittedCount: number
  expectedProjectCount: number
  missingProjectCount: number
  totalUsdEquivalentAmount: number
  totalCalculatedContributionAmount: number
  missingProjects: Array<{ id: number; slug: string | null; name: string }>
  readError: string | null
}

export type MonthlyCyclePrepAttributionDataset = {
  id: number
  projectId: number
  projectSlug: string | null
  projectName: string
  status: string
  rowCount: number
  totalAttributionPoints: number
  note: string | null
  submittedAt: string | null
  updatedAt: string
}

export type MonthlyCyclePrepAttributionReadiness = {
  totalCount: number
  draftCount: number
  submittedCount: number
  approvedCount: number
  rejectedCount: number
  reviewRequiredCount: number
  totalRowCount: number
  totalAttributionPoints: number
  datasets: MonthlyCyclePrepAttributionDataset[]
  readError: string | null
}

export type MonthlyCyclePrepAssetPreferenceReadiness = {
  eligibleUserCount: number
  customPreferenceUserCount: number
  defaultPreferenceUserCount: number
  rejectAllProjectTokenUserCount: number
  totalPreferenceRowCount: number
  usersRejectingProjectTokens: Array<{
    userId: string
    displayName: string | null
    email: string | null
  }>
  readError: string | null
}

export type MonthlyCyclePrepReview = {
  cycle: {
    id: number
    cycleKey: string
    periodStart: string
    periodEnd: string
    status: CyclePrepRow["status"]
    prepStartedAt: string | null
  }
  posture: MonthlyCyclePrepPosture
  postureLabel: string
  manifest: MonthlyCyclePrepManifestSummary
  contributionReadiness: MonthlyCyclePrepContributionReadiness
  attributionReadiness: MonthlyCyclePrepAttributionReadiness
  assetPreferenceReadiness: MonthlyCyclePrepAssetPreferenceReadiness
  issues: MonthlyCyclePrepIssue[]
  liveDriftWarnings: MonthlyCyclePrepIssue[]
}

export type EpochFinancialPrepReview = {
  summary: Database["public"]["Views"]["epoch_financial_prep_cycle_summary"]["Row"] | null
  sources: Database["public"]["Views"]["epoch_financial_prep_operator_view"]["Row"][]
  productionDisabled: boolean
}

export type EpochFundedAllocationReview = {
  allocation: Database["public"]["Views"]["epoch_allocation_operator_view"]["Row"] | null
  productionDisabled: boolean
  runtimeAvailable: boolean
}

export async function loadEpochFundedAllocationReview(cycleKey: string): Promise<EpochFundedAllocationReview> {
  const parsedCycleKey=assertMonthString(cycleKey)
  if ((process.env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").trim().toLowerCase()==="production") {
    return {allocation:null,productionDisabled:true,runtimeAvailable:false}
  }
  const supabase=getAdminSupabaseClient()
  const result=await supabase.from("epoch_allocation_operator_view").select("*").eq("cycle_key",parsedCycleKey).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return {allocation:result.data,productionDisabled:true,runtimeAvailable:true}
}

export async function loadEpochFinancialPrepReview(cycleKey: string): Promise<EpochFinancialPrepReview> {
  const parsedCycleKey=assertMonthString(cycleKey)
  if ((process.env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").trim().toLowerCase()==="production") {
    return {summary:null,sources:[],productionDisabled:true}
  }
  const supabase=getAdminSupabaseClient()
  const [summaryResult,sourcesResult]=await Promise.all([
    supabase.from("epoch_financial_prep_cycle_summary").select("*").eq("cycle_key",parsedCycleKey).maybeSingle(),
    supabase.from("epoch_financial_prep_operator_view").select("*").eq("cycle_key",parsedCycleKey).order("deterministic_source_order"),
  ])
  if (summaryResult.error) throw new Error(summaryResult.error.message)
  if (sourcesResult.error) throw new Error(sourcesResult.error.message)
  return {summary:summaryResult.data,sources:sourcesResult.data ?? [],productionDisabled:true}
}

type LockManifest = {
  locked_at?: unknown
  override?: {
    unresolved_onchain?: unknown
    reason?: unknown
  }
  counts?: Partial<MonthlyCyclePrepManifestSummary["counts"]>
  payments?: unknown[]
  reconciliation?: Array<{ status?: unknown }>
  identity_snapshots?: Array<{
    user_id?: unknown
    cubid_identity_status?: unknown
    primary_email?: unknown
    primary_phone?: unknown
    last_synced_at?: unknown
  }>
  zkas_inputs?: {
    datasets?: unknown[]
    identity_artifacts?: unknown[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function asLockManifest(value: Json | null): LockManifest | null {
  return isRecord(value) ? (value as LockManifest) : null
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

function countFromManifest(manifest: LockManifest | null, key: keyof MonthlyCyclePrepManifestSummary["counts"], fallback: number) {
  const value = manifest?.counts?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function addIssue(issues: MonthlyCyclePrepIssue[], issue: MonthlyCyclePrepIssue) {
  issues.push(issue)
}

function getPosture(issues: MonthlyCyclePrepIssue[], status: CyclePrepRow["status"]): MonthlyCyclePrepPosture {
  if (status === "open") return "not_locked"
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked"
  if (issues.some((issue) => issue.severity === "warning")) return "needs_review"
  return "ready"
}

function getPostureLabel(posture: MonthlyCyclePrepPosture) {
  if (posture === "not_locked") return "Not locked"
  if (posture === "blocked") return "Blocked"
  if (posture === "needs_review") return "Needs review"
  return "Ready"
}

export async function buildMonthlyCyclePrepReview(input: {
  cycle: CyclePrepRow
  computedManifestHash?: string | null
  liveCounts?: Partial<MonthlyCyclePrepManifestSummary["counts"]>
  contributionReadiness?: MonthlyCyclePrepContributionReadiness
  attributionReadiness?: MonthlyCyclePrepAttributionReadiness
  assetPreferenceReadiness?: MonthlyCyclePrepAssetPreferenceReadiness
}): Promise<MonthlyCyclePrepReview> {
  const manifest = asLockManifest(input.cycle.locked_manifest)
  const reconciliation = Array.isArray(manifest?.reconciliation) ? manifest.reconciliation : []
  const identitySnapshots = Array.isArray(manifest?.identity_snapshots) ? manifest.identity_snapshots : []
  const datasets = Array.isArray(manifest?.zkas_inputs?.datasets) ? manifest.zkas_inputs.datasets : []
  const identityArtifacts = Array.isArray(manifest?.zkas_inputs?.identity_artifacts) ? manifest.zkas_inputs.identity_artifacts : []
  const unresolvedOnchainCount = reconciliation.filter((submission) =>
    isUnresolvedOnchainSubmissionStatus(typeof submission.status === "string" ? submission.status : null),
  ).length
  const manifestCounts = {
    payments: countFromManifest(manifest, "payments", Array.isArray(manifest?.payments) ? manifest.payments.length : 0),
    onchainSubmissions: countFromManifest(manifest, "onchainSubmissions", reconciliation.length),
    unresolvedOnchainSubmissions: countFromManifest(manifest, "unresolvedOnchainSubmissions", unresolvedOnchainCount),
    identitySnapshots: countFromManifest(manifest, "identitySnapshots", identitySnapshots.length),
    approvedDatasets: countFromManifest(manifest, "approvedDatasets", datasets.length),
    identityArtifacts: countFromManifest(manifest, "identityArtifacts", identityArtifacts.length),
  }
  const overrideUnresolvedOnchain = Boolean(manifest?.override?.unresolved_onchain ?? input.cycle.lock_override_unresolved_onchain)
  const overrideReason =
    typeof manifest?.override?.reason === "string"
      ? manifest.override.reason
      : input.cycle.lock_override_reason
  const hashMatches =
    input.cycle.locked_manifest_hash && input.computedManifestHash
      ? input.cycle.locked_manifest_hash === input.computedManifestHash
      : null
  const issues: MonthlyCyclePrepIssue[] = []
  const contributionReadiness = input.contributionReadiness ?? {
    submittedCount: 0,
    expectedProjectCount: 0,
    missingProjectCount: 0,
    totalUsdEquivalentAmount: 0,
    totalCalculatedContributionAmount: 0,
    missingProjects: [],
    readError: null,
  }
  const attributionReadiness = input.attributionReadiness ?? {
    totalCount: 0,
    draftCount: 0,
    submittedCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    reviewRequiredCount: 0,
    totalRowCount: 0,
    totalAttributionPoints: 0,
    datasets: [],
    readError: null,
  }
  const assetPreferenceReadiness = input.assetPreferenceReadiness ?? {
    eligibleUserCount: 0,
    customPreferenceUserCount: 0,
    defaultPreferenceUserCount: 0,
    rejectAllProjectTokenUserCount: 0,
    totalPreferenceRowCount: 0,
    usersRejectingProjectTokens: [],
    readError: null,
  }

  if (input.cycle.status === "open") {
    addIssue(issues, {
      code: "cycle_not_locked",
      severity: "blocker",
      title: "Cycle is not locked",
      description: "Prep can only review a frozen lock manifest. Lock this cycle before preparing it for calculation.",
    })
  }

  if (!manifest) {
    addIssue(issues, {
      code: "manifest_missing",
      severity: "blocker",
      title: "Lock manifest is missing",
      description: "This cycle has no immutable manifest to prepare. Re-run or investigate the lock step before calculation.",
    })
  }

  if (hashMatches === false) {
    addIssue(issues, {
      code: "manifest_hash_mismatch",
      severity: "blocker",
      title: "Lock manifest hash mismatch",
      description: "The stored lock manifest no longer matches its recorded hash. Treat this cycle as unsafe until the drift is investigated.",
    })
  }

  if (manifest && manifestCounts.payments === 0) {
    addIssue(issues, {
      code: "no_confirmed_payments",
      severity: "warning",
      title: "No confirmed contribution inputs",
      description: "The locked manifest contains no confirmed project contribution payments. This may be valid for a quiet month, but should be reviewed.",
      actionHref: "/admin/payments",
    })
  }

  if (contributionReadiness.readError) {
    addIssue(issues, {
      code: "contribution_submission_read_failed",
      severity: "warning",
      title: "Contribution submission readiness unavailable",
      description: contributionReadiness.readError,
      actionHref: "/admin/cycles",
    })
  } else if (contributionReadiness.missingProjectCount > 0) {
    addIssue(issues, {
      code: "missing_contribution_submissions",
      severity: "warning",
      title: "Missing project contribution submissions",
      description: `${contributionReadiness.missingProjectCount} committed project(s) have not submitted monthly contribution data for this cycle yet.`,
      actionHref: "/admin/cycles",
    })
  }

  if (attributionReadiness.readError) {
    addIssue(issues, {
      code: "attribution_dataset_read_failed",
      severity: "warning",
      title: "Attribution dataset readiness unavailable",
      description: attributionReadiness.readError,
      actionHref: "/admin/cycles",
    })
  } else if (attributionReadiness.reviewRequiredCount > 0) {
    addIssue(issues, {
      code: "attribution_datasets_need_review",
      severity: "warning",
      title: "Attribution datasets need operator review",
      description: `${attributionReadiness.reviewRequiredCount} submitted MVP attribution dataset(s) are waiting for approval or rejection.`,
      actionHref: `/admin/cycles/${input.cycle.cycle_key}/prep`,
    })
  } else if (input.cycle.status !== "open" && attributionReadiness.approvedCount === 0) {
    addIssue(issues, {
      code: "missing_approved_attribution_datasets",
      severity: "warning",
      title: "No approved MVP attribution datasets",
      description: "No scoped-CUBID MVP attribution datasets have been approved for this cycle yet.",
      actionHref: `/admin/cycles/${input.cycle.cycle_key}/prep`,
    })
  }

  if (assetPreferenceReadiness.readError) {
    addIssue(issues, {
      code: "asset_preference_read_failed",
      severity: "warning",
      title: "Asset preference readiness unavailable",
      description: assetPreferenceReadiness.readError,
      actionHref: "/admin/cycles",
    })
  } else if (assetPreferenceReadiness.defaultPreferenceUserCount > 0) {
    addIssue(issues, {
      code: "asset_preferences_using_defaults",
      severity: "info",
      title: "Some users are using default asset priorities",
      description: `${assetPreferenceReadiness.defaultPreferenceUserCount} cycle participant(s) have not set custom asset priorities. This does not block MVP credits, but future settlement planning should treat them as stablecoin, fiat, then project-token preference users.`,
      actionHref: "/admin/cycles",
    })
  }

  if (!assetPreferenceReadiness.readError && assetPreferenceReadiness.rejectAllProjectTokenUserCount > 0) {
    addIssue(issues, {
      code: "project_token_preferences_rejected",
      severity: "info",
      title: "Some users reject project tokens",
      description: `${assetPreferenceReadiness.rejectAllProjectTokenUserCount} cycle participant(s) reject all project-token settlement options. This does not block MVP credits, but it should be visible before settlement planning.`,
      actionHref: "/admin/cycles",
    })
  }

  if (manifest && manifestCounts.unresolvedOnchainSubmissions > 0) {
    addIssue(issues, {
      code: "unresolved_onchain_submissions",
      severity: overrideUnresolvedOnchain ? "warning" : "blocker",
      title: "Unresolved onchain submissions",
      description: overrideUnresolvedOnchain
        ? `The cycle was locked with an unresolved-onchain override. Reason: ${overrideReason || "No reason recorded."}`
        : "The locked manifest still contains unresolved onchain submissions. Reconcile them before calculation.",
      actionHref: "/admin/payments/reconciliation",
    })
  }

  if (manifest && manifestCounts.approvedDatasets === 0) {
    addIssue(issues, {
      code: "missing_approved_datasets",
      severity: "blocker",
      title: "No approved attribution datasets",
      description: "Calculation needs approved project attribution data for the locked cycle.",
      actionHref: "/admin/zkas/uploads",
    })
  }

  if (manifest && manifestCounts.identityArtifacts === 0) {
    addIssue(issues, {
      code: "missing_identity_artifacts",
      severity: "blocker",
      title: "No approved identity artifacts",
      description: "Calculation needs an approved identity artifact reference for the locked cycle.",
      actionHref: "/admin/zkas/uploads",
    })
  }

  if (manifest && manifestCounts.identitySnapshots === 0) {
    addIssue(issues, {
      code: "missing_identity_snapshots",
      severity: "blocker",
      title: "No participant identity snapshots",
      description: "The locked manifest has no CUBID-backed participant identity snapshots.",
      actionHref: "/admin/identity",
    })
  }

  for (const snapshot of identitySnapshots) {
    const status = typeof snapshot.cubid_identity_status === "string" ? snapshot.cubid_identity_status : null
    if (status !== "linked" && status !== "verified") {
      addIssue(issues, {
        code: "identity_not_linked",
        severity: "blocker",
        title: "Participant identity is not linked",
        description: `User ${String(snapshot.user_id ?? "unknown")} is missing a linked or verified CUBID state in the lock manifest.`,
        actionHref: "/admin/identity",
      })
    }

    if (!snapshot.primary_email) {
      addIssue(issues, {
        code: "identity_email_missing",
        severity: "warning",
        title: "Participant identity email missing",
        description: `User ${String(snapshot.user_id ?? "unknown")} has no primary email in the CUBID snapshot captured at lock.`,
        actionHref: "/admin/identity",
      })
    }

    if (!snapshot.last_synced_at) {
      addIssue(issues, {
        code: "identity_sync_missing",
        severity: "warning",
        title: "Participant identity sync timestamp missing",
        description: `User ${String(snapshot.user_id ?? "unknown")} has no CUBID snapshot sync timestamp in the lock manifest.`,
        actionHref: "/admin/identity",
      })
    }
  }

  const liveDriftWarnings: MonthlyCyclePrepIssue[] = []
  for (const [key, liveCount] of Object.entries(input.liveCounts ?? {}) as Array<
    [keyof MonthlyCyclePrepManifestSummary["counts"], number | undefined]
  >) {
    if (typeof liveCount === "number" && liveCount !== manifestCounts[key]) {
      liveDriftWarnings.push({
        code: `live_drift_${key}`,
        severity: "info",
        title: "Live rows differ from locked manifest",
        description: `${key} is ${liveCount} in live linked rows but ${manifestCounts[key]} in the immutable lock manifest. Calculation should use the manifest.`,
      })
    }
  }

  const posture = getPosture(issues, input.cycle.status)

  return {
    cycle: {
      id: input.cycle.id,
      cycleKey: input.cycle.cycle_key,
      periodStart: input.cycle.period_start,
      periodEnd: input.cycle.period_end,
      status: input.cycle.status,
      prepStartedAt: input.cycle.prep_started_at,
    },
    posture,
    postureLabel: getPostureLabel(posture),
    manifest: {
      lockedAt: typeof manifest?.locked_at === "string" ? manifest.locked_at : input.cycle.locked_at,
      lockedManifestHash: input.cycle.locked_manifest_hash,
      hashMatches,
      overrideUnresolvedOnchain,
      overrideReason,
      counts: manifestCounts,
    },
    contributionReadiness,
    attributionReadiness,
    assetPreferenceReadiness,
    issues,
    liveDriftWarnings,
  }
}

async function countLiveRows(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
  table: keyof Database["public"]["Tables"],
  cycleId: number,
  statuses?: string[],
) {
  let query = supabase
    .from(table as never)
    .select("*", { count: "exact", head: true })
    .eq("monthly_cycle_id", cycleId)

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function loadContributionReadiness(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
  cycleId: number,
): Promise<MonthlyCyclePrepContributionReadiness> {
  const [projectsResult, submissionsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, name, status, payment_percentage")
      .is("deleted_at", null)
      .gt("payment_percentage", 0),
    supabase
      .from("project_monthly_contribution_submissions")
      .select("project_id, usd_equivalent_amount, calculated_contribution_amount, status")
      .eq("monthly_cycle_id", cycleId),
  ])

  if (projectsResult.error) {
    throw new Error(projectsResult.error.message)
  }

  if (submissionsResult.error) {
    throw new Error(submissionsResult.error.message)
  }

  const expectedProjects = (projectsResult.data ?? []).filter((project) => project.status !== "deleted")
  const submittedRows = (submissionsResult.data ?? []).filter((submission) => submission.status === "submitted")
  const submittedProjectIds = new Set(submittedRows.map((submission) => submission.project_id))
  const missingProjects = expectedProjects
    .filter((project) => !submittedProjectIds.has(project.id))
    .map((project) => ({ id: project.id, slug: project.slug, name: project.name }))

  return {
    submittedCount: submittedRows.length,
    expectedProjectCount: expectedProjects.length,
    missingProjectCount: missingProjects.length,
    totalUsdEquivalentAmount: submittedRows.reduce((sum, submission) => sum + Number(submission.usd_equivalent_amount ?? 0), 0),
    totalCalculatedContributionAmount: submittedRows.reduce(
      (sum, submission) => sum + Number(submission.calculated_contribution_amount ?? 0),
      0,
    ),
    missingProjects,
    readError: null,
  }
}

async function loadAttributionReadiness(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
  cycleId: number,
): Promise<MonthlyCyclePrepAttributionReadiness> {
  const { data, error } = await supabase
    .from("project_attribution_datasets")
    .select("id, project_id, monthly_cycle_id, status, row_count, total_attribution_points, note, submitted_at, updated_at, projects(id, slug, name)")
    .eq("monthly_cycle_id", cycleId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const datasets = (data ?? []).map((dataset) => {
    const project = Array.isArray(dataset.projects) ? dataset.projects[0] : dataset.projects
    return {
      id: Number(dataset.id),
      projectId: Number(dataset.project_id),
      projectSlug: project?.slug ?? null,
      projectName: project?.name ?? `Project ${dataset.project_id}`,
      status: String(dataset.status),
      rowCount: Number(dataset.row_count ?? 0),
      totalAttributionPoints: Number(dataset.total_attribution_points ?? 0),
      note: dataset.note ?? null,
      submittedAt: dataset.submitted_at ?? null,
      updatedAt: dataset.updated_at,
    }
  })

  return {
    totalCount: datasets.length,
    draftCount: datasets.filter((dataset) => dataset.status === "draft").length,
    submittedCount: datasets.filter((dataset) => dataset.status === "submitted").length,
    approvedCount: datasets.filter((dataset) => dataset.status === "approved").length,
    rejectedCount: datasets.filter((dataset) => dataset.status === "rejected").length,
    reviewRequiredCount: datasets.filter((dataset) => dataset.status === "submitted").length,
    totalRowCount: datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0),
    totalAttributionPoints: datasets.reduce((sum, dataset) => sum + dataset.totalAttributionPoints, 0),
    datasets,
    readError: null,
  }
}

async function loadAssetPreferenceReadiness(
  supabase: ReturnType<typeof getAdminSupabaseClient>,
): Promise<MonthlyCyclePrepAssetPreferenceReadiness> {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, status, payment_percentage")
    .is("deleted_at", null)
    .gt("payment_percentage", 0)

  if (projectsError) {
    throw new Error(projectsError.message)
  }

  const projectIds = (projects ?? [])
    .filter((project) => project.status !== "deleted")
    .map((project) => Number(project.id))

  if (projectIds.length === 0) {
    return {
      eligibleUserCount: 0,
      customPreferenceUserCount: 0,
      defaultPreferenceUserCount: 0,
      rejectAllProjectTokenUserCount: 0,
      totalPreferenceRowCount: 0,
      usersRejectingProjectTokens: [],
      readError: null,
    }
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("user_id")
    .in("project_id", projectIds)

  if (participantsError) {
    throw new Error(participantsError.message)
  }

  const userIds = Array.from(
    new Set((participants ?? []).map((participant) => participant.user_id).filter((userId): userId is string => Boolean(userId))),
  )

  if (userIds.length === 0) {
    return {
      eligibleUserCount: 0,
      customPreferenceUserCount: 0,
      defaultPreferenceUserCount: 0,
      rejectAllProjectTokenUserCount: 0,
      totalPreferenceRowCount: 0,
      usersRejectingProjectTokens: [],
      readError: null,
    }
  }

  const [usersResult, preferencesResult] = await Promise.all([
    supabase
      .from("users")
      .select("user_id, display_name, full_name, email, status")
      .in("user_id", userIds)
      .eq("status", "active"),
    supabase
      .from("user_asset_preferences")
      .select("id, user_id, rank, asset_type, asset_code, project_id, accepted")
      .in("user_id", userIds)
      .order("rank", { ascending: true }),
  ])

  if (usersResult.error) {
    throw new Error(usersResult.error.message)
  }

  if (preferencesResult.error) {
    throw new Error(preferencesResult.error.message)
  }

  const activeUsers = (usersResult.data ?? []).map((user) => ({
    userId: user.user_id,
    displayName: user.display_name ?? user.full_name ?? null,
    email: user.email ?? null,
  }))
  const preferencesByUserId = new Map<string, NonNullable<typeof preferencesResult.data>>()

  for (const preference of preferencesResult.data ?? []) {
    const existing = preferencesByUserId.get(preference.user_id) ?? []
    existing.push(preference)
    preferencesByUserId.set(preference.user_id, existing)
  }

  const readinessByUser = activeUsers.map((user) => ({
    user,
    readiness: buildUserAssetPreferenceReadiness({
      userId: user.userId,
      rows: (preferencesByUserId.get(user.userId) ?? []).map((preference) => ({
        id: preference.id,
        rank: preference.rank,
        asset_type: preference.asset_type,
        asset_code: preference.asset_code,
        project_id: preference.project_id,
        accepted: preference.accepted,
      })),
    }),
  }))
  const usersRejectingProjectTokens = readinessByUser
    .filter((entry) => entry.readiness.rejectsAllProjectTokens)
    .map((entry) => entry.user)

  return {
    eligibleUserCount: activeUsers.length,
    customPreferenceUserCount: readinessByUser.filter((entry) => entry.readiness.hasCustomPreferences).length,
    defaultPreferenceUserCount: readinessByUser.filter((entry) => !entry.readiness.hasCustomPreferences).length,
    rejectAllProjectTokenUserCount: usersRejectingProjectTokens.length,
    totalPreferenceRowCount: (preferencesResult.data ?? []).length,
    usersRejectingProjectTokens,
    readError: null,
  }
}

export async function loadMonthlyCyclePrepReview(cycleKey: string): Promise<MonthlyCyclePrepReview | null> {
  const parsedCycleKey = assertMonthString(cycleKey)
  const supabase = getAdminSupabaseClient()
  const { data: cycle, error } = await supabase
    .from("monthly_cycles")
    .select(
      "id, cycle_key, period_start, period_end, status, locked_at, locked_manifest, locked_manifest_hash, lock_override_unresolved_onchain, lock_override_reason, prep_started_at",
    )
    .eq("cycle_key", parsedCycleKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!cycle) {
    return null
  }

  const computedManifestHash = cycle.locked_manifest ? await sha256Hex(cycle.locked_manifest) : null
  const [
    payments,
    onchainSubmissions,
    approvedDatasets,
    identityArtifacts,
    contributionReadinessResult,
    attributionReadinessResult,
    assetPreferenceReadinessResult,
  ] = await Promise.allSettled([
    countLiveRows(supabase, "payments", cycle.id),
    countLiveRows(supabase, "onchain_payment_submissions", cycle.id),
    countLiveRows(supabase, "zkas_datasets", cycle.id, ["approved", "included"]),
    countLiveRows(supabase, "zkas_identity_artifacts", cycle.id, ["approved"]),
    loadContributionReadiness(supabase, cycle.id),
    loadAttributionReadiness(supabase, cycle.id),
    loadAssetPreferenceReadiness(supabase),
  ])
  const readCount = (result: PromiseSettledResult<number>) => {
    if (result.status === "rejected") {
      throw result.reason
    }

    return result.value
  }
  const contributionReadiness =
    contributionReadinessResult.status === "fulfilled"
      ? contributionReadinessResult.value
      : {
          submittedCount: 0,
          expectedProjectCount: 0,
          missingProjectCount: 0,
          totalUsdEquivalentAmount: 0,
          totalCalculatedContributionAmount: 0,
          missingProjects: [],
          readError:
            contributionReadinessResult.reason instanceof Error
              ? contributionReadinessResult.reason.message
              : "Contribution submission readiness could not be loaded.",
        }
  const attributionReadiness =
    attributionReadinessResult.status === "fulfilled"
      ? attributionReadinessResult.value
      : {
          totalCount: 0,
          draftCount: 0,
          submittedCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          reviewRequiredCount: 0,
          totalRowCount: 0,
          totalAttributionPoints: 0,
          datasets: [],
          readError:
            attributionReadinessResult.reason instanceof Error
              ? attributionReadinessResult.reason.message
              : "Attribution dataset readiness could not be loaded.",
        }
  const assetPreferenceReadiness =
    assetPreferenceReadinessResult.status === "fulfilled"
      ? assetPreferenceReadinessResult.value
      : {
          eligibleUserCount: 0,
          customPreferenceUserCount: 0,
          defaultPreferenceUserCount: 0,
          rejectAllProjectTokenUserCount: 0,
          totalPreferenceRowCount: 0,
          usersRejectingProjectTokens: [],
          readError:
            assetPreferenceReadinessResult.reason instanceof Error
              ? assetPreferenceReadinessResult.reason.message
              : "Asset preference readiness could not be loaded.",
        }

  return buildMonthlyCyclePrepReview({
    cycle,
    computedManifestHash,
    liveCounts: {
      payments: readCount(payments),
      onchainSubmissions: readCount(onchainSubmissions),
      approvedDatasets: readCount(approvedDatasets),
      identityArtifacts: readCount(identityArtifacts),
    },
    contributionReadiness,
    attributionReadiness,
    assetPreferenceReadiness,
  })
}
