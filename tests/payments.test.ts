import { describe, expect, it } from "vitest"
import { validateProjectPaymentDrafts } from "@/lib/payments"

describe("validateProjectPaymentDrafts", () => {
  it("normalizes valid payment rows", () => {
    const result = validateProjectPaymentDrafts([
      {
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        revenue: 1000.126,
        payment_amount: 10.555,
        payment_percentage: 1.23456,
        payment_method_id: 5,
      },
    ])

    expect(result).toEqual({
      ok: true,
      data: [
        {
          period_start: "2026-03-01",
          period_end: "2026-03-31",
          revenue: 1000.13,
          payment_amount: 10.55,
          payment_percentage: 1.2346,
          payment_method_id: 5,
        },
      ],
    })
  })

  it("rejects rows with inverted dates", () => {
    const result = validateProjectPaymentDrafts([
      {
        period_start: "2026-03-31",
        period_end: "2026-03-01",
        revenue: 1000,
        payment_amount: 10,
        payment_percentage: 1,
        payment_method_id: 5,
      },
    ])

    expect(result).toEqual({
      ok: false,
      error: "Payment period 1 ends before it starts.",
    })
  })

  it("rejects rows with missing financial values", () => {
    const result = validateProjectPaymentDrafts([
      {
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        revenue: 0,
        payment_amount: 0,
        payment_percentage: 0,
        payment_method_id: 0,
      },
    ])

    expect(result).toEqual({
      ok: false,
      error: "Payment period 1 must include revenue greater than zero.",
    })
  })
})
