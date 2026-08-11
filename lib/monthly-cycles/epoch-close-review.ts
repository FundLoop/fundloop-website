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
  policy_key: string | null
  cap_multiple: string | number | null
  current_funded_minor: string | number | null
  harvested_unclaimed_minor: string | number | null
  carry_in_minor: string | number | null
}

export type EpochCloseUserRow = {
  cycleKey: string
  rootHash: string
  status: string
  initialClaimMinor: string
  topUpMinor: string
  finalAwardMinor: string
  redistributionCeilingMinor: string
  capMultiple: string
  harvestedUnclaimedMinor: string
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
  capMultiple: string
  harvestedUnclaimedMinor: string
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
    admin.from("epoch_close_packages").select("*").eq("approval_id", control.data.approval_id).eq("status", "payout_readying").maybeSingle(),
  ])
  if (cycle.error) throw new Error(cycle.error.message)
  if (approval.error) throw new Error(approval.error.message)
  if (!approval.data) return null
  const controlRow = control.data as typeof control.data & {
    initial_claim_minor?: string | number | null
    redistribution_ceiling_minor?: string | number | null
    cap_multiple?: string | number | null
  }
  const closeRow = approval.data as typeof approval.data & { harvested_unclaimed_minor?: string | number | null }
  return {
    cycleKey: cycle.data.cycle_key, rootHash: closeRow.root_hash, status: closeRow.status,
    initialClaimMinor: String(controlRow.initial_claim_minor ?? controlRow.retained_initial_minor),
    topUpMinor: String(controlRow.redistribution_top_up_minor), finalAwardMinor: String(controlRow.final_award_minor),
    redistributionCeilingMinor: String(controlRow.redistribution_ceiling_minor ?? controlRow.minor_unit_cap),
    capMultiple: Number(controlRow.cap_multiple ?? 3).toFixed(2),
    harvestedUnclaimedMinor: String(closeRow.harvested_unclaimed_minor ?? 0),
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
    admin.from("epoch_close_packages").select("root_hash,status").eq("approval_id", summary.data.approval_id).eq("status", "payout_readying").maybeSingle(),
  ])
  if (cycle.error) throw new Error(cycle.error.message)
  if (close.error) throw new Error(close.error.message)
  if (!close.data) return null
  const summaryRow = summary.data as typeof summary.data & {
    cap_multiple?: string | number | null
    harvested_unclaimed_minor?: string | number | null
  }
  return {
    cycleKey: cycle.data.cycle_key, rootHash: close.data.root_hash, status: close.data.status,
    fundedMinor: String(summaryRow.funded_minor), cohortCount: summaryRow.cohort_count,
    theoreticalShareExactUsd: String(summaryRow.theoretical_share_exact_usd), initialClaimExactUsd: String(summaryRow.initial_claim_exact_usd),
    scorePoolContributionExactUsd: String(summaryRow.score_pool_contribution_exact_usd), sourceCount: summaryRow.source_count,
    capMultiple: Number(summaryRow.cap_multiple ?? 3).toFixed(2),
    harvestedUnclaimedMinor: String(summaryRow.harvested_unclaimed_minor ?? 0),
  }
}

export async function loadPublicProjectEpochClose(projectSlug: string): Promise<{
  cycle_key: string | null; project_slug: string | null; root_hash: string | null; status: string | null
  funded_minor: string | number | null; published_cohort_count: number | null; source_count: number | null
  cap_multiple: string | number | null; harvested_unclaimed_minor: string | number | null; created_at: string | null
} | null> {
  if (!enabled()) return null
  const result = await getAdminSupabaseClient().from("epoch_close_public_project_view").select("*").eq("project_slug", projectSlug)
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return result.data as unknown as Awaited<ReturnType<typeof loadPublicProjectEpochClose>>
}
