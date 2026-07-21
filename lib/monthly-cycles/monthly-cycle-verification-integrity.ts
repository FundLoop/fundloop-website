import type { Json } from "../../types/supabase.ts"

export type MonthlyCycleVerificationIntegrityIssue = {
  code: string
  severity: "blocker" | "warning" | "info"
  title: string
  description: string
  actionHref?: string
}

type ManifestRecord = Record<string, unknown>

type IntegrityCycle = {
  cycle_key: string
  locked_manifest?: Json | null
  locked_manifest_hash?: string | null
}

type IntegrityRun = {
  id: number
  total_allocated_usd: number | null
  result_artifact_path?: string | null
  result_artifact_hash?: string | null
}

type IntegrityResult = {
  zkas_user_id: string
  allocation_usd: number | null
  eligibility: boolean
}

type IntegrityProjectResult = {
  project_id: number
  user_id: string
  scoped_cubid_id: string | null
  attribution_points: number | null
  total_project_points: number | null
  project_pool_usd: number | null
  raw_usd: number | null
}

type IntegrityAssetFill = {
  user_id: string
  project_id: number
  asset_type: string
  asset_code: string
  usd_value: number | null
  preference_rank: number | null
}

type IntegrityReturnedPool = {
  project_id: number
  asset_type: string
  asset_code: string
  usd_value: number | null
}

function issue(
  code: string,
  severity: MonthlyCycleVerificationIntegrityIssue["severity"],
  title: string,
  description: string,
): MonthlyCycleVerificationIntegrityIssue {
  return { code, severity, title, description }
}

function asRecord(value: unknown): ManifestRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ManifestRecord) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function sumNumbers<T>(rows: T[], selector: (row: T) => unknown) {
  return rows.reduce((sum, row) => sum + numberValue(selector(row)), 0)
}

function inferAssetType(assetCode: string) {
  const code = assetCode.toUpperCase()
  if (["USDC", "USDT", "DAI"].includes(code)) return "stablecoin"
  if (["USD", "CAD", "EUR", "GBP"].includes(code)) return "fiat"
  return "project_token"
}

function manifestMvpInputs(manifest: unknown) {
  return asRecord(asRecord(manifest).mvp_inputs)
}

function contributionPoolUsd(row: unknown) {
  const record = asRecord(row)
  const sourceCurrency = String(record.source_currency_code ?? "USD").toUpperCase()
  const calculatedContributionAmount = numberValue(record.calculated_contribution_amount)
  if (sourceCurrency === "USD") return calculatedContributionAmount
  return numberValue(record.usd_equivalent_amount) * (numberValue(record.commitment_percentage) / 100)
}

function contributionKey(row: unknown) {
  const record = asRecord(row)
  const assetCode = String(record.source_currency_code ?? "USD").toUpperCase()
  return `${Number(record.project_id)}:${inferAssetType(assetCode)}:${assetCode}`
}

function assetKey(row: { project_id: number; asset_type: string; asset_code: string }) {
  return `${Number(row.project_id)}:${row.asset_type}:${row.asset_code.toUpperCase()}`
}

function userResultMap(results: IntegrityResult[]) {
  return new Map(results.map((row) => [row.zkas_user_id, numberValue(row.allocation_usd)]))
}

function baselinesByUser(projectResults: IntegrityProjectResult[]) {
  const baselines = new Map<string, number>()
  for (const row of projectResults) {
    const rawUsd = numberValue(row.raw_usd)
    baselines.set(row.user_id, Math.max(baselines.get(row.user_id) ?? 0, rawUsd))
  }
  return baselines
}

export function buildMonthlyCycleVerificationIntegrityIssues(input: {
  cycle: IntegrityCycle
  latestCompletedRun: IntegrityRun | null
  results: IntegrityResult[]
  projectResults: IntegrityProjectResult[]
  assetFills: IntegrityAssetFill[]
  returnedPools: IntegrityReturnedPool[]
}): MonthlyCycleVerificationIntegrityIssue[] {
  const issues: MonthlyCycleVerificationIntegrityIssue[] = []
  const manifest = asRecord(input.cycle.locked_manifest)
  const mvpInputs = manifestMvpInputs(manifest)
  const contributionSubmissions = asArray(mvpInputs.contribution_submissions)
  const attributionDatasets = asArray(mvpInputs.attribution_datasets)
  const attributionRows = asArray(mvpInputs.attribution_rows)
  const eligibleUsers = asArray(mvpInputs.eligible_users)

  if (!input.cycle.locked_manifest_hash || Object.keys(manifest).length === 0) {
    issues.push(
      issue(
        "locked_manifest_missing",
        "blocker",
        "Locked manifest missing",
        "Cycle verification requires the immutable lock manifest and hash used by calculation packaging.",
      ),
    )
  }

  if (!input.latestCompletedRun?.result_artifact_hash || !input.latestCompletedRun?.result_artifact_path) {
    issues.push(
      issue(
        "result_artifact_missing",
        "blocker",
        "Result artifact missing",
        "The completed calculation run must include both result artifact path and hash before verification.",
      ),
    )
  }

  if (contributionSubmissions.length === 0) {
    issues.push(
      issue(
        "contribution_inputs_missing",
        "blocker",
        "Contribution inputs missing",
        "The locked manifest must include submitted project contribution inputs for the MVP calculation.",
      ),
    )
  }
  if (contributionSubmissions.some((row) => contributionPoolUsd(row) < 0 || numberValue(asRecord(row).source_amount) < 0)) {
    issues.push(
      issue("negative_contribution_input", "blocker", "Negative contribution input", "Contribution input amounts must be non-negative."),
    )
  }

  if (attributionDatasets.length === 0) {
    issues.push(
      issue(
        "approved_attribution_missing",
        "blocker",
        "Approved attribution missing",
        "The locked manifest must include approved project attribution datasets for calculation.",
      ),
    )
  }
  if (attributionDatasets.some((row) => !["approved", "included"].includes(String(asRecord(row).status ?? "")))) {
    issues.push(
      issue(
        "unapproved_attribution_dataset",
        "blocker",
        "Unapproved attribution dataset",
        "Only approved or already-included attribution datasets may be part of verified MVP results.",
      ),
    )
  }
  if (attributionRows.length === 0) {
    issues.push(
      issue(
        "attribution_rows_missing",
        "blocker",
        "Attribution rows missing",
        "Approved attribution datasets must include scoped CUBID attribution rows before verification.",
      ),
    )
  }
  if (
    attributionRows.some((row) => {
      const record = asRecord(row)
      return !record.scoped_cubid_id || !record.user_id || record.resolution_status !== "resolved" || numberValue(record.attribution_points) < 0
    })
  ) {
    issues.push(
      issue(
        "invalid_attribution_rows",
        "blocker",
        "Invalid attribution rows",
        "Every included attribution row must resolve to a FundLoop user, include scoped CUBID identity, and have non-negative points.",
      ),
    )
  }
  if (
    eligibleUsers.some((row) => {
      const record = asRecord(row)
      return record.is_eligible !== true || !["linked", "verified"].includes(String(record.cubid_identity_status ?? ""))
    })
  ) {
    issues.push(
      issue(
        "ineligible_user_in_manifest",
        "blocker",
        "Ineligible user in manifest",
        "Users included in the calculation manifest must be CUBID linked or verified at lock time.",
      ),
    )
  }

  if (input.results.some((row) => numberValue(row.allocation_usd) < 0 || (row.eligibility === false && numberValue(row.allocation_usd) > 0))) {
    issues.push(
      issue(
        "invalid_user_result_amount",
        "blocker",
        "Invalid user result amount",
        "User result rows must be non-negative and ineligible rows cannot receive allocation.",
      ),
    )
  }
  if (
    input.projectResults.some(
      (row) =>
        !row.scoped_cubid_id ||
        numberValue(row.attribution_points) < 0 ||
        numberValue(row.total_project_points) < 0 ||
        numberValue(row.project_pool_usd) < 0 ||
        numberValue(row.raw_usd) < 0,
    )
  ) {
    issues.push(
      issue(
        "invalid_project_result_amount",
        "blocker",
        "Invalid project result amount",
        "Project attribution output rows must include scoped CUBID identity and non-negative point/pool amounts.",
      ),
    )
  }
  if (input.assetFills.some((row) => numberValue(row.usd_value) < 0 || numberValue(row.preference_rank) < 1)) {
    issues.push(
      issue(
        "invalid_asset_fill",
        "blocker",
        "Invalid asset fill",
        "Selected asset fills must be non-negative and reference a positive accepted preference rank.",
      ),
    )
  }
  if (input.returnedPools.some((row) => numberValue(row.usd_value) < 0)) {
    issues.push(
      issue(
        "invalid_returned_pool",
        "blocker",
        "Invalid returned pool",
        "Returned future-pool rows must remain separate from user credits and must be non-negative.",
      ),
    )
  }

  const baselines = baselinesByUser(input.projectResults)
  const resultUsdByUser = userResultMap(input.results)
  for (const [userId, allocatedUsd] of resultUsdByUser) {
    const baseline = baselines.get(userId) ?? 0
    if (baseline <= 0 && allocatedUsd > 0) {
      issues.push(
        issue(
          "allocation_without_baseline",
          "blocker",
          "Allocation without baseline",
          `User ${userId} has allocation output but no raw project entitlement baseline.`,
        ),
      )
    }
    if (baseline > 0 && allocatedUsd - baseline * 3 > 0.01) {
      issues.push(
        issue(
          "cap_multiple_exceeded",
          "blocker",
          "Allocation cap exceeded",
          `User ${userId} exceeds the MVP 3x baseline cap.`,
        ),
      )
    }
  }

  const poolUsd = roundUsd(sumNumbers(contributionSubmissions, contributionPoolUsd))
  const resultUsd = roundUsd(sumNumbers(input.results, (row) => row.allocation_usd))
  const returnedUsd = roundUsd(sumNumbers(input.returnedPools, (row) => row.usd_value))
  const runUsd = roundUsd(numberValue(input.latestCompletedRun?.total_allocated_usd))
  if (input.latestCompletedRun && Math.abs(resultUsd - runUsd) > 0.01) {
    issues.push(
      issue(
        "allocation_total_mismatch",
        "blocker",
        "Allocation totals do not match",
        `Result rows total ${resultUsd.toFixed(2)} but the completed run reports ${runUsd.toFixed(2)}.`,
      ),
    )
  }
  if (contributionSubmissions.length > 0 && Math.abs(roundUsd(resultUsd + returnedUsd) - poolUsd) > 0.01) {
    issues.push(
      issue(
        "pool_reconciliation_mismatch",
        "blocker",
        "Pool reconciliation mismatch",
        `Allocated USD plus returned future-pool USD must equal confirmed monthly pool USD (${poolUsd.toFixed(2)}).`,
      ),
    )
  }

  const fillsByUser = new Map<string, number>()
  for (const row of input.assetFills) {
    fillsByUser.set(row.user_id, roundUsd((fillsByUser.get(row.user_id) ?? 0) + numberValue(row.usd_value)))
  }
  for (const [userId, filledUsd] of fillsByUser) {
    const allocatedUsd = resultUsdByUser.get(userId) ?? 0
    if (filledUsd - allocatedUsd > 0.01) {
      issues.push(
        issue(
          "asset_fill_exceeds_allocation",
          "blocker",
          "Asset fill exceeds allocation",
          `Selected asset fills for ${userId} exceed that user's calculated allocation.`,
        ),
      )
    }
  }

  const poolUsdBySource = new Map<string, number>()
  for (const row of contributionSubmissions) {
    const key = contributionKey(row)
    poolUsdBySource.set(key, roundUsd((poolUsdBySource.get(key) ?? 0) + contributionPoolUsd(row)))
  }
  const fulfilledUsdBySource = new Map<string, number>()
  for (const row of input.assetFills) {
    const key = assetKey(row)
    fulfilledUsdBySource.set(key, roundUsd((fulfilledUsdBySource.get(key) ?? 0) + numberValue(row.usd_value)))
  }
  for (const row of input.returnedPools) {
    const key = assetKey(row)
    fulfilledUsdBySource.set(key, roundUsd((fulfilledUsdBySource.get(key) ?? 0) + numberValue(row.usd_value)))
  }
  for (const [key, sourceUsd] of poolUsdBySource) {
    const fulfilledUsd = fulfilledUsdBySource.get(key) ?? 0
    if (Math.abs(sourceUsd - fulfilledUsd) > 0.01) {
      issues.push(
        issue(
          "asset_supply_reconciliation_mismatch",
          "blocker",
          "Asset supply reconciliation mismatch",
          "Selected asset fills plus returned future-pool rows must reconcile to each recorded contribution pool.",
        ),
      )
    }
  }

  return issues
}
