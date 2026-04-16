import { describe, expect, it } from "vitest"
import {
  isProjectPaymentDraftsCreateOutput,
  validateProjectPaymentDraftsCreateInput,
} from "@/lib/edge-functions/project-payment-drafts-create-contract"

describe("project payment drafts create contract", () => {
  it("accepts a valid command payload and normalizes the payment rows", () => {
    const result = validateProjectPaymentDraftsCreateInput({
      projectSlug: "fundloop-studio",
      attemptId: "attempt-save-1",
      payments: [
        {
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000.125,
          payment_amount: 10.444,
          payment_percentage: 1,
          payment_method_id: 1,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: {
        projectSlug: "fundloop-studio",
        attemptId: "attempt-save-1",
        payments: [
          {
            period_start: "2026-04-01",
            period_end: "2026-04-30",
            revenue: 1000.13,
            payment_amount: 10.44,
            payment_percentage: 1,
            payment_method_id: 1,
          },
        ],
      },
    })
  })

  it("rejects a missing project slug", () => {
    const result = validateProjectPaymentDraftsCreateInput({
      projectSlug: "   ",
      payments: [],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_payload",
        message: "projectSlug is required.",
      },
    })
  })

  it("rejects invalid payment rows with a domain-specific code", () => {
    const result = validateProjectPaymentDraftsCreateInput({
      projectSlug: "fundloop-studio",
      payments: [
        {
          period_start: "2026-04-30",
          period_end: "2026-04-01",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 1,
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "payment_validation_failed",
        message: "Payment period 1 ends before it starts.",
      },
    })
  })

  it("validates the expected output shape", () => {
    expect(
      isProjectPaymentDraftsCreateOutput([
        {
          id: 1,
          project_id: 7,
          project_name: "FundLoop Studio",
          project_slug: "fundloop-studio",
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 1,
          payment_method_name: "Crypto contract",
          payment_method_code: "crypto_contract",
          status_id: 3,
          status_name: "Draft",
          status_code: "draft",
          created_at: "2026-04-14T12:00:00.000Z",
          updated_at: "2026-04-14T12:00:00.000Z",
          paid_at: null,
          confirmed_at: null,
          notes: null,
          latest_onchain_submission: null,
        },
      ]),
    ).toBe(true)
  })
})
