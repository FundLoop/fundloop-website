import { describe, expect, it } from "vitest"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"
import { normalizeUserWithdrawalRequestResult, validateUserWithdrawalRequestInput } from "@/lib/edge-functions/user-withdrawal-request-contract"

describe("user withdrawal request v2 contract", () => {
  it("accepts exact create fields and 0%-100% fee snapshots", () => {
    const base = { action: "create", payoutRouteId: 3, requestedMinor: 1000, assetKey: "stripe_sandbox_usd", idempotencyKey: "request-123" }
    expect(validateUserWithdrawalRequestInput({ ...base, userFeeBps: 0 }).ok).toBe(true)
    expect(validateUserWithdrawalRequestInput({ ...base, userFeeBps: 10000 }).ok).toBe(true)
    expect(validateUserWithdrawalRequestInput({ ...base, userFeeBps: 10001 }).ok).toBe(false)
    expect(validateUserWithdrawalRequestInput({ ...base, userFeeBps: 0, actorUserId: "forged" }).ok).toBe(false)
  })

  it("accepts bounded cancel and retry actions", () => {
    const requestId = "00000000-0000-4000-8000-000000000001"
    expect(validateUserWithdrawalRequestInput({ action: "cancel", requestId }).ok).toBe(true)
    expect(validateUserWithdrawalRequestInput({ action: "retry", requestId, reason: "inventory_replenished" }).ok).toBe(true)
  })

  it("requires explicit proof that no payout executed", () => {
    const base = { requestId: "req-1", status: "reserved" }
    expect(normalizeUserWithdrawalRequestResult(edgeCommandSuccess(base)).ok).toBe(false)
    expect(normalizeUserWithdrawalRequestResult(edgeCommandSuccess({ ...base, noPayoutExecuted: true })).ok).toBe(true)
  })
})
