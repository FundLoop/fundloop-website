export const MVP_ALLOCATION_POLICY = "mvp_capped_equalization_v1" as const
export const MVP_ALLOCATION_CAP_MULTIPLE = 3

export type MvpAllocationAssetType = "project_token" | "stablecoin" | "fiat"

export type MvpContributionPoolInput = {
  id: number | string
  projectId: number
  projectSlug?: string | null
  assetType?: MvpAllocationAssetType
  assetCode: string
  sourceAmount: number
  usdValue: number
  availableSourceAmount?: number
  priceSnapshotId?: string | null
}

export type MvpAttributionRowInput = {
  id: number | string
  datasetId: number | string
  projectId: number
  userId: string | null
  scopedCubidId: string | null
  attributionPoints: number
  resolutionStatus?: string | null
}

export type MvpEligibleUserInput = {
  userId: string
  cubidId?: string | null
  cubidIdentityStatus?: string | null
  isEligible?: boolean
}

export type MvpAssetPreferenceInput = {
  userId: string
  rank: number
  assetType: MvpAllocationAssetType
  assetCode: string
  projectId?: number | null
  accepted: boolean
}

export type MvpDistributionInput = {
  cycleKey: string
  lockedManifestHash?: string | null
  priceSnapshotId?: string | null
  contributionPools: MvpContributionPoolInput[]
  attributionRows: MvpAttributionRowInput[]
  eligibleUsers: MvpEligibleUserInput[]
  assetPreferences: MvpAssetPreferenceInput[]
  capMultiple?: number
}

export type MvpDistributionExcludedRow = {
  rowId: number | string
  projectId: number
  userId: string | null
  reasonCode:
    | "scoped_cubid_required"
    | "user_not_resolved"
    | "user_not_eligible"
    | "non_positive_points"
    | "row_not_resolved"
}

export type MvpDistributionWarning = {
  code:
    | "duplicate_attribution_rows_normalized"
    | "project_pool_returned_no_eligible_attribution"
    | "user_uses_default_asset_preferences"
    | "asset_preference_unavailable"
    | "allocation_returned_unfulfillable"
  message: string
  metadata?: Record<string, unknown>
}

export type MvpDistributionRawEntitlement = {
  projectId: number
  userId: string
  scopedCubidId: string
  attributionPoints: number
  totalProjectPoints: number
  projectPoolUsd: number
  rawUsd: number
}

export type MvpDistributionUserAllocation = {
  userId: string
  baselineUsd: number
  equalizationTopUpUsd: number
  unroundedFinalUsd: number
  roundedFinalUsd: number
  capUsd: number
}

export type MvpDistributionAssetFill = {
  userId: string
  poolId: number | string
  projectId: number
  assetType: MvpAllocationAssetType
  assetCode: string
  sourceAmount: number
  usdValue: number
  preferenceRank: number
  partial: boolean
}

export type MvpDistributionReturnedPool = {
  poolId: number | string
  projectId: number
  assetType: MvpAllocationAssetType
  assetCode: string
  sourceAmount: number
  usdValue: number
  reasonCode:
    | "no_eligible_attribution"
    | "cap_remainder"
    | "preference_unfulfillable"
    | "rounding_remainder"
}

export type MvpDistributionResult = {
  version: typeof MVP_ALLOCATION_POLICY
  cycleKey: string
  lockedManifestHash: string | null
  priceSnapshotId: string | null
  capMultiple: number
  totals: {
    poolUsd: number
    allocatedUsd: number
    returnedUsd: number
    rawEntitlementUsd: number
  }
  contributionPools: Array<MvpContributionPoolInput & { assetType: MvpAllocationAssetType; availableSourceAmount: number }>
  rawEntitlements: MvpDistributionRawEntitlement[]
  userAllocations: MvpDistributionUserAllocation[]
  assetFills: MvpDistributionAssetFill[]
  returnedPools: MvpDistributionReturnedPool[]
  excludedRows: MvpDistributionExcludedRow[]
  warnings: MvpDistributionWarning[]
  invariantChecks: Array<{ code: string; ok: boolean; message: string }>
  hashInput: unknown
  resultHash: string
}

type NormalizedPool = MvpContributionPoolInput & {
  assetType: MvpAllocationAssetType
  availableSourceAmount: number
  remainingSourceAmount: number
  remainingUsd: number
  usdPerSourceUnit: number
}

type EligibleAttribution = {
  rowId: number | string
  projectId: number
  userId: string
  scopedCubidId: string
  points: number
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function floorUsdCents(value: number) {
  return Math.floor((value + Number.EPSILON) * 100)
}

function compareStableStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

async function sha256Hex(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableStringify(value))
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function inferAssetType(assetCode: string): MvpAllocationAssetType {
  const code = assetCode.toUpperCase()
  if (["USDC", "USDT", "DAI"].includes(code)) return "stablecoin"
  if (["USD", "CAD", "EUR", "GBP"].includes(code)) return "fiat"
  return "project_token"
}

function normalizePools(pools: MvpContributionPoolInput[]): NormalizedPool[] {
  return pools
    .filter((pool) => Number.isFinite(pool.usdValue) && pool.usdValue > 0)
    .map((pool) => {
      const availableSourceAmount = Number.isFinite(pool.availableSourceAmount)
        ? Number(pool.availableSourceAmount)
        : pool.sourceAmount
      const usdPerSourceUnit = availableSourceAmount > 0 ? pool.usdValue / availableSourceAmount : 0
      return {
        ...pool,
        assetCode: pool.assetCode.toUpperCase(),
        assetType: pool.assetType ?? inferAssetType(pool.assetCode),
        availableSourceAmount,
        remainingSourceAmount: availableSourceAmount,
        remainingUsd: pool.usdValue,
        usdPerSourceUnit,
      }
    })
    .sort(
      (left, right) =>
        left.projectId - right.projectId ||
        compareStableStrings(left.assetType, right.assetType) ||
        compareStableStrings(left.assetCode, right.assetCode) ||
        compareStableStrings(String(left.id), String(right.id)),
    )
}

function isUserEligible(user: MvpEligibleUserInput) {
  if (typeof user.isEligible === "boolean") return user.isEligible
  return user.cubidIdentityStatus === "linked" || user.cubidIdentityStatus === "verified"
}

function normalizeAttributionRows(
  rows: MvpAttributionRowInput[],
  eligibleUsers: Map<string, MvpEligibleUserInput>,
): {
  eligibleRows: EligibleAttribution[]
  excludedRows: MvpDistributionExcludedRow[]
} {
  const eligibleRows: EligibleAttribution[] = []
  const excludedRows: MvpDistributionExcludedRow[] = []

  for (const row of rows) {
    const points = Number(row.attributionPoints)
    if (row.resolutionStatus && row.resolutionStatus !== "resolved") {
      excludedRows.push({ rowId: row.id, projectId: row.projectId, userId: row.userId, reasonCode: "row_not_resolved" })
      continue
    }
    if (!row.scopedCubidId) {
      excludedRows.push({ rowId: row.id, projectId: row.projectId, userId: row.userId, reasonCode: "scoped_cubid_required" })
      continue
    }
    if (!row.userId) {
      excludedRows.push({ rowId: row.id, projectId: row.projectId, userId: null, reasonCode: "user_not_resolved" })
      continue
    }
    const user = eligibleUsers.get(row.userId)
    if (!user || !isUserEligible(user)) {
      excludedRows.push({ rowId: row.id, projectId: row.projectId, userId: row.userId, reasonCode: "user_not_eligible" })
      continue
    }
    if (!Number.isFinite(points) || points <= 0) {
      excludedRows.push({ rowId: row.id, projectId: row.projectId, userId: row.userId, reasonCode: "non_positive_points" })
      continue
    }
    eligibleRows.push({
      rowId: row.id,
      projectId: row.projectId,
      userId: row.userId,
      scopedCubidId: row.scopedCubidId,
      points,
    })
  }

  return {
    eligibleRows: eligibleRows.sort(
      (left, right) =>
        left.projectId - right.projectId ||
        compareStableStrings(left.userId, right.userId) ||
        compareStableStrings(String(left.rowId), String(right.rowId)),
    ),
    excludedRows,
  }
}

function buildRawEntitlements(
  pools: NormalizedPool[],
  rows: EligibleAttribution[],
  warnings: MvpDistributionWarning[],
  returnedPools: MvpDistributionReturnedPool[],
) {
  const poolsByProject = new Map<number, number>()
  for (const pool of pools) {
    poolsByProject.set(pool.projectId, (poolsByProject.get(pool.projectId) ?? 0) + pool.usdValue)
  }

  const rowsByProject = new Map<number, EligibleAttribution[]>()
  for (const row of rows) {
    const existing = rowsByProject.get(row.projectId) ?? []
    existing.push(row)
    rowsByProject.set(row.projectId, existing)
  }

  const rawEntitlements: MvpDistributionRawEntitlement[] = []
  const projectIds = [...poolsByProject.keys()].sort((left, right) => left - right)

  for (const projectId of projectIds) {
    const projectPoolUsd = poolsByProject.get(projectId) ?? 0
    const projectRows = rowsByProject.get(projectId) ?? []
    if (projectRows.length === 0) {
      warnings.push({
        code: "project_pool_returned_no_eligible_attribution",
        message: `Project ${projectId} has contribution supply but no eligible approved attribution rows.`,
        metadata: { projectId },
      })
      for (const pool of pools.filter((item) => item.projectId === projectId)) {
        returnedPools.push({
          poolId: pool.id,
          projectId: pool.projectId,
          assetType: pool.assetType,
          assetCode: pool.assetCode,
          sourceAmount: roundUsd(pool.availableSourceAmount),
          usdValue: roundUsd(pool.usdValue),
          reasonCode: "no_eligible_attribution",
        })
        pool.remainingSourceAmount = 0
        pool.remainingUsd = 0
      }
      continue
    }

    const pointsByUser = new Map<string, { points: number; scopedCubidId: string; rowIds: Array<number | string> }>()
    for (const row of projectRows) {
      const existing = pointsByUser.get(row.userId) ?? { points: 0, scopedCubidId: row.scopedCubidId, rowIds: [] }
      existing.points += row.points
      existing.rowIds.push(row.rowId)
      pointsByUser.set(row.userId, existing)
    }

    for (const [userId, summary] of pointsByUser) {
      if (summary.rowIds.length > 1) {
        warnings.push({
          code: "duplicate_attribution_rows_normalized",
          message: `Multiple attribution rows for ${userId} in project ${projectId} were normalized into one user/project entitlement.`,
          metadata: { projectId, userId, rowIds: summary.rowIds },
        })
      }
    }

    const totalProjectPoints = [...pointsByUser.values()].reduce((sum, summary) => sum + summary.points, 0)
    if (totalProjectPoints <= 0) continue

    for (const [userId, summary] of [...pointsByUser.entries()].sort((left, right) => compareStableStrings(left[0], right[0]))) {
      rawEntitlements.push({
        projectId,
        userId,
        scopedCubidId: summary.scopedCubidId,
        attributionPoints: summary.points,
        totalProjectPoints,
        projectPoolUsd: roundUsd(projectPoolUsd),
        rawUsd: projectPoolUsd * (summary.points / totalProjectPoints),
      })
    }
  }

  return rawEntitlements.sort(
    (left, right) => left.projectId - right.projectId || compareStableStrings(left.userId, right.userId),
  )
}

function distributeEqualization(
  rawEntitlements: MvpDistributionRawEntitlement[],
  totalPoolUsd: number,
  capMultiple: number,
) {
  const rawByUser = new Map<string, number[]>()
  for (const entitlement of rawEntitlements) {
    const existing = rawByUser.get(entitlement.userId) ?? []
    existing.push(entitlement.rawUsd)
    rawByUser.set(entitlement.userId, existing)
  }

  const allocations = [...rawByUser.entries()]
    .map(([userId, values]) => {
      const baselineUsd = Math.max(...values)
      return {
        userId,
        baselineUsd,
        currentUsd: baselineUsd,
        capUsd: baselineUsd * capMultiple,
      }
    })
    .filter((allocation) => allocation.baselineUsd > 0)
    .sort((left, right) => compareStableStrings(left.userId, right.userId))

  const baselineTotal = allocations.reduce((sum, allocation) => sum + allocation.baselineUsd, 0)
  if (baselineTotal - totalPoolUsd > 0.000001) {
    throw new Error("baseline_sum_exceeds_pool")
  }

  let remainder = Math.max(0, totalPoolUsd - baselineTotal)
  while (remainder > 0.000001) {
    const candidates = allocations
      .filter((allocation) => allocation.currentUsd + 0.000001 < allocation.capUsd)
      .sort(
        (left, right) =>
          left.currentUsd - right.currentUsd ||
          left.baselineUsd - right.baselineUsd ||
          compareStableStrings(left.userId, right.userId),
      )

    if (candidates.length === 0) break

    const currentLevel = candidates[0].currentUsd
    const group = candidates.filter((candidate) => Math.abs(candidate.currentUsd - currentLevel) < 0.000001)
    const nextLevel = candidates.find((candidate) => candidate.currentUsd - currentLevel > 0.000001)?.currentUsd ?? Number.POSITIVE_INFINITY
    const groupCapLevel = Math.min(...group.map((candidate) => candidate.capUsd))
    const targetLevel = Math.min(nextLevel, groupCapLevel)
    const neededToTarget = (targetLevel - currentLevel) * group.length

    if (!Number.isFinite(neededToTarget) || neededToTarget <= 0 || neededToTarget >= remainder) {
      const perUser = remainder / group.length
      for (const allocation of group) {
        allocation.currentUsd = Math.min(allocation.capUsd, allocation.currentUsd + perUser)
      }
      remainder = 0
      break
    }

    for (const allocation of group) {
      allocation.currentUsd = Math.min(allocation.capUsd, targetLevel)
    }
    remainder -= neededToTarget
  }

  return {
    allocations: allocations.map((allocation) => ({
      userId: allocation.userId,
      baselineUsd: allocation.baselineUsd,
      equalizationTopUpUsd: Math.max(0, allocation.currentUsd - allocation.baselineUsd),
      unroundedFinalUsd: allocation.currentUsd,
      capUsd: allocation.capUsd,
    })),
    capRemainderUsd: Math.max(0, remainder),
  }
}

function roundAllocations(
  allocations: Array<Omit<MvpDistributionUserAllocation, "roundedFinalUsd">>,
  totalPoolUsd: number,
  capRemainderUsd: number,
) {
  const targetCents = Math.round(Math.max(0, totalPoolUsd - capRemainderUsd) * 100)
  const floors = allocations.map((allocation) => ({
    ...allocation,
    floorCents: floorUsdCents(allocation.unroundedFinalUsd),
    remainder: allocation.unroundedFinalUsd * 100 - floorUsdCents(allocation.unroundedFinalUsd),
  }))
  let residualCents = targetCents - floors.reduce((sum, allocation) => sum + allocation.floorCents, 0)

  const residualOrder = [...floors].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      left.baselineUsd - right.baselineUsd ||
      compareStableStrings(left.userId, right.userId),
  )
  const centsByUser = new Map(floors.map((allocation) => [allocation.userId, allocation.floorCents]))
  for (const allocation of residualOrder) {
    if (residualCents <= 0) break
    centsByUser.set(allocation.userId, (centsByUser.get(allocation.userId) ?? 0) + 1)
    residualCents -= 1
  }

  return floors
    .map((allocation) => ({
      userId: allocation.userId,
      baselineUsd: roundUsd(allocation.baselineUsd),
      equalizationTopUpUsd: roundUsd(allocation.equalizationTopUpUsd),
      unroundedFinalUsd: Number(allocation.unroundedFinalUsd.toFixed(8)),
      roundedFinalUsd: roundUsd((centsByUser.get(allocation.userId) ?? 0) / 100),
      capUsd: roundUsd(allocation.capUsd),
    }))
    .sort((left, right) => compareStableStrings(left.userId, right.userId))
}

function defaultPreferencesForUser(userId: string, pools: NormalizedPool[]): MvpAssetPreferenceInput[] {
  const preferences: MvpAssetPreferenceInput[] = []
  let rank = 1
  for (const assetType of ["stablecoin", "fiat", "project_token"] as const) {
    const seen = new Set<string>()
    for (const pool of pools.filter((item) => item.assetType === assetType)) {
      const key = `${pool.assetType}:${pool.assetCode}:${pool.projectId}`
      if (seen.has(key)) continue
      seen.add(key)
      preferences.push({
        userId,
        rank: rank++,
        assetType: pool.assetType,
        assetCode: pool.assetCode,
        projectId: pool.assetType === "project_token" ? pool.projectId : null,
        accepted: true,
      })
    }
  }
  return preferences
}

function preferencesForUser(
  userId: string,
  pools: NormalizedPool[],
  preferences: MvpAssetPreferenceInput[],
  warnings: MvpDistributionWarning[],
) {
  const custom = preferences
    .filter((preference) => preference.userId === userId)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareStableStrings(left.assetType, right.assetType) ||
        compareStableStrings(left.assetCode, right.assetCode) ||
        Number(left.projectId ?? 0) - Number(right.projectId ?? 0),
    )

  if (custom.length > 0) return custom

  warnings.push({
    code: "user_uses_default_asset_preferences",
    message: `${userId} has no custom asset preferences; default fulfillment order is stablecoin, fiat, project tokens.`,
    metadata: { userId },
  })
  return defaultPreferencesForUser(userId, pools)
}

function poolMatchesPreference(pool: NormalizedPool, preference: MvpAssetPreferenceInput) {
  if (!preference.accepted) return false
  if (pool.assetType !== preference.assetType) return false
  if (pool.assetCode !== preference.assetCode.toUpperCase()) return false
  if (preference.assetType === "project_token" && preference.projectId != null && pool.projectId !== preference.projectId) return false
  return pool.remainingUsd > 0.000001 && pool.remainingSourceAmount > 0.000001
}

function fulfillAssets(input: {
  pools: NormalizedPool[]
  allocations: MvpDistributionUserAllocation[]
  preferences: MvpAssetPreferenceInput[]
  warnings: MvpDistributionWarning[]
}) {
  const fills: MvpDistributionAssetFill[] = []

  for (const allocation of [...input.allocations].sort((left, right) => compareStableStrings(left.userId, right.userId))) {
    let remainingUsd = allocation.roundedFinalUsd
    const preferences = preferencesForUser(allocation.userId, input.pools, input.preferences, input.warnings)

    for (const preference of preferences) {
      if (remainingUsd <= 0.000001) break
      const matchingPools = input.pools
        .filter((pool) => poolMatchesPreference(pool, preference))
        .sort(
          (left, right) =>
            compareStableStrings(left.assetType, right.assetType) ||
            compareStableStrings(left.assetCode, right.assetCode) ||
            left.projectId - right.projectId ||
            compareStableStrings(String(left.id), String(right.id)),
        )
      if (matchingPools.length === 0) {
        input.warnings.push({
          code: "asset_preference_unavailable",
          message: `${allocation.userId}'s accepted ${preference.assetCode} preference has no remaining supply.`,
          metadata: { userId: allocation.userId, preference },
        })
        continue
      }

      for (const pool of matchingPools) {
        if (remainingUsd <= 0.000001) break
        const fillUsd = Math.min(remainingUsd, pool.remainingUsd)
        const fillSourceAmount = pool.usdPerSourceUnit > 0 ? fillUsd / pool.usdPerSourceUnit : 0
        fills.push({
          userId: allocation.userId,
          poolId: pool.id,
          projectId: pool.projectId,
          assetType: pool.assetType,
          assetCode: pool.assetCode,
          sourceAmount: roundUsd(fillSourceAmount),
          usdValue: roundUsd(fillUsd),
          preferenceRank: preference.rank,
          partial: fillUsd + 0.000001 < remainingUsd || fillUsd + 0.000001 < pool.remainingUsd,
        })
        remainingUsd -= fillUsd
        pool.remainingUsd -= fillUsd
        pool.remainingSourceAmount -= fillSourceAmount
      }
    }

    if (remainingUsd > 0.000001) {
      input.warnings.push({
        code: "allocation_returned_unfulfillable",
        message: `${allocation.userId} has ${roundUsd(remainingUsd)} USD that could not be fulfilled into accepted available assets.`,
        metadata: { userId: allocation.userId, usdValue: roundUsd(remainingUsd) },
      })
    }
  }

  return fills
}

function buildReturnedPools(pools: NormalizedPool[], existing: MvpDistributionReturnedPool[], capRemainderUsd: number) {
  const returned = [...existing]
  let remainingCapRemainderUsd = capRemainderUsd
  for (const pool of pools) {
    if (pool.remainingUsd <= 0.000001) continue
    const capReturnUsd = Math.min(pool.remainingUsd, remainingCapRemainderUsd)
    if (capReturnUsd > 0.000001) {
      const capReturnSourceAmount = pool.usdPerSourceUnit > 0 ? capReturnUsd / pool.usdPerSourceUnit : 0
      returned.push({
        poolId: pool.id,
        projectId: pool.projectId,
        assetType: pool.assetType,
        assetCode: pool.assetCode,
        sourceAmount: roundUsd(capReturnSourceAmount),
        usdValue: roundUsd(capReturnUsd),
        reasonCode: "cap_remainder",
      })
      pool.remainingUsd -= capReturnUsd
      pool.remainingSourceAmount -= capReturnSourceAmount
      remainingCapRemainderUsd -= capReturnUsd
    }
    if (pool.remainingUsd <= 0.000001) continue
    returned.push({
      poolId: pool.id,
      projectId: pool.projectId,
      assetType: pool.assetType,
      assetCode: pool.assetCode,
      sourceAmount: roundUsd(Math.max(0, pool.remainingSourceAmount)),
      usdValue: roundUsd(Math.max(0, pool.remainingUsd)),
      reasonCode: "preference_unfulfillable",
    })
  }
  return returned.sort(
    (left, right) =>
      left.projectId - right.projectId ||
      compareStableStrings(left.assetType, right.assetType) ||
      compareStableStrings(left.assetCode, right.assetCode) ||
      compareStableStrings(String(left.poolId), String(right.poolId)) ||
      compareStableStrings(left.reasonCode, right.reasonCode),
  )
}

export async function calculateMvpDistribution(input: MvpDistributionInput): Promise<MvpDistributionResult> {
  const capMultiple = input.capMultiple ?? MVP_ALLOCATION_CAP_MULTIPLE
  const warnings: MvpDistributionWarning[] = []
  const returnedFromRaw: MvpDistributionReturnedPool[] = []
  const pools = normalizePools(input.contributionPools)
  const totalPoolUsd = pools.reduce((sum, pool) => sum + pool.usdValue, 0)
  const eligibleUsers = new Map(input.eligibleUsers.map((user) => [user.userId, user]))
  const { eligibleRows, excludedRows } = normalizeAttributionRows(input.attributionRows, eligibleUsers)
  const rawEntitlements = buildRawEntitlements(pools, eligibleRows, warnings, returnedFromRaw)
  const { allocations, capRemainderUsd } = distributeEqualization(rawEntitlements, totalPoolUsd, capMultiple)
  const roundedAllocations = roundAllocations(allocations, totalPoolUsd, capRemainderUsd)
  const assetFills = fulfillAssets({
    pools,
    allocations: roundedAllocations,
    preferences: input.assetPreferences,
    warnings,
  })
  const returnedPools = buildReturnedPools(pools, returnedFromRaw, capRemainderUsd)
  const allocatedUsd = roundUsd(assetFills.reduce((sum, fill) => sum + fill.usdValue, 0))
  const returnedUsd = roundUsd(returnedPools.reduce((sum, row) => sum + row.usdValue, 0))
  const rawEntitlementUsd = roundUsd(rawEntitlements.reduce((sum, entitlement) => sum + entitlement.rawUsd, 0))
  const reconciliationOk = Math.abs(roundUsd(totalPoolUsd) - roundUsd(allocatedUsd + returnedUsd)) <= 0.01
  const capOk = roundedAllocations.every((allocation) => allocation.roundedFinalUsd <= allocation.capUsd + 0.01)

  const resultWithoutHash = {
    version: MVP_ALLOCATION_POLICY,
    cycleKey: input.cycleKey,
    lockedManifestHash: input.lockedManifestHash ?? null,
    priceSnapshotId: input.priceSnapshotId ?? null,
    capMultiple,
    totals: {
      poolUsd: roundUsd(totalPoolUsd),
      allocatedUsd,
      returnedUsd,
      rawEntitlementUsd,
    },
    contributionPools: pools.map((pool) => ({
      id: pool.id,
      projectId: pool.projectId,
      projectSlug: pool.projectSlug ?? null,
      assetType: pool.assetType,
      assetCode: pool.assetCode,
      sourceAmount: pool.sourceAmount,
      usdValue: roundUsd(pool.usdValue),
      availableSourceAmount: roundUsd(pool.availableSourceAmount),
      priceSnapshotId: pool.priceSnapshotId ?? null,
    })),
    rawEntitlements: rawEntitlements.map((entitlement) => ({
      ...entitlement,
      projectPoolUsd: roundUsd(entitlement.projectPoolUsd),
      rawUsd: Number(entitlement.rawUsd.toFixed(8)),
    })),
    userAllocations: roundedAllocations,
    assetFills,
    returnedPools,
    excludedRows: excludedRows.sort(
      (left, right) =>
        left.projectId - right.projectId ||
        compareStableStrings(String(left.userId ?? ""), String(right.userId ?? "")) ||
        compareStableStrings(String(left.rowId), String(right.rowId)),
    ),
    warnings: warnings.sort((left, right) => compareStableStrings(left.code, right.code) || compareStableStrings(left.message, right.message)),
    invariantChecks: [
      {
        code: "allocation_reconciles_to_pool",
        ok: reconciliationOk,
        message: reconciliationOk
          ? "Allocated plus returned USD reconciles to confirmed pool USD."
          : "Allocated plus returned USD does not reconcile to confirmed pool USD.",
      },
      {
        code: "cap_multiple_respected",
        ok: capOk,
        message: capOk ? "All final allocations respect the cap multiple." : "At least one final allocation exceeds the cap multiple.",
      },
    ],
  }
  const hashInput = {
    ...resultWithoutHash,
    warnings: resultWithoutHash.warnings.map((warning) => ({ code: warning.code, metadata: warning.metadata ?? null })),
  }

  return {
    ...resultWithoutHash,
    hashInput,
    resultHash: await sha256Hex(hashInput),
  }
}

export function buildMvpContributionPoolsFromLockManifest(manifest: unknown): MvpContributionPoolInput[] {
  const record = manifest && typeof manifest === "object" ? (manifest as Record<string, unknown>) : {}
  const mvpInputs = record.mvp_inputs && typeof record.mvp_inputs === "object" ? (record.mvp_inputs as Record<string, unknown>) : {}
  const submissions = Array.isArray(mvpInputs.contribution_submissions) ? mvpInputs.contribution_submissions : []

  return submissions.map((submission) => {
    const row = submission && typeof submission === "object" ? (submission as Record<string, unknown>) : {}
    const sourceCurrency = String(row.source_currency_code ?? "USD").toUpperCase()
    const submittedSourceAmount = Number(row.source_amount ?? 0)
    const usdEquivalentAmount = Number(row.usd_equivalent_amount ?? 0)
    const commitmentPercentage = Number(row.commitment_percentage ?? 0)
    const contributionSourceAmount = submittedSourceAmount * (commitmentPercentage / 100)
    const contributionUsdValue = usdEquivalentAmount * (commitmentPercentage / 100)
    return {
      id: Number(row.id),
      projectId: Number(row.project_id),
      assetType: inferAssetType(sourceCurrency),
      assetCode: sourceCurrency,
      sourceAmount: contributionSourceAmount,
      availableSourceAmount: contributionSourceAmount,
      usdValue: contributionUsdValue,
      priceSnapshotId: null,
    }
  })
}
