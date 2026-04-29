import { describe, expect, it } from "vitest"
import {
  normalizeMonthlyCyclePayoutIntentsCreateResult,
  validateMonthlyCyclePayoutIntentsCreateInput,
} from "@/lib/edge-functions/monthly-cycle-payout-intents-create-contract"

describe("monthly-cycle-payout-intents-create contract", () => {
  it("validates input payloads", () => {
    expect(validateMonthlyCyclePayoutIntentsCreateInput({ cycleKey: "2026-04", attemptId: "attempt-1" })).toEqual({
      ok: true,
      data: { cycleKey: "2026-04", attemptId: "attempt-1" },
    })

    expect(validateMonthlyCyclePayoutIntentsCreateInput({ cycleKey: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })

    expect(validateMonthlyCyclePayoutIntentsCreateInput({ cycleKey: "2026-04", attemptId: 123 })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeMonthlyCyclePayoutIntentsCreateResult({ ok: true, data: { cycleKey: "2026-04" } })).toMatchObject({
      ok: false,
      error: { code: "invalid_edge_response" },
    })

    expect(
      normalizeMonthlyCyclePayoutIntentsCreateResult({
        ok: true,
        data: {
          cycleId: 1,
          cycleKey: "2026-04",
          status: "distribution",
          distributionStartedAt: "2026-05-01T00:00:00.000Z",
          createdCount: 2,
          existingCount: 0,
          readyCount: 1,
          draftCount: 1,
          totalAmountUsd: 75,
        },
      }),
    ).toMatchObject({ ok: true, data: { readyCount: 1, draftCount: 1 } })
  })
})
