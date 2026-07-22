import { describe, expect, it } from "vitest"
import {
  buildMvpContributionPoolsFromLockManifest,
  calculateMvpDistribution,
  type MvpAssetPreferenceInput,
  type MvpAttributionRowInput,
  type MvpContributionPoolInput,
  type MvpEligibleUserInput,
} from "@/lib/monthly-cycles/mvp-distribution-calculator"

const users: MvpEligibleUserInput[] = [
  { userId: "user-a", cubidId: "cubid-a", cubidIdentityStatus: "verified" },
  { userId: "user-b", cubidId: "cubid-b", cubidIdentityStatus: "linked" },
  { userId: "user-c", cubidId: "cubid-c", cubidIdentityStatus: "linked" },
]

const pools: MvpContributionPoolInput[] = [
  { id: "pool-1", projectId: 1, assetType: "stablecoin", assetCode: "USDC", sourceAmount: 90, usdValue: 90 },
  { id: "pool-2", projectId: 2, assetType: "fiat", assetCode: "USD", sourceAmount: 30, usdValue: 30 },
  { id: "pool-3", projectId: 3, assetType: "project_token", assetCode: "CIVIC", sourceAmount: 600, usdValue: 60 },
]

const attributionRows: MvpAttributionRowInput[] = [
  { id: 1, datasetId: 10, projectId: 1, userId: "user-a", scopedCubidId: "scope-a-1", attributionPoints: 2, resolutionStatus: "resolved" },
  { id: 2, datasetId: 10, projectId: 1, userId: "user-b", scopedCubidId: "scope-b-1", attributionPoints: 1, resolutionStatus: "resolved" },
  { id: 3, datasetId: 20, projectId: 2, userId: "user-b", scopedCubidId: "scope-b-2", attributionPoints: 1, resolutionStatus: "resolved" },
  { id: 4, datasetId: 20, projectId: 2, userId: "user-c", scopedCubidId: "scope-c-2", attributionPoints: 1, resolutionStatus: "resolved" },
  { id: 5, datasetId: 30, projectId: 3, userId: "user-c", scopedCubidId: "scope-c-3", attributionPoints: 3, resolutionStatus: "resolved" },
  { id: 6, datasetId: 30, projectId: 3, userId: "user-a", scopedCubidId: "scope-a-3", attributionPoints: 1, resolutionStatus: "resolved" },
]

const preferences: MvpAssetPreferenceInput[] = [
  { userId: "user-a", rank: 1, assetType: "project_token", assetCode: "CIVIC", projectId: 3, accepted: true },
  { userId: "user-a", rank: 2, assetType: "stablecoin", assetCode: "USDC", accepted: true },
  { userId: "user-b", rank: 1, assetType: "stablecoin", assetCode: "USDC", accepted: true },
  { userId: "user-b", rank: 2, assetType: "fiat", assetCode: "USD", accepted: true },
  { userId: "user-c", rank: 1, assetType: "fiat", assetCode: "USD", accepted: true },
  { userId: "user-c", rank: 2, assetType: "stablecoin", assetCode: "USDC", accepted: true },
  { userId: "user-c", rank: 3, assetType: "project_token", assetCode: "CIVIC", projectId: 3, accepted: false },
]

describe("calculateMvpDistribution", () => {
  it("computes raw entitlements, baselines, capped equalization, and preference-based fills", async () => {
    const result = await calculateMvpDistribution({
      cycleKey: "2026-05",
      lockedManifestHash: "lock-hash",
      priceSnapshotId: "prices-2026-05",
      contributionPools: pools,
      attributionRows,
      eligibleUsers: users,
      assetPreferences: preferences,
    })

    expect(result).toMatchObject({
      version: "mvp_capped_equalization_v1",
      totals: {
        poolUsd: 180,
        allocatedUsd: 180,
        returnedUsd: 0,
        rawEntitlementUsd: 180,
      },
      invariantChecks: [
        expect.objectContaining({ code: "allocation_reconciles_to_pool", ok: true }),
        expect.objectContaining({ code: "cap_multiple_respected", ok: true }),
      ],
    })
    expect(result.rawEntitlements).toEqual([
      expect.objectContaining({ projectId: 1, userId: "user-a", rawUsd: 60 }),
      expect.objectContaining({ projectId: 1, userId: "user-b", rawUsd: 30 }),
      expect.objectContaining({ projectId: 2, userId: "user-b", rawUsd: 15 }),
      expect.objectContaining({ projectId: 2, userId: "user-c", rawUsd: 15 }),
      expect.objectContaining({ projectId: 3, userId: "user-a", rawUsd: 15 }),
      expect.objectContaining({ projectId: 3, userId: "user-c", rawUsd: 45 }),
    ])
    expect(result.userAllocations).toEqual([
      expect.objectContaining({ userId: "user-a", baselineUsd: 60, equalizationTopUpUsd: 0, roundedFinalUsd: 60, capUsd: 180 }),
      expect.objectContaining({ userId: "user-b", baselineUsd: 30, equalizationTopUpUsd: 30, roundedFinalUsd: 60, capUsd: 90 }),
      expect.objectContaining({ userId: "user-c", baselineUsd: 45, equalizationTopUpUsd: 15, roundedFinalUsd: 60, capUsd: 135 }),
    ])
    expect(result.assetFills).toEqual([
      expect.objectContaining({ userId: "user-a", assetCode: "CIVIC", usdValue: 60, preferenceRank: 1 }),
      expect.objectContaining({ userId: "user-b", assetCode: "USDC", usdValue: 60, preferenceRank: 1 }),
      expect.objectContaining({ userId: "user-c", assetCode: "USD", usdValue: 30, preferenceRank: 1, partial: true }),
      expect.objectContaining({ userId: "user-c", assetCode: "USDC", usdValue: 30, preferenceRank: 2 }),
    ])
    expect(result.excludedRows).toEqual([])
    expect(result.resultHash).toMatch(/^[a-f0-9]{64}$/)

    const rerun = await calculateMvpDistribution({
      cycleKey: "2026-05",
      lockedManifestHash: "lock-hash",
      priceSnapshotId: "prices-2026-05",
      contributionPools: pools,
      attributionRows,
      eligibleUsers: users,
      assetPreferences: preferences,
    })
    expect(rerun.resultHash).toBe(result.resultHash)
  })

  it("requires scoped CUBID attribution and linked or verified users", async () => {
    const result = await calculateMvpDistribution({
      cycleKey: "2026-05",
      contributionPools: [{ id: "pool-1", projectId: 1, assetType: "stablecoin", assetCode: "USDC", sourceAmount: 100, usdValue: 100 }],
      attributionRows: [
        { id: "missing-scope", datasetId: 10, projectId: 1, userId: "user-a", scopedCubidId: null, attributionPoints: 1, resolutionStatus: "resolved" },
        { id: "unlinked", datasetId: 10, projectId: 1, userId: "user-x", scopedCubidId: "scope-x", attributionPoints: 1, resolutionStatus: "resolved" },
        { id: "zero", datasetId: 10, projectId: 1, userId: "user-b", scopedCubidId: "scope-b", attributionPoints: 0, resolutionStatus: "resolved" },
        { id: "ok", datasetId: 10, projectId: 1, userId: "user-a", scopedCubidId: "scope-a", attributionPoints: 1, resolutionStatus: "resolved" },
      ],
      eligibleUsers: users,
      assetPreferences: [{ userId: "user-a", rank: 1, assetType: "stablecoin", assetCode: "USDC", accepted: true }],
    })

    expect(result.excludedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowId: "missing-scope", reasonCode: "scoped_cubid_required" }),
      expect.objectContaining({ rowId: "unlinked", reasonCode: "user_not_eligible" }),
      expect.objectContaining({ rowId: "zero", reasonCode: "non_positive_points" }),
    ]))
    expect(result.excludedRows).toHaveLength(3)
    expect(result.userAllocations).toEqual([expect.objectContaining({ userId: "user-a", roundedFinalUsd: 100 })])
  })

  it("normalizes duplicate attribution rows and assigns rounding residuals deterministically", async () => {
    const result = await calculateMvpDistribution({
      cycleKey: "2026-05",
      contributionPools: [{ id: "pool-1", projectId: 1, assetType: "stablecoin", assetCode: "USDC", sourceAmount: 100, usdValue: 100 }],
      attributionRows: [
        { id: 1, datasetId: 10, projectId: 1, userId: "user-a", scopedCubidId: "scope-a", attributionPoints: 1, resolutionStatus: "resolved" },
        { id: 2, datasetId: 10, projectId: 1, userId: "user-a", scopedCubidId: "scope-a", attributionPoints: 1, resolutionStatus: "resolved" },
        { id: 3, datasetId: 10, projectId: 1, userId: "user-b", scopedCubidId: "scope-b", attributionPoints: 1, resolutionStatus: "resolved" },
      ],
      eligibleUsers: users,
      assetPreferences: [
        { userId: "user-a", rank: 1, assetType: "stablecoin", assetCode: "USDC", accepted: true },
        { userId: "user-b", rank: 1, assetType: "stablecoin", assetCode: "USDC", accepted: true },
      ],
    })

    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "duplicate_attribution_rows_normalized", metadata: expect.objectContaining({ userId: "user-a" }) }),
    ])
    expect(result.userAllocations).toEqual([
      expect.objectContaining({ userId: "user-a", roundedFinalUsd: 66.67 }),
      expect.objectContaining({ userId: "user-b", roundedFinalUsd: 33.33 }),
    ])
  })

  it("returns unallocated future-pool rows when the cap prevents spending the full monthly pool", async () => {
    const manyUsers = Array.from({ length: 10 }, (_, index) => ({
      userId: `user-${index}`,
      cubidIdentityStatus: "linked",
    }))
    const cappedRows = manyUsers.flatMap((user, userIndex) =>
      Array.from({ length: 5 }, (_, projectIndex) => ({
        id: `${projectIndex}-${userIndex}`,
        datasetId: projectIndex,
        projectId: projectIndex + 1,
        userId: user.userId,
        scopedCubidId: `scope-${projectIndex}-${userIndex}`,
        attributionPoints: 1,
        resolutionStatus: "resolved",
      })),
    )

    const result = await calculateMvpDistribution({
      cycleKey: "2026-05",
      contributionPools: Array.from({ length: 5 }, (_, index) => ({
        id: `pool-${index + 1}`,
        projectId: index + 1,
        assetType: "stablecoin",
        assetCode: "USDC",
        sourceAmount: 100,
        usdValue: 100,
      })),
      attributionRows: cappedRows,
      eligibleUsers: manyUsers,
      assetPreferences: manyUsers.map((user) => ({
        userId: user.userId,
        rank: 1,
        assetType: "stablecoin",
        assetCode: "USDC",
        accepted: true,
      })),
    })

    expect(result.totals).toMatchObject({ poolUsd: 500, allocatedUsd: 300, returnedUsd: 200 })
    expect(result.userAllocations.every((allocation) => allocation.roundedFinalUsd === 30 && allocation.capUsd === 30)).toBe(true)
    expect(result.returnedPools.reduce((sum, row) => sum + row.usdValue, 0)).toBe(200)
  })

  it("returns project pools with no eligible attribution instead of inventing recipients", async () => {
    const result = await calculateMvpDistribution({
      cycleKey: "2026-05",
      contributionPools: [{ id: "pool-1", projectId: 99, assetType: "fiat", assetCode: "USD", sourceAmount: 75, usdValue: 75 }],
      attributionRows: [],
      eligibleUsers: users,
      assetPreferences: preferences,
    })

    expect(result.totals).toMatchObject({ poolUsd: 75, allocatedUsd: 0, returnedUsd: 75 })
    expect(result.returnedPools).toEqual([
      expect.objectContaining({ projectId: 99, usdValue: 75, reasonCode: "no_eligible_attribution" }),
    ])
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "project_pool_returned_no_eligible_attribution", metadata: { projectId: 99 } }),
    ])
  })
})

describe("buildMvpContributionPoolsFromLockManifest", () => {
  it("derives distributable contribution pools from locked manifest contribution submissions", () => {
    expect(
      buildMvpContributionPoolsFromLockManifest({
        mvp_inputs: {
          contribution_submissions: [
            {
              id: 12,
              project_id: 7,
              source_currency_code: "USD",
              source_amount: 1000,
              usd_equivalent_amount: 1000,
              commitment_percentage: 3,
              calculated_contribution_amount: 30,
            },
            {
              id: 13,
              project_id: 8,
              source_currency_code: "CAD",
              source_amount: 1000,
              usd_equivalent_amount: 740,
              commitment_percentage: 3,
              calculated_contribution_amount: 22.2,
            },
          ],
        },
      }),
    ).toEqual([
      expect.objectContaining({ id: 12, projectId: 7, assetCode: "USD", sourceAmount: 30, usdValue: 30 }),
      expect.objectContaining({ id: 13, projectId: 8, assetCode: "CAD", sourceAmount: 30, usdValue: 22.2 }),
    ])
  })
})
