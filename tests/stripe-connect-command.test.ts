import { describe, expect, it, vi } from "vitest"
import { submitStripeConnectPayout } from "@/lib/stripe/stripe-connect-command"

describe("Stripe Connect payout command", () => {
  it("uses DB-derived account, amounts, and stable idempotency keys", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { commandId: 9, providerAccountId: "acct_test_1", currencyCode: "usd", netMinor: "975",
      transferIdempotencyKey: "stripe-connect:7:1:transfer", payoutIdempotencyKey: "stripe-connect:7:1:payout" }, error: null })
      .mockResolvedValueOnce({ data: { commandId: 9, status: "submitted", providerPayoutId: "po_test_1" }, error: null })
    const createTransfer = vi.fn(async () => ({ id: "tr_test_1" }))
    const createPayout = vi.fn(async () => ({ id: "po_test_1" }))
    const result = await submitStripeConnectPayout({ rpc } as never, { createTransfer, createPayout }, "actor", 7, "local")
    expect(result).toMatchObject({ ok: true, data: { status: "submitted" } })
    expect(createTransfer).toHaveBeenCalledWith(expect.objectContaining({ amount: 975, currency: "usd", destination: "acct_test_1" }), "stripe-connect:7:1:transfer")
    expect(createPayout).toHaveBeenCalledWith(expect.objectContaining({ amount: 975, currency: "usd", providerAccountId: "acct_test_1" }), "stripe-connect:7:1:payout")
  })
  it("records remediation when a payout fails after transfer", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { commandId: 9, providerAccountId: "acct_test_1", currencyCode: "cad", netMinor: "1000",
      transferIdempotencyKey: "stripe-connect:7:1:transfer", payoutIdempotencyKey: "stripe-connect:7:1:payout" }, error: null })
      .mockResolvedValueOnce({ data: { status: "needs_remediation" }, error: null })
    const result = await submitStripeConnectPayout({ rpc } as never, { createTransfer: vi.fn(async () => ({ id: "tr_test_1" })),
      createPayout: vi.fn(async () => { throw new Error("external_account_disabled") }) }, "actor", 7, "test")
    expect(result).toMatchObject({ ok: false })
    expect(rpc).toHaveBeenLastCalledWith("record_stripe_connect_payout_failure", expect.objectContaining({ p_transfer_id: "tr_test_1" }))
  })
  it("reuses a prior transfer during remediation instead of double funding", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { commandId: 10, providerAccountId: "acct_test_1", currencyCode: "usd", netMinor: "1000",
      existingTransferId: "tr_existing", transferIdempotencyKey: "unused", payoutIdempotencyKey: "stripe-connect:7:2:payout" }, error: null })
      .mockResolvedValueOnce({ data: { commandId: 10, status: "submitted" }, error: null })
    const createTransfer = vi.fn(); const createPayout = vi.fn(async () => ({ id: "po_retry" }))
    expect(await submitStripeConnectPayout({ rpc } as never, { createTransfer, createPayout }, "actor", 7, "local")).toMatchObject({ ok: true })
    expect(createTransfer).not.toHaveBeenCalled(); expect(createPayout).toHaveBeenCalledWith(expect.anything(), "stripe-connect:7:2:payout")
  })
  it("retries the local acknowledgement without recreating the provider payout", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { commandId: 11, providerAccountId: "acct_test_1", currencyCode: "usd", netMinor: "975",
      existingTransferId: "tr_existing", transferIdempotencyKey: "stripe-connect:7:1:transfer", payoutIdempotencyKey: "stripe-connect:7:1:payout" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "temporary database acknowledgement failure" } })
      .mockResolvedValueOnce({ data: { commandId: 11, status: "submitted" }, error: null })
    const createTransfer = vi.fn(); const createPayout = vi.fn(async () => ({ id: "po_existing" }))
    expect(await submitStripeConnectPayout({ rpc } as never, { createTransfer, createPayout }, "actor", 7, "local")).toMatchObject({ ok: true })
    expect(createTransfer).not.toHaveBeenCalled(); expect(createPayout).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenLastCalledWith("record_stripe_connect_payout_submission", expect.objectContaining({ p_payout_id: "po_existing" }))
  })
  it("reports a recoverable local commit gap without marking the provider payout failed", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { commandId: 12, providerAccountId: "acct_test_1", currencyCode: "usd", netMinor: "975",
      existingTransferId: "tr_existing", transferIdempotencyKey: "stripe-connect:7:1:transfer", payoutIdempotencyKey: "stripe-connect:7:1:payout" }, error: null })
      .mockResolvedValue({ data: null, error: { message: "temporary database acknowledgement failure" } })
    const result = await submitStripeConnectPayout({ rpc } as never, { createTransfer: vi.fn(), createPayout: vi.fn(async () => ({ id: "po_existing" })) }, "actor", 7, "local")
    expect(result).toMatchObject({ ok: false, error: { code: "stripe_connect_local_commit_pending" } })
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc.mock.calls.some(([name]) => name === "record_stripe_connect_payout_failure")).toBe(false)
  })
  it("fails production closed before database or Stripe access", async () => {
    const rpc = vi.fn(); const result = await submitStripeConnectPayout({ rpc } as never, {} as never, "actor", 7, "production")
    expect(result).toMatchObject({ ok: false, error: { code: "stripe_connect_runtime_disabled" } }); expect(rpc).not.toHaveBeenCalled()
  })
})
