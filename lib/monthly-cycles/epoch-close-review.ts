import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"

export type EpochCloseOperatorRow = {
  cycle_key: string | null
  close_package_id: number | null
  status: string | null
  root_hash: string | null
  manifest_hash: string | null
  result_hash: string | null
  user_count: number | null
  funded_minor: string | number | null
  final_allocation_minor: string | number | null
  redistribution_pool_minor: string | number | null
  top_up_minor: string | number | null
  returned_residue_minor: string | number | null
  artifact_count: number | null
}

export type EpochCloseUserRow = {
  cycleKey: string
  rootHash: string
  status: string
  retainedInitialMinor: string
  topUpMinor: string
  finalAwardMinor: string
  minorUnitCap: string
  payableStatus: string
  ownershipStatus: string
  assetEligibilityStatus: string
}

export type EpochCloseProjectRow = {
  cycleKey: string
  rootHash: string
  status: string
  fundedMinor: string
  cohortCount: number
  theoreticalShareExactUsd: string
  initialClaimExactUsd: string
  scorePoolContributionExactUsd: string
  sourceCount: number
}

function enabled() {
  return ["local", "development", "dev", "preview", "test"].includes((process.env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").trim().toLowerCase())
}

export async function loadEpochCloseOperator(cycleKey: string): Promise<EpochCloseOperatorRow | null> {
  if (!enabled()) return null
  const result = await getAdminSupabaseClient().from("epoch_close_operator_view").select("*").eq("cycle_key", cycleKey).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return result.data as EpochCloseOperatorRow | null
}

export async function loadLatestUserEpochClose(userId: string): Promise<EpochCloseUserRow | null> {
  if (!enabled()) return null
  const admin = getAdminSupabaseClient()
  const control = await admin.from("epoch_provisional_award_controls").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (control.error) throw new Error(control.error.message)
  if (!control.data) return null
  const [cycle, approval] = await Promise.all([
    admin.from("monthly_cycles").select("cycle_key").eq("id", control.data.monthly_cycle_id).single(),
    admin.from("epoch_close_packages").select("root_hash,status").eq("approval_id", control.data.approval_id).single(),
  ])
  if (cycle.error) throw new Error(cycle.error.message)
  if (approval.error) throw new Error(approval.error.message)
  return {
    cycleKey: cycle.data.cycle_key, rootHash: approval.data.root_hash, status: approval.data.status,
    retainedInitialMinor: String(control.data.retained_initial_minor), topUpMinor: String(control.data.redistribution_top_up_minor),
    finalAwardMinor: String(control.data.final_award_minor), minorUnitCap: String(control.data.minor_unit_cap),
    payableStatus: control.data.payable_status, ownershipStatus: control.data.ownership_status,
    assetEligibilityStatus: control.data.asset_eligibility_status,
  }
}

export async function loadLatestProjectEpochClose(projectId: number): Promise<EpochCloseProjectRow | null> {
  if (!enabled()) return null
  const admin = getAdminSupabaseClient()
  const summary = await admin.from("epoch_close_project_summaries").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (summary.error) throw new Error(summary.error.message)
  if (!summary.data) return null
  const [cycle, close] = await Promise.all([
    admin.from("monthly_cycles").select("cycle_key").eq("id", summary.data.monthly_cycle_id).single(),
    admin.from("epoch_close_packages").select("root_hash,status").eq("approval_id", summary.data.approval_id).single(),
  ])
  if (cycle.error) throw new Error(cycle.error.message)
  if (close.error) throw new Error(close.error.message)
  return {
    cycleKey: cycle.data.cycle_key, rootHash: close.data.root_hash, status: close.data.status,
    fundedMinor: String(summary.data.funded_minor), cohortCount: summary.data.cohort_count,
    theoreticalShareExactUsd: String(summary.data.theoretical_share_exact_usd), initialClaimExactUsd: String(summary.data.initial_claim_exact_usd),
    scorePoolContributionExactUsd: String(summary.data.score_pool_contribution_exact_usd), sourceCount: summary.data.source_count,
  }
}

export async function loadPublicProjectEpochClose(projectSlug: string) {
  if (!enabled()) return null
  const result = await getAdminSupabaseClient().from("epoch_close_public_project_view").select("*").eq("project_slug", projectSlug)
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return result.data
}
