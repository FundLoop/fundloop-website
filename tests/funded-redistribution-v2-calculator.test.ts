import { describe, expect, it } from "vitest"
import {
  calculateFundedRedistributionV2,
  type FundedAllocationCohortV2Input,
  type FundedProjectSourceInput,
  type FundedRedistributionPoolSourceInput,
} from "@/lib/monthly-cycles/funded-redistribution-v2-calculator"

const manifestHash = "a".repeat(64)
const selectedPreviewHash = "b".repeat(64)

function canonicalMinor(exactUsd: string) {
  const [whole, fraction = ""] = exactUsd.split(".")
  return (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2) || "0")).toString()
}

function source(projectId: number, exactUsd: string, sourceOrder = projectId.toString()): FundedProjectSourceInput {
  return {
    sourceLotId: `source-${projectId}-${sourceOrder}`,
    sourceLotKey: `project:${projectId}:${sourceOrder}`,
    projectId,
    projectKey: `project-${projectId}`,
    exactUsd,
    canonicalMinorCapacity: canonicalMinor(exactUsd),
    minorUnitScale: 2,
    sourceOrder,
    railKey: "base_stablecoin",
    assetKey: "base:usdc",
    custodyKey: "epoch-safe",
    nativeAtomicAmount: "1000000",
    fxSnapshotId: "fx-1",
    evidenceHash: "c".repeat(64),
  }
}

function pool(kind: "harvested_unclaimed" | "carryforward_residue", exactUsd: string, order: string): FundedRedistributionPoolSourceInput {
  return {
    ...source(90 + Number(order), exactUsd, order),
    sourceLotKey: `${kind}:${order}`,
    originKind: kind,
    originCycleKey: kind === "harvested_unclaimed" ? "2026-01" : "2026-03",
  }
}

function member(projectId: number, userId: string, score: string): FundedAllocationCohortV2Input {
  return {
    projectId,
    projectKey: `project-${projectId}`,
    userId,
    projectPseudonym: "d".repeat(64),
    lockedScore: score,
    lockedMaximumScore: "20",
    cubidEvidenceHash: "e".repeat(64),
  }
}

function input(overrides: Partial<Parameters<typeof calculateFundedRedistributionV2>[0]> = {}) {
  return {
    cycleKey: "2026-04",
    manifestHash,
    selectedPreviewHash,
    minorUnitScale: 2,
    capMultiple: "3.00",
    projectSources: [source(1, "300")],
    redistributionSources: [],
    cohort: [member(1, "user-a", "5"), member(1, "user-b", "10"), member(1, "user-c", "15")],
    ...overrides,
  }
}

describe("settled Cubid redistribution v2", () => {
  it("preserves initial claims above the redistribution ceiling and gives them no top-up", async () => {
    const result = await calculateFundedRedistributionV2(input({
      capMultiple: "1.00",
      projectSources: [source(1, "100"), source(2, "100"), source(3, "100"), source(4, "100")],
      cohort: [1, 2, 3, 4].map((projectId) => member(projectId, "overlap-user", "20")),
    }))

    expect(result.users[0]).toMatchObject({
      initialClaimMinor: "40000",
      redistributionCeilingMinor: "10000",
      topUpCapacityMinor: "0",
      topUpMinor: "0",
      finalMinor: "40000",
    })
    expect(result.totals).toMatchObject({ scorePoolMinor: "0", carryOutResidueMinor: "0", finalAllocationMinor: "40000" })
    expect(result.sourceDispositions.some((row) => (row.kind as string) === "overlap_pool")).toBe(false)
  })

  it("uses the selected decimal multiple only to limit redistribution top-ups", async () => {
    const result = await calculateFundedRedistributionV2(input({ capMultiple: "1.50" }))
    expect(result.capMultiple).toBe("1.50")
    expect(result.users).toEqual([
      expect.objectContaining({ userId: "user-a", initialClaimMinor: "2500", redistributionCeilingMinor: "3750", topUpMinor: "1250", finalMinor: "3750" }),
      expect.objectContaining({ userId: "user-b", initialClaimMinor: "5000", redistributionCeilingMinor: "7500", topUpMinor: "2500", finalMinor: "7500" }),
      expect.objectContaining({ userId: "user-c", initialClaimMinor: "7500", redistributionCeilingMinor: "11250", topUpMinor: "3750", finalMinor: "11250" }),
    ])
    expect(result.totals).toMatchObject({ topUpMinor: "7500", carryOutResidueMinor: "7500" })
  })

  it("combines score discounts, E-3 harvest, and carry-in while preserving residue", async () => {
    const result = await calculateFundedRedistributionV2(input({
      capMultiple: "1.50",
      redistributionSources: [pool("harvested_unclaimed", "30", "1"), pool("carryforward_residue", "20", "2")],
    }))

    expect(result.totals).toMatchObject({
      currentFundedMinor: "30000",
      harvestedUnclaimedMinor: "3000",
      carryInMinor: "2000",
      totalInputMinor: "35000",
      initialClaimMinor: "15000",
      scorePoolMinor: "15000",
      topUpMinor: "7500",
      carryOutResidueMinor: "12500",
      finalAllocationMinor: "22500",
    })
    expect(result.invariantChecks.every((check) => check.ok)).toBe(true)
  })

  it.each(["1.00", "3.00", "10.00", "2.75"])("accepts the governed cap multiple %s", async (capMultiple) => {
    await expect(calculateFundedRedistributionV2(input({ capMultiple }))).resolves.toMatchObject({ capMultiple })
  })

  it.each(["0.99", "10.01", "3", "3.000"])("rejects the invalid cap multiple %s", async (capMultiple) => {
    await expect(calculateFundedRedistributionV2(input({ capMultiple }))).rejects.toThrow("funded_allocation_v2_cap_multiple_invalid")
  })

  it("is invariant to project, pool, and cohort input order", async () => {
    const projectSources = [source(1, "100", "1"), source(2, "80", "2")]
    const redistributionSources = [pool("harvested_unclaimed", "12.34", "3"), pool("carryforward_residue", "4.56", "4")]
    const cohort = [member(1, "user-a", "7"), member(1, "user-b", "13"), member(2, "user-a", "10"), member(2, "user-c", "20")]
    const first = await calculateFundedRedistributionV2(input({ projectSources, redistributionSources, cohort, capMultiple: "2.75" }))
    const second = await calculateFundedRedistributionV2(input({
      projectSources: [...projectSources].reverse(),
      redistributionSources: [...redistributionSources].reverse(),
      cohort: [...cohort].reverse(),
      capMultiple: "2.75",
    }))
    expect(second.resultHash).toBe(first.resultHash)
  })

  it("is deterministic across independent reruns and every source/cohort permutation", async () => {
    const projectSources = [source(1, "100", "1"), source(2, "80", "2")]
    const redistributionSources = [pool("harvested_unclaimed", "12.34", "3"), pool("carryforward_residue", "4.56", "4")]
    const cohort = [member(1, "user-a", "7"), member(1, "user-b", "13"), member(2, "user-a", "10"), member(2, "user-c", "20")]
    const expected = await calculateFundedRedistributionV2(input({ projectSources, redistributionSources, cohort, capMultiple: "2.75" }))
    for (const permutation of [
      { projectSources, redistributionSources, cohort },
      { projectSources: [...projectSources].reverse(), redistributionSources, cohort: [...cohort].reverse() },
      { projectSources, redistributionSources: [...redistributionSources].reverse(), cohort: [...cohort].reverse() },
    ]) {
      const rerun = await calculateFundedRedistributionV2(input({ ...permutation, capMultiple: "2.75" }))
      expect(rerun.resultHash).toBe(expected.resultHash)
      expect(rerun.hashInput).toEqual(expected.hashInput)
    }
  })

  // #251: non-terminating shares (1/3, 1/7, ...) used to fail exact source conservation.
  describe("exact conservation with non-terminating shares", () => {
    const EXACT_UNIT = BigInt(`1${"0".repeat(18)}`)
    const units = (value: string) => {
      expect(value).toMatch(/^\d+(?:\.\d{1,18})?$/)
      const [whole, decimals = ""] = value.split(".")
      return BigInt(whole) * EXACT_UNIT + BigInt(decimals.padEnd(18, "0"))
    }
    const conservedKinds = new Set(["initial_claim", "top_up", "carryout_residue"])
    const expectExactConservation = (
      result: Awaited<ReturnType<typeof calculateFundedRedistributionV2>>,
      sources: Array<{ sourceLotKey: string; exactUsd: string }>,
    ) => {
      for (const lot of sources) {
        const rows = result.sourceDispositions.filter((row) => row.sourceLotKey === lot.sourceLotKey && conservedKinds.has(row.kind))
        expect(rows.reduce((sum, row) => sum + units(row.exactUsd), BigInt(0)), lot.sourceLotKey).toBe(units(lot.exactUsd))
      }
      expect(result.invariantChecks.every((check) => check.ok)).toBe(true)
    }

    it.each([3, 6, 7, 9, 11])("splits one lot across %i members and conserves it exactly", async (size) => {
      const projectSources = [source(1, "100")]
      const cohort = Array.from({ length: size }, (_, index) => member(1, `user-${String(index).padStart(2, "0")}`, "20"))
      const result = await calculateFundedRedistributionV2(input({ projectSources, redistributionSources: [], cohort }))
      expect(result.totals.finalAllocationMinor).toBe("10000")
      expectExactConservation(result, projectSources)
    })

    it("conserves mixed scores, overlapping cohorts, and pool sources exactly", async () => {
      const projectSources = [source(1, "100.01", "1"), source(2, "33.33", "2"), source(3, "7", "3")]
      const redistributionSources = [pool("harvested_unclaimed", "10.07", "4"), pool("carryforward_residue", "3.13", "5")]
      const cohort = [
        member(1, "user-a", "7"), member(1, "user-b", "13"), member(1, "user-c", "0"),
        member(2, "user-a", "11"), member(2, "user-d", "20"), member(2, "user-e", "3"),
        member(3, "user-b", "19"), member(3, "user-e", "1"), member(3, "user-f", "17"),
      ]
      const result = await calculateFundedRedistributionV2(input({ projectSources, redistributionSources, cohort, capMultiple: "1.25" }))
      expectExactConservation(result, [...projectSources, ...redistributionSources])
    })

    it("moves each reconciled row by less than one 1e-18 unit from its exact value", async () => {
      const result = await calculateFundedRedistributionV2(input({
        projectSources: [source(1, "100")], redistributionSources: [],
        cohort: Array.from({ length: 7 }, (_, index) => member(1, `user-${index}`, "20")),
      }))
      // Exact share is 100/7; every row must be its floor or floor + 1e-18.
      const floor = (BigInt(100) * EXACT_UNIT) / BigInt(7)
      const claims = result.sourceDispositions.filter((row) => row.kind === "initial_claim")
      expect(claims).toHaveLength(7)
      for (const row of claims) expect([floor, floor + BigInt(1)]).toContain(units(row.exactUsd))
    })
  })
})
