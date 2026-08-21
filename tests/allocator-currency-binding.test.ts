import { describe, expect, test } from "vitest"
import {
  calculateFundedRedistributionV2,
  type FundedAllocationCohortV2Input,
  type FundedProjectSourceInput,
  type FundedRedistributionPoolSourceInput,
  type FundedRedistributionV2Input,
} from "../lib/monthly-cycles/funded-redistribution-v2-calculator"

function createSampleInputs(overrides?: Partial<FundedRedistributionV2Input>): FundedRedistributionV2Input {
  const projectSources: FundedProjectSourceInput[] = [
    {
      sourceLotId: "lot-1",
      sourceLotKey: "lot:2026-08:1",
      projectId: 10,
      projectKey: "project-alpha",
      exactUsd: "100.00",
      canonicalMinorCapacity: "10000",
      minorUnitScale: 2,
      sourceOrder: "1",
      railKey: "stripe_pay_by_bank",
      assetKey: "eur_fiat",
      custodyKey: "stripe_main",
      nativeAtomicAmount: "9000",
      fxSnapshotId: "fx-1",
      evidenceHash: "0000000000000000000000000000000000000000000000000000000000000001",
      currency: "EUR",
    },
  ]

  const redistributionSources: FundedRedistributionPoolSourceInput[] = [
    {
      sourceLotId: "harvest-1",
      sourceLotKey: "harvest:2026-08:1",
      projectId: 10,
      exactUsd: "20.00",
      canonicalMinorCapacity: "2000",
      minorUnitScale: 2,
      sourceOrder: "2",
      railKey: "stripe_pay_by_bank",
      assetKey: "eur_fiat",
      custodyKey: "stripe_main",
      nativeAtomicAmount: "1800",
      fxSnapshotId: "fx-1",
      evidenceHash: "0000000000000000000000000000000000000000000000000000000000000002",
      originKind: "harvested_unclaimed",
      originCycleKey: "2026-05",
      currency: "EUR",
    },
  ]

  const cohort: FundedAllocationCohortV2Input[] = [
    {
      projectId: 10,
      projectKey: "project-alpha",
      userId: "user-1",
      projectPseudonym: "11111111-1111-4111-8111-111111111111",
      lockedScore: "80",
      lockedMaximumScore: "100",
      cubidEvidenceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    {
      projectId: 10,
      projectKey: "project-alpha",
      userId: "user-2",
      projectPseudonym: "22222222-2222-4222-8222-222222222222",
      lockedScore: "100",
      lockedMaximumScore: "100",
      cubidEvidenceHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  ]

  return {
    cycleKey: "2026-08",
    manifestHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    selectedPreviewHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    minorUnitScale: 2,
    capMultiple: "3.00",
    currency: "EUR",
    projectSources,
    redistributionSources,
    cohort,
    ...overrides,
  }
}

describe("allocator mandatory currency binding", () => {
  test("propagates mandatory currency to user allocations, source dispositions, and result object", async () => {
    const input = createSampleInputs({ currency: "EUR" })
    const result = await calculateFundedRedistributionV2(input)

    expect(result.currency).toBe("EUR")
    expect(result.users.every((u) => u.currency === "EUR")).toBe(true)
    expect(result.sourceDispositions.every((d) => d.currency === "EUR")).toBe(true)
    expect((result.hashInput as { currency: string }).currency).toBe("EUR")
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test("rejects invalid currency codes", async () => {
    const invalidInput = createSampleInputs({ currency: "INVALID_CURRENCY" })
    await expect(calculateFundedRedistributionV2(invalidInput)).rejects.toThrow("funded_allocation_v2_currency_invalid")

    const lowercaseInput = createSampleInputs({ currency: "eur" })
    const res = await calculateFundedRedistributionV2(lowercaseInput)
    expect(res.currency).toBe("EUR")
  })

  test("rejects mismatched currency between source lots and allocation currency", async () => {
    const input = createSampleInputs({
      currency: "USD",
      projectSources: [
        {
          ...createSampleInputs().projectSources[0],
          currency: "EUR", // Mismatch with input currency USD
        },
      ],
    })
    await expect(calculateFundedRedistributionV2(input)).rejects.toThrow("funded_allocation_v2_currency_mismatch")
  })

  test("different currencies produce distinct deterministic result hashes", async () => {
    const inputEur = createSampleInputs({
      currency: "EUR",
      projectSources: [{ ...createSampleInputs().projectSources[0], currency: "EUR" }],
      redistributionSources: [{ ...createSampleInputs().redistributionSources[0], currency: "EUR" }],
    })
    const inputCad = createSampleInputs({
      currency: "CAD",
      projectSources: [{ ...createSampleInputs().projectSources[0], currency: "CAD" }],
      redistributionSources: [{ ...createSampleInputs().redistributionSources[0], currency: "CAD" }],
    })

    const resultEur = await calculateFundedRedistributionV2(inputEur)
    const resultCad = await calculateFundedRedistributionV2(inputCad)

    expect(resultEur.currency).toBe("EUR")
    expect(resultCad.currency).toBe("CAD")
    expect(resultEur.resultHash).not.toBe(resultCad.resultHash)
  })
})
