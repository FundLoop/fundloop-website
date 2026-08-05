import { describe, expect, it } from "vitest"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"
import { normalizeUserWithdrawalRequestCreateResult, validateUserWithdrawalRequestCreateInput } from "@/lib/edge-functions/user-withdrawal-request-contract"

describe("user withdrawal request contract", () => {
  it("accepts only a positive route id and bounded idempotency key", () => {
    expect(validateUserWithdrawalRequestCreateInput({ payoutRouteId: 3, idempotencyKey: "request-123" }))
      .toEqual({ ok: true, data: { payoutRouteId: 3, idempotencyKey: "request-123" } })
    expect(validateUserWithdrawalRequestCreateInput({ payoutRouteId: 0, idempotencyKey: "short" }).ok).toBe(false)
  })

  it("requires explicit proof that no payout executed", () => {
    const base = { requestId: "req-1", payoutRouteId: 3, status: "requested", requestedUsdAmount: 125,
      currencyCode: "USD", creditCount: 2, requestedAt: "2026-08-05T00:00:00Z" }
    expect(normalizeUserWithdrawalRequestCreateResult(edgeCommandSuccess(base)).ok).toBe(false)
    expect(normalizeUserWithdrawalRequestCreateResult(edgeCommandSuccess({ ...base, noPayoutExecuted: true })).ok).toBe(true)
  })
})
