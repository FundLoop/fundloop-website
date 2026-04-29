import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Database, Json } from "@/types/supabase"
import { assertMonthString } from "@/lib/zkas/month"
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
  issues: MonthlyCyclePrepIssue[]
  liveDriftWarnings: MonthlyCyclePrepIssue[]
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
  const [payments, onchainSubmissions, approvedDatasets, identityArtifacts] = await Promise.all([
    countLiveRows(supabase, "payments", cycle.id),
    countLiveRows(supabase, "onchain_payment_submissions", cycle.id),
    countLiveRows(supabase, "zkas_datasets", cycle.id, ["approved", "included"]),
    countLiveRows(supabase, "zkas_identity_artifacts", cycle.id, ["approved"]),
  ])

  return buildMonthlyCyclePrepReview({
    cycle,
    computedManifestHash,
    liveCounts: {
      payments,
      onchainSubmissions,
      approvedDatasets,
      identityArtifacts,
    },
  })
}
