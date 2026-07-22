import { describe, expect, it } from "vitest"
import {
  normalizeMonthlyCycleBookkeepingCreditsCreateResult,
  validateMonthlyCycleBookkeepingCreditsCreateInput,
} from "@/lib/edge-functions/monthly-cycle-bookkeeping-credits-create-contract"

describe("monthly-cycle-bookkeeping-credits-create contract", () => {
  it("accepts a valid cycle key and optional attempt id", () => {
    expect(validateMonthlyCycleBookkeepingCreditsCreateInput({ cycleKey: "2026-04", attemptId: "attempt-1" })).toEqual({
      ok: true,
      data: { cycleKey: "2026-04", attemptId: "attempt-1" },
    })
  })

  it("rejects invalid cycle keys and attempt ids", () => {
    expect(validateMonthlyCycleBookkeepingCreditsCreateInput({ cycleKey: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
    expect(validateMonthlyCycleBookkeepingCreditsCreateInput({ cycleKey: "2026-04", attemptId: 123 })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeMonthlyCycleBookkeepingCreditsCreateResult({ ok: true, data: { cycleKey: "2026-04" } })).toMatchObject({
      ok: false,
      error: { code: "invalid_edge_response" },
    })
  })

  it("accepts the expected output envelope", () => {
    expect(
      normalizeMonthlyCycleBookkeepingCreditsCreateResult({
        ok: true,
        data: {
          cycleId: 1,
          cycleKey: "2026-04",
          status: "distribution",
          distributionStartedAt: "2026-05-01T04:00:00.000Z",
          createdCount: 2,
          existingCount: 0,
          creditedCount: 2,
          totalCreditedUsd: 75,
          returnedPoolUsd: 5,
          assetFillCount: 3,
          sourceBreakdownCount: 2,
          noPayoutExecuted: true,
        },
      }),
    ).toMatchObject({ ok: true, data: { creditedCount: 2, noPayoutExecuted: true } })
  })
})
