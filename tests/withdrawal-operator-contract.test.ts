import { describe, expect, it } from "vitest"
import { validateWithdrawalOperatorInput } from "@/lib/edge-functions/withdrawal-operator-contract"

describe("withdrawal operator contract", () => {
  it("accepts prepare, hold, and server-timed expiry only", () => {
    expect(validateWithdrawalOperatorInput({ action: "prepare", closePackageId: 4 }).ok).toBe(true)
    expect(validateWithdrawalOperatorInput({ action: "hold", requestId: "00000000-0000-4000-8000-000000000001", reasonCode: "review_required", evidenceHash: "a".repeat(64) }).ok).toBe(true)
    expect(validateWithdrawalOperatorInput({ action: "expire" }).ok).toBe(true)
    expect(validateWithdrawalOperatorInput({ action: "expire", observedAt: "2099-01-01T00:00:00Z" }).ok).toBe(false)
  })
})
