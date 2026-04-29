import { describe, expect, it } from "vitest"
import {
  normalizeMonthlyCycleLockResult,
  validateMonthlyCycleLockInput,
} from "@/lib/edge-functions/monthly-cycle-lock-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("monthly-cycle-lock contract", () => {
  it("validates a normal lock input", () => {
    expect(validateMonthlyCycleLockInput({ cycleKey: "2026-04", attemptId: "attempt-1" })).toEqual({
      ok: true,
      data: {
        cycleKey: "2026-04",
        attemptId: "attempt-1",
        overrideUnresolvedOnchain: undefined,
        overrideReason: undefined,
      },
    })
  })

  it("rejects invalid cycle keys and override flags", () => {
    expect(validateMonthlyCycleLockInput({ cycleKey: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
    expect(validateMonthlyCycleLockInput({ cycleKey: "2026-04", overrideUnresolvedOnchain: "yes" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("trims override reasons without making them mandatory at validation time", () => {
    expect(
      validateMonthlyCycleLockInput({
        cycleKey: "2026-04",
        overrideUnresolvedOnchain: true,
        overrideReason: "  operator reviewed pending tx  ",
      }),
    ).toEqual({
      ok: true,
      data: {
        cycleKey: "2026-04",
        attemptId: undefined,
        overrideUnresolvedOnchain: true,
        overrideReason: "operator reviewed pending tx",
      },
    })
  })

  it("normalizes invalid Edge responses", () => {
    const result = normalizeMonthlyCycleLockResult(edgeCommandSuccess({ cycleId: 1 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })

  it("accepts a valid lock output envelope", () => {
    const result = normalizeMonthlyCycleLockResult(
      edgeCommandSuccess({
        cycleId: 1,
        cycleKey: "2026-04",
        status: "locked",
        lockedAt: "2026-05-01T00:00:00.000Z",
        lockedManifestHash: "abc123",
        counts: {
          payments: 1,
          onchainSubmissions: 0,
          unresolvedOnchainSubmissions: 0,
          identitySnapshots: 2,
          approvedDatasets: 1,
          identityArtifacts: 1,
        },
        overrideApplied: false,
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.ok ? result.data.lockedManifestHash : null).toBe("abc123")
  })
})
