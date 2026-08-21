import { describe, expect, it } from "vitest"
import {
  normalizeProjectMonthlyContributionSubmitResult,
  validateProjectMonthlyContributionSubmitInput,
} from "@/lib/edge-functions/project-monthly-contribution-submit-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("project monthly contribution submit contract", () => {
  it("accepts and normalizes a valid MVP contribution payload", () => {
    const result = validateProjectMonthlyContributionSubmitInput({
      projectSlug: "civic-mesh",
      cycleKey: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      sourceCurrency: "usd",
      sourceAmount: 1000.1234567,
      usdEquivalentAmount: 1000.126,
      commitmentPercentage: 1,
      calculatedContributionAmount: 10.126,
      sourceReference: " invoice-2026-04 ",
      notes: " April revenue ",
      attemptId: " attempt-1 ",
    })

    expect(result).toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        sourceCurrency: "USD",
        sourceAmount: 1000.123457,
        usdEquivalentAmount: 1000.13,
        commitmentPercentage: 1,
        calculatedContributionAmount: 10.13,
        sourceReference: "invoice-2026-04",
        notes: "April revenue",
        attemptId: "attempt-1",
      },
    })
  })

  it("rejects invalid cycle keys, periods, currencies, and amounts", () => {
    expect(validateProjectMonthlyContributionSubmitInput({ projectSlug: "civic-mesh", cycleKey: "2026-99" }).ok).toBe(false)
    expect(
      validateProjectMonthlyContributionSubmitInput({
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        periodStart: "2026-04-30",
        periodEnd: "2026-04-01",
        sourceCurrency: "usd",
        sourceAmount: 100,
        usdEquivalentAmount: 100,
        commitmentPercentage: 1,
        calculatedContributionAmount: 1,
      }).ok,
    ).toBe(false)
    expect(
      validateProjectMonthlyContributionSubmitInput({
        projectSlug: "civic-mesh",
        cycleKey: "2026-04",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        sourceCurrency: "$",
        sourceAmount: -1,
        usdEquivalentAmount: 100,
        commitmentPercentage: 1,
        calculatedContributionAmount: 1,
      }).ok,
    ).toBe(false)
  })

  it("normalizes invalid Edge Function responses", () => {
    const result = normalizeProjectMonthlyContributionSubmitResult(edgeCommandSuccess({ id: 1 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
