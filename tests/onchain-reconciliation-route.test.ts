import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runOnchainPaymentReconciliation = vi.fn()

vi.mock("@/lib/onchain/payment-reconciliation", () => ({
  runOnchainPaymentReconciliation,
}))

describe("POST /api/internal/payments/reconcile-onchain", () => {
  const previousSecret = process.env.FUNDLOOP_PAYMENTS_CRON_SECRET

  beforeEach(() => {
    process.env.FUNDLOOP_PAYMENTS_CRON_SECRET = "test-secret"
    runOnchainPaymentReconciliation.mockReset()
  })

  afterEach(() => {
    process.env.FUNDLOOP_PAYMENTS_CRON_SECRET = previousSecret
  })

  it("rejects requests without the configured secret", async () => {
    const { POST } = await import("@/app/api/internal/payments/reconcile-onchain/route")
    const response = await POST(
      new Request("http://localhost/api/internal/payments/reconcile-onchain", {
        method: "POST",
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Unauthorized.",
    })
  })

  it("runs reconciliation when the bearer secret matches", async () => {
    runOnchainPaymentReconciliation.mockResolvedValue({
      source: "cron",
      processedCount: 1,
      confirmedCount: 1,
      failedCount: 0,
      confirmingCount: 0,
      unresolvedCount: 0,
      results: [],
      touchedProjectSlugs: ["fundloop-studio"],
    })

    const { POST } = await import("@/app/api/internal/payments/reconcile-onchain/route")
    const response = await POST(
      new Request("http://localhost/api/internal/payments/reconcile-onchain", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 5, paymentId: 17 }),
      }),
    )

    expect(runOnchainPaymentReconciliation).toHaveBeenCalledWith({
      source: "cron",
      limit: 5,
      paymentId: 17,
      submissionId: undefined,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        processedCount: 1,
        confirmedCount: 1,
      },
    })
  })

  it("coerces numeric JSON strings before running reconciliation", async () => {
    runOnchainPaymentReconciliation.mockResolvedValue({
      source: "cron",
      processedCount: 0,
      confirmedCount: 0,
      failedCount: 0,
      confirmingCount: 0,
      unresolvedCount: 0,
      results: [],
      touchedProjectSlugs: [],
    })

    const { POST } = await import("@/app/api/internal/payments/reconcile-onchain/route")
    const response = await POST(
      new Request("http://localhost/api/internal/payments/reconcile-onchain", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: "5", paymentId: "17", submissionId: "21" }),
      }),
    )

    expect(runOnchainPaymentReconciliation).toHaveBeenCalledWith({
      source: "cron",
      limit: 5,
      paymentId: 17,
      submissionId: 21,
    })
    expect(response.status).toBe(200)
  })

  it("rejects invalid numeric filters", async () => {
    const { POST } = await import("@/app/api/internal/payments/reconcile-onchain/route")
    const response = await POST(
      new Request("http://localhost/api/internal/payments/reconcile-onchain", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: -1 }),
      }),
    )

    expect(response.status).toBe(400)
    expect(runOnchainPaymentReconciliation).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "limit must be a positive integer.",
    })
  })
})
