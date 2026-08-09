import { describe, expect, it, vi } from "vitest"
import { executeUserWithdrawalRequestCreate } from "@/lib/withdrawals/user-withdrawal-request-command"

describe("user withdrawal request command", () => {
  function acknowledgedClient(rpc: ReturnType<typeof vi.fn>) {
    return {
      from: vi.fn(() => ({
        select() { return this },
        eq() { return this },
        maybeSingle: vi.fn(async () => ({ data: { id: "acceptance-1" }, error: null })),
      })),
      rpc,
    }
  }

  it("maps an atomic reservation result without claiming payment", async () => {
    const rpc = vi.fn(async () => ({ data: [{ request_id: "req-1", payout_route_id: 3, status: "requested",
      requested_usd_amount: 125, currency_code: "USD", credit_count: 2, requested_at: "2026-08-05T00:00:00Z", no_payout_executed: true }], error: null }))
    const result = await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, { actorUserId: "user-1", payoutRouteId: 3, idempotencyKey: "request-123" })
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ requestId: "req-1", status: "requested", requestedUsdAmount: 125, creditCount: 2, noPayoutExecuted: true }) })
  })

  it.each([false, null, undefined])("fails closed when no-payout confirmation is %s", async (confirmation) => {
    const rpc = vi.fn(async () => ({ data: [{ request_id: "req-1", payout_route_id: 3, status: "requested",
      requested_usd_amount: 125, currency_code: "USD", credit_count: 2, requested_at: "2026-08-05T00:00:00Z",
      no_payout_executed: confirmation }], error: null }))
    const result = await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, {
      actorUserId: "user-1", payoutRouteId: 3, idempotencyKey: "request-123",
    })
    expect(result).toEqual({ ok: false, error: { code: "withdrawal_request_safety_check_failed",
      message: "The withdrawal request safety confirmation was missing." } })
  })

  it.each([
    ["active_default_payout_route_required", "Set an active default payout route before requesting withdrawal."],
    ["no_eligible_credited_earnings", "No eligible credited and not-paid earnings are available."],
  ])("maps %s without leaking database details", async (code, message) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: code } }))
    const result = await executeUserWithdrawalRequestCreate(acknowledgedClient(rpc) as never, { actorUserId: "user-1", payoutRouteId: 3, idempotencyKey: "request-123" })
    expect(result).toEqual({ ok: false, error: { code, message } })
  })

  it("rejects direct command calls before the current payout review acknowledgement", async () => {
    const rpc = vi.fn()
    const client = {
      from: vi.fn(() => ({
        select() { return this },
        eq() { return this },
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      })),
      rpc,
    }
    const result = await executeUserWithdrawalRequestCreate(client as never, {
      actorUserId: "user-1",
      payoutRouteId: 3,
      idempotencyKey: "request-123",
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: "terms_review_acknowledgement_required",
        message: "Record the current non-effective Terms review acknowledgement before testing this boundary.",
      },
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
