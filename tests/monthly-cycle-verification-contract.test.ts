import { describe, expect, it } from "vitest"
import {
  normalizeMonthlyCycleApprovalResult,
  validateMonthlyCycleApprovalInput,
} from "@/lib/edge-functions/monthly-cycle-approval-contract"
import {
  normalizeMonthlyCycleVerificationReviewResult,
  validateMonthlyCycleVerificationReviewInput,
} from "@/lib/edge-functions/monthly-cycle-verification-review-contract"

describe("monthly-cycle verification and approval contracts", () => {
  it("validates verification review inputs", () => {
    expect(validateMonthlyCycleVerificationReviewInput({ cycleKey: "2026-04", decision: "verified", note: "Looks clean." })).toEqual({
      ok: true,
      data: { cycleKey: "2026-04", decision: "verified", note: "Looks clean.", attemptId: undefined },
    })
    expect(validateMonthlyCycleVerificationReviewInput({ cycleKey: "2026-99", decision: "verified", note: "x" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
    expect(validateMonthlyCycleVerificationReviewInput({ cycleKey: "2026-04", decision: "maybe", note: "x" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
    expect(validateMonthlyCycleVerificationReviewInput({ cycleKey: "2026-04", decision: "verified", note: "" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("validates approval inputs", () => {
    expect(validateMonthlyCycleApprovalInput({ cycleKey: "2026-04", note: "Approved." })).toEqual({
      ok: true,
      data: { cycleKey: "2026-04", note: "Approved.", attemptId: undefined },
    })
    expect(validateMonthlyCycleApprovalInput({ cycleKey: "2026-04", note: "" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeMonthlyCycleVerificationReviewResult({ ok: true, data: { cycleKey: "2026-04" } })).toMatchObject({
      ok: false,
      error: { code: "invalid_edge_response" },
    })
    expect(normalizeMonthlyCycleApprovalResult({ ok: true, data: { cycleKey: "2026-04" } })).toMatchObject({
      ok: false,
      error: { code: "invalid_edge_response" },
    })
  })
})
