import { describe, expect, it } from "vitest"
import {
  normalizeAdminOnchainPaymentReconciliationRunResult,
  normalizeAdminPaymentReceiptConfirmResult,
  validateAdminOnchainPaymentReconciliationRunInput,
  validateAdminPaymentReceiptConfirmInput,
} from "@/lib/edge-functions/admin-payment-operations-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("admin payment operation contracts", () => {
  it("validates admin payment confirmation input", () => {
    expect(
      validateAdminPaymentReceiptConfirmInput({
        paymentId: 22,
        attemptId: "attempt-1",
      }),
    ).toEqual({
      ok: true,
      data: {
        paymentId: 22,
        attemptId: "attempt-1",
      },
    })
  })

  it("rejects invalid confirmation identifiers", () => {
    const result = validateAdminPaymentReceiptConfirmInput({
      paymentId: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_payload")
  })

  it("validates reconciliation filters", () => {
    expect(
      validateAdminOnchainPaymentReconciliationRunInput({
        limit: 5,
        paymentId: 22,
        submissionId: 44,
      }),
    ).toEqual({
      ok: true,
      data: {
        limit: 5,
        paymentId: 22,
        submissionId: 44,
        attemptId: undefined,
      },
    })
  })

  it("normalizes invalid admin confirmation responses", () => {
    const result = normalizeAdminPaymentReceiptConfirmResult(edgeCommandSuccess({ paymentId: 22 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })

  it("normalizes invalid reconciliation responses", () => {
    const result = normalizeAdminOnchainPaymentReconciliationRunResult(edgeCommandSuccess({ processedCount: 1 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
